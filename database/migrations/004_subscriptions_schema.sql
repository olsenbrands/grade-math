-- iGradeMath Subscription Schema
-- Migration: 004_subscriptions_schema
-- Created: 2025-12-12
--
-- Supports monthly subscriptions with paper limits and overage purchases

-- ============================================
-- SUBSCRIPTION PLANS (Reference Table)
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  paper_limit INTEGER NOT NULL,
  features JSONB DEFAULT '[]',
  stripe_price_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the subscription tiers
INSERT INTO public.subscription_plans (id, name, description, price_cents, paper_limit, features, sort_order) VALUES
  ('free', 'Free Trial', 'Get 10 papers graded free', 0, 10,
   '["10 free papers to start", "Full grading + review flow", "No credit card required"]'::jsonb, 0),
  ('starter', 'Starter', 'Perfect for light grading needs', 900, 100,
   '["Up to 100 graded papers/month", "Math-only assignments", "AI grading with Needs Review flags", "Export grades"]'::jsonb, 1),
  ('classroom', 'Classroom Teacher', 'Most popular for everyday teachers', 1900, 300,
   '["Up to 300 graded papers/month", "Multiple assignments", "Priority processing", "Student list management", "Re-grade & adjust answers"]'::jsonb, 2),
  ('heavy', 'Heavy Grader', 'For teachers with high-volume grading', 3900, 1000,
   '["Up to 1,000 graded papers/month", "Unlimited assignments", "Faster grading speed", "Batch uploads", "Priority support"]'::jsonb, 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  paper_limit = EXCLUDED.paper_limit,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- USER SUBSCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON public.user_subscriptions(stripe_subscription_id);

-- ============================================
-- USAGE TRACKING (Papers graded per period)
-- ============================================
CREATE TABLE IF NOT EXISTS public.usage_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  papers_graded INTEGER DEFAULT 0,
  papers_limit INTEGER NOT NULL,
  overage_papers INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_user ON public.usage_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_period ON public.usage_periods(period_start, period_end);

-- ============================================
-- OVERAGE PURCHASES
-- ============================================
CREATE TABLE IF NOT EXISTS public.overage_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  usage_period_id UUID REFERENCES public.usage_periods(id),
  papers_purchased INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  stripe_payment_id TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_overage_user ON public.overage_purchases(user_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get current usage for a user
CREATE OR REPLACE FUNCTION public.get_current_usage(p_user_id UUID)
RETURNS TABLE (
  papers_graded INTEGER,
  papers_limit INTEGER,
  papers_remaining INTEGER,
  overage_papers INTEGER,
  period_end TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.papers_graded,
    up.papers_limit,
    GREATEST(0, up.papers_limit + up.overage_papers - up.papers_graded) as papers_remaining,
    up.overage_papers,
    up.period_end
  FROM public.usage_periods up
  WHERE up.user_id = p_user_id
    AND NOW() BETWEEN up.period_start AND up.period_end
  ORDER BY up.period_start DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment papers graded (called after each successful grade)
CREATE OR REPLACE FUNCTION public.increment_papers_graded(p_user_id UUID, p_count INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE public.usage_periods
  SET
    papers_graded = papers_graded + p_count,
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND NOW() BETWEEN period_start AND period_end;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can grade more papers
CREATE OR REPLACE FUNCTION public.can_grade_papers(p_user_id UUID, p_count INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  SELECT GREATEST(0, papers_limit + overage_papers - papers_graded)
  INTO v_remaining
  FROM public.usage_periods
  WHERE user_id = p_user_id
    AND NOW() BETWEEN period_start AND period_end;

  RETURN COALESCE(v_remaining, 0) >= p_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create usage period for new subscription
CREATE OR REPLACE FUNCTION public.create_usage_period_for_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_limit INTEGER;
BEGIN
  -- Get the paper limit for this plan
  SELECT paper_limit INTO v_plan_limit
  FROM public.subscription_plans
  WHERE id = NEW.plan_id;

  -- Create usage period
  INSERT INTO public.usage_periods (
    user_id, period_start, period_end, papers_limit
  ) VALUES (
    NEW.user_id,
    NEW.current_period_start,
    NEW.current_period_end,
    v_plan_limit
  )
  ON CONFLICT (user_id, period_start) DO UPDATE SET
    period_end = EXCLUDED.period_end,
    papers_limit = EXCLUDED.papers_limit;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_subscription_created ON public.user_subscriptions;
CREATE TRIGGER on_subscription_created
  AFTER INSERT OR UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.create_usage_period_for_subscription();

-- Auto-create free trial subscription for new users
CREATE OR REPLACE FUNCTION public.create_free_trial()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_subscriptions (
    user_id, plan_id, status, current_period_start, current_period_end
  ) VALUES (
    NEW.id, 'free', 'trialing', NOW(), NOW() + INTERVAL '30 days'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_free_trial ON public.profiles;
CREATE TRIGGER on_profile_created_free_trial
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_free_trial();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = TRUE);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

ALTER TABLE public.usage_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage"
  ON public.usage_periods FOR SELECT
  USING (auth.uid() = user_id);

ALTER TABLE public.overage_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own purchases"
  ON public.overage_purchases FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- UPDATED_AT FUNCTION (if not exists)
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_usage_updated_at
  BEFORE UPDATE ON public.usage_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
