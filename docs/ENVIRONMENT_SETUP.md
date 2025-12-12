# Environment Setup Guide

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher (or pnpm/yarn)
- Git
- A Supabase account
- An Anthropic API key (for Claude AI)

---

## 1. Clone the Repository

```bash
git clone https://github.com/yourusername/grade-math.git
cd grade-math
```

---

## 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Next.js 16
- React 19
- Tailwind CSS
- shadcn/ui components
- Supabase client
- Testing libraries (Vitest, Playwright)

---

## 3. Environment Variables

Create a `.env.local` file in the project root:

```env
# ===========================================
# Supabase Configuration
# ===========================================

# Your Supabase project URL
# Found in: Supabase Dashboard > Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# Your Supabase anon (public) key
# Found in: Supabase Dashboard > Settings > API
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Your Supabase service role key (for server-side operations)
# Found in: Supabase Dashboard > Settings > API
# WARNING: Keep this secret! Never expose in client-side code
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ===========================================
# AI Provider Configuration
# ===========================================

# Anthropic API key for Claude
# Get from: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-api03-...

# ===========================================
# Optional: Additional AI Providers
# ===========================================

# OpenAI API key (optional, for GPT-4o fallback)
# OPENAI_API_KEY=sk-...

# Groq API key (optional, for Llama Vision fallback)
# GROQ_API_KEY=gsk_...
```

### Getting Supabase Credentials

1. Go to [supabase.com](https://supabase.com) and create a project
2. Navigate to Settings > API
3. Copy the Project URL to `NEXT_PUBLIC_SUPABASE_URL`
4. Copy the anon/public key to `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Copy the service_role key to `SUPABASE_SERVICE_ROLE_KEY`

### Getting Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account or sign in
3. Navigate to API Keys
4. Create a new key and copy to `ANTHROPIC_API_KEY`

---

## 4. Database Setup

### Option A: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the migration files from `supabase/migrations/` in order

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Run migrations
supabase db push
```

### Required Tables

The following tables must exist:
- `profiles` - User profiles
- `projects` - Assignment projects
- `student_roster` - Student list
- `submissions` - Uploaded homework images
- `graded_results` - AI grading results
- `token_ledger` - Token transactions
- `project_answer_keys` - Answer keys

---

## 5. Storage Setup

Create the following storage buckets in Supabase:

1. **submissions** - For homework image uploads
   - Public: No
   - Allowed MIME types: image/*, application/pdf

2. **answer-keys** - For answer key uploads
   - Public: No
   - Allowed MIME types: image/*, application/pdf

### Storage Policies

Run these SQL commands in Supabase SQL Editor:

```sql
-- Submissions bucket policy
CREATE POLICY "Users can upload their own submissions"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'submissions' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Answer keys bucket policy
CREATE POLICY "Users can upload their own answer keys"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'answer-keys' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## 6. Running the Application

### Development Mode

```bash
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm run start
```

---

## 7. Running Tests

### Unit Tests

```bash
# Watch mode
npm run test

# Single run
npm run test:run

# With coverage
npm run test:coverage
```

### E2E Tests

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui
```

---

## 8. Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Add environment variables in Vercel dashboard
4. Deploy

### Environment Variables in Vercel

Add these in Vercel Dashboard > Settings > Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`

---

## Troubleshooting

### "Module not found" errors

```bash
rm -rf node_modules package-lock.json
npm install
```

### Supabase connection issues

1. Check that your environment variables are set correctly
2. Verify your Supabase project is running
3. Check RLS policies allow your queries

### Build errors

```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

### Port already in use

```bash
# Kill process on port 3000
npx kill-port 3000
```

---

## Support

For issues, please open a GitHub issue or contact the development team.
