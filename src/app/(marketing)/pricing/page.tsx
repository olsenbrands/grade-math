'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Sparkles, Clock, Brain, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { createCheckoutSession } from '@/lib/services/subscriptions';

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 9,
    papers: 100,
    description: 'Perfect for light grading needs',
    features: [
      'Up to 100 graded papers/month',
      'Math-only assignments',
      'AI grading with "Needs Review" flags',
      'Export grades',
    ],
    cta: 'Start Grading',
    highlighted: false,
  },
  {
    id: 'classroom',
    name: 'Classroom Teacher',
    price: 19,
    papers: 300,
    description: 'Most popular for everyday teachers',
    features: [
      'Up to 300 graded papers/month',
      'Multiple assignments',
      'Priority processing',
      'Student list management',
      'Re-grade & adjust answers',
    ],
    cta: 'Get Started',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    id: 'heavy',
    name: 'Heavy Grader',
    price: 39,
    papers: 1000,
    description: 'For teachers with high-volume grading',
    features: [
      'Up to 1,000 graded papers/month',
      'Unlimited assignments',
      'Faster grading speed',
      'Batch uploads',
      'Priority support',
    ],
    cta: 'Go Heavy',
    highlighted: false,
  },
];

const valueProps = [
  {
    icon: Clock,
    title: 'Save 1-2 hours per assignment',
    description: 'Grade an entire class in minutes, not hours',
  },
  {
    icon: Brain,
    title: 'Reduce mental load',
    description: 'AI flags only what needs your attention',
  },
  {
    icon: Sparkles,
    title: 'Consistent grading',
    description: 'Same standards applied to every paper',
  },
];

export default function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Check if user is logged in
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
    };
    checkAuth();
  }, []);

  // Handle checkout canceled message
  useEffect(() => {
    if (searchParams.get('checkout') === 'canceled') {
      setCheckoutError('Checkout was canceled. You can try again anytime.');
      // Clear the URL param
      window.history.replaceState({}, '', '/pricing');
    }
  }, [searchParams]);

  const handlePlanSelect = async (planId: string) => {
    // If not logged in, redirect to signup with plan in query
    if (!isLoggedIn) {
      router.push(`/signup?plan=${planId}`);
      return;
    }

    // User is logged in, proceed to Stripe checkout
    setLoadingPlan(planId);
    setCheckoutError(null);

    try {
      const checkoutUrl = await createCheckoutSession(planId);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        setCheckoutError('Failed to create checkout session. Please try again.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setCheckoutError('Something went wrong. Please try again.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="iGradeMath" width={32} height={32} className="rounded" />
            <span className="text-xl font-bold">iGradeMath</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button>Try Free</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center max-w-3xl mx-auto mb-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Grade Math Assignments in Minutes — Not Your Evenings
          </h1>
          <p className="text-xl text-muted-foreground mb-4">
            iGradeMath grades math assignments in minutes, not hours.
            Less than $0.10 per paper — and hours of your time back.
          </p>
        </div>

        {/* Free Trial CTA - Prominent */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-6 py-3 rounded-full">
            <Sparkles className="h-5 w-5" />
            <span className="font-medium">Get 10 papers graded free — no credit card required</span>
          </div>
          <div className="mt-4">
            <Link href="/signup">
              <Button size="lg">
                Start Free Trial
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Value Props */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
          {valueProps.map((prop) => (
            <div key={prop.title} className="flex flex-col items-center text-center p-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <prop.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{prop.title}</h3>
              <p className="text-sm text-muted-foreground">{prop.description}</p>
            </div>
          ))}
        </div>

        {/* Trust Anchor */}
        <p className="text-center text-muted-foreground mb-12">
          Used by teachers to grade entire classes in under 10 minutes.
        </p>

        {/* Error Message */}
        {checkoutError && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg text-center">
            <p className="text-amber-800 dark:text-amber-200">{checkoutError}</p>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                plan.highlighted
                  ? 'border-primary shadow-lg scale-105 z-10'
                  : 'border-border'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-sm font-medium px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {/* Price */}
                <div className="text-center mb-6">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Up to {plan.papers.toLocaleString()} papers
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  className="w-full mt-auto"
                  variant={plan.highlighted ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => handlePlanSelect(plan.id)}
                  disabled={loadingPlan === plan.id}
                >
                  {loadingPlan === plan.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {plan.cta}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Overage Info */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Need more papers?</h3>
              <p className="text-muted-foreground mb-3">
                If you hit your limit, just add 100 more papers for $5.
                No interruption, no hassle — keep grading.
              </p>
              <p className="text-sm text-muted-foreground">
                Monthly paper limits reset each month. Any extra paper packs you purchase
                never expire while your subscription is active.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Common Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">What counts as a &quot;graded paper&quot;?</h3>
              <p className="text-muted-foreground">
                Each student submission you grade counts as one paper — whether it&apos;s a photo,
                scan, or PDF. Multi-page assignments still count as one paper per student.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What happens if I exceed my limit?</h3>
              <p className="text-muted-foreground">
                You won&apos;t be cut off! We&apos;ll prompt you to add more papers for $5 per 100.
                Grading continues without interruption — it&apos;s your choice.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I change plans anytime?</h3>
              <p className="text-muted-foreground">
                Absolutely. Upgrade, downgrade, or cancel whenever you want.
                Changes take effect at your next billing cycle.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Do unused papers roll over?</h3>
              <p className="text-muted-foreground">
                Monthly paper limits reset each month. Any extra paper packs you purchase
                never expire while your subscription is active.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Is there a school or district plan?</h3>
              <p className="text-muted-foreground">
                We&apos;re working on multi-teacher and school-wide pricing.
                Contact us at support@igrademath.com for volume discounts.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} iGradeMath. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground">Terms</Link>
              <a href="mailto:support@igrademath.com" className="hover:text-foreground">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
