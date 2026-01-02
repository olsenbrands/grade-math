# Grade Math - AI Homework Grading

A Progressive Web App (PWA) for teachers to grade math homework using AI. Scan or upload homework images, and get instant grading with detailed feedback.

## Features

- **AI-Powered Grading**: Uses GPT-4o vision with multi-layer verification for high accuracy
- **Enhanced OCR**: Mathpix integration for superior handwriting recognition
- **Computational Verification**: Wolfram Alpha verification for complex calculations
- **Smart Difficulty Routing**: Automatic classification (simple/moderate/complex) for optimal processing
- **Batch Processing**: Upload multiple assignments at once
- **Student Roster Management**: Maintain a class roster and auto-match student names
- **Token-Based Usage**: Fair usage system with signup bonuses and bulk discounts
- **Cost Tracking**: Detailed breakdown of API costs per grading operation
- **Offline Support**: PWA with offline capabilities
- **Mobile-First**: Responsive design optimized for tablets and phones
- **Project Organization**: Organize assignments by project/assignment

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI Providers**:
  - **GPT-4o** (Primary): Vision-based grading with chain-of-thought reasoning
  - **Mathpix**: Specialized math OCR for handwriting recognition
  - **Wolfram Alpha**: Computational verification for complex math
- **PWA**: next-pwa

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- Anthropic API key

### Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/grade-math.git
cd grade-math
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Providers (Required)
OPENAI_API_KEY=your_openai_api_key

# Enhanced OCR (Optional - improves handwriting recognition)
MATHPIX_APP_ID=your_mathpix_app_id
MATHPIX_APP_KEY=your_mathpix_app_key

# Computational Verification (Optional - improves accuracy for complex math)
WOLFRAM_APP_ID=your_wolfram_app_id

# Cost Tracking (Optional)
TRACK_API_COSTS=true
```

4. Set up the database:
```bash
# Run migrations in Supabase dashboard or CLI
```

5. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
npm run test:coverage # Run tests with coverage
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── grading/       # Grading endpoints
│   │   ├── grouping/      # Student grouping endpoints
│   │   └── tokens/        # Token management endpoints
│   ├── dashboard/         # Main dashboard
│   ├── projects/          # Project management
│   └── students/          # Student roster
├── components/
│   ├── error-boundary.tsx # Error handling
│   ├── offline-indicator.tsx # Network status
│   ├── results/           # Grading results display
│   ├── submissions/       # Submission components
│   ├── tokens/            # Token balance display
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── ai/               # AI grading pipeline
│   │   ├── grading-service-enhanced.ts # Main grading orchestrator
│   │   ├── provider-manager.ts # AI provider fallback management
│   │   ├── math-classifier.ts # Difficulty classification
│   │   ├── answer-comparator.ts # Answer equivalence checking
│   │   ├── verification-service.ts # Multi-layer verification
│   │   ├── prompts.ts & prompts-verification.ts # AI prompts
│   │   ├── types.ts      # TypeScript definitions
│   │   └── providers/
│   │       ├── mathpix.ts # Mathpix OCR integration
│   │       └── wolfram.ts # Wolfram Alpha verification
│   ├── services/         # Business logic services
│   │   ├── tokens.ts     # Token management
│   │   └── student-grouping.ts # Name matching
│   ├── supabase/         # Database client
│   ├── graceful-degradation.ts # Retry/fallback utilities
│   └── toast.ts          # Toast notifications
└── types/                # TypeScript types
```

## Enhanced Grading Pipeline

The grading system uses a multi-layer approach for maximum accuracy:

### Pipeline Flow

```
Image Upload
    │
    ▼
┌─────────────────┐
│  Mathpix OCR    │ ← Specialized math handwriting recognition
│  (if available) │   Confidence score 0-1
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  GPT-4o Vision  │ ← Primary grading with chain-of-thought
│  + Answer Key   │   Shows work for each problem
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Math Classifier │ ← Routes to appropriate verification
│ simple/moderate │
│    /complex     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌──────────┐
│ None  │ │ Wolfram  │ ← Independent computation check
│(simple)│ │(moderate+)│
└───┬───┘ └────┬─────┘
    │          │
    └────┬─────┘
         │
         ▼
┌─────────────────┐
│Answer Comparator│ ← Handles equivalent forms
│ 1/2 = 0.5 = 50% │   Fraction ↔ Decimal ↔ Percent
└────────┬────────┘
         │
         ▼
    Final Result
    + Cost Breakdown
```

### Difficulty Classification

Problems are automatically classified to optimize processing:

| Difficulty | Examples | Verification |
|------------|----------|--------------|
| **Simple** | 2+3, 15-7, 3×4 | None (high AI confidence) |
| **Moderate** | 3/4 + 1/2, 15% of 80 | Wolfram Alpha |
| **Complex** | 2x+3=7, x²-4=0 | Wolfram + Chain-of-thought |

### Answer Comparison

The system recognizes equivalent answer forms:

- **Fractions ↔ Decimals**: 1/2 = 0.5
- **Percentages ↔ Decimals**: 50% = 0.5
- **Mixed numbers**: 1 1/2 = 3/2 = 1.5
- **Negative numbers**: -3 = negative 3
- **Numeric tolerance**: 3.14159 ≈ 3.14 (configurable)

### Cost Tracking

Each grading operation returns a cost breakdown:

```typescript
{
  costBreakdown: {
    mathpix: 0.004,   // $0.004 per image
    gpt4o: 0.015,     // ~$0.015 per grading
    wolfram: 0.02,    // $0.02 per verification
    total: 0.039
  },
  processingMetrics: {
    totalTimeMs: 2500,
    mathpixTimeMs: 800,
    gpt4oTimeMs: 1500,
    verificationTimeMs: 200,
    aiProviderUsed: 'openai',
    fallbacksRequired: 0
  }
}
```

## Core Features

### Token System

Users have a token balance for AI operations:
- 1 token per graded submission
- 1 token per feedback generation
- 10% bulk discount for 10+ submissions
- 50 free tokens on signup

### Student Name Matching

Automatic matching of detected names to roster using:
- Levenshtein distance for fuzzy matching
- First/last name component matching
- Nickname/abbreviation detection
- Confidence thresholds with manual review flags

### Error Handling

Comprehensive error handling with:
- Global error boundary
- API error components
- Retry with exponential backoff
- Circuit breaker pattern
- Offline awareness

## API Routes

### POST /api/grading/process
Grade a batch of submissions.

```typescript
// Request
{
  projectId: string;
  submissionIds: string[];
  includeFeedback?: boolean;
}

// Response
{
  results: GradingResult[];
  tokensUsed: number;
}
```

### GET /api/tokens
Get current token balance and history.

### POST /api/grouping
Auto-assign students to submissions.

## Testing

```bash
# Run all tests
npm run test:run

# Run with coverage
npm run test:coverage

# Watch mode
npm run test
```

### Test Suite

The project includes comprehensive tests for the grading pipeline:

```
tests/
├── ai/
│   ├── provider-manager.fallback.test.ts  # Provider fallback behavior
│   ├── math-classifier.test.ts            # 50+ problem classification tests
│   ├── answer-comparator.test.ts          # Answer equivalence tests
│   ├── verification-service.test.ts       # Verification pipeline tests
│   └── providers/
│       ├── mathpix.test.ts                # Mathpix OCR tests
│       └── wolfram.test.ts                # Wolfram Alpha tests
└── integration/
    └── full-pipeline.e2e.test.ts          # End-to-end grading tests
```

### Test Coverage

- **Math Classifier**: 50+ problem types across simple/moderate/complex
- **Answer Comparator**: Exact match, numeric, fraction, percentage equivalence
- **Providers**: API calls, error handling, timeouts, rate limiting
- **E2E**: Full pipeline execution with mocked external services

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Docker

```dockerfile
# Build
docker build -t grade-math .

# Run
docker run -p 3000:3000 grade-math
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Troubleshooting Guide

### Common Issues and Solutions

#### Provider Failures

| Issue | Symptom | Solution |
|-------|---------|----------|
| **OpenAI API Key Invalid** | `401 Unauthorized` errors | Verify `OPENAI_API_KEY` is correct and has available credits |
| **All Providers Unavailable** | `All providers failed` error | Check all API keys, verify network connectivity |
| **Rate Limiting** | `429 Too Many Requests` | Wait and retry, or upgrade API tier |
| **Timeout Errors** | Grading takes >30s | Check network, try smaller images |

#### OCR Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Mathpix Unavailable** | Falls back to GPT-4o vision | Verify `MATHPIX_APP_ID` and `MATHPIX_APP_KEY` |
| **Poor Handwriting Recognition** | Low confidence scores | Ensure clear, high-contrast images |
| **LaTeX Parsing Errors** | Malformed expressions | Check Mathpix dashboard for quota |

#### Verification Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Wolfram Alpha Unavailable** | No computation verification | Verify `WOLFRAM_APP_ID` |
| **Incorrect Verifications** | Mismatched answers | Check answer normalization, file issue |
| **High `needsReview` Rate** | >15% flagged | Review AI prompts, check edge cases |

#### Database Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Connection Failed** | `ECONNREFUSED` errors | Check Supabase URL and credentials |
| **RLS Policy Errors** | `permission denied` | Verify user authentication |
| **Token Deduction Failed** | Balance unchanged | Check transaction isolation |

### Environment Variable Checklist

```bash
# Required
OPENAI_API_KEY=sk-...          # Must have vision capabilities

# Optional but recommended
MATHPIX_APP_ID=...             # Improves handwriting recognition
MATHPIX_APP_KEY=...
WOLFRAM_APP_ID=...             # Improves complex math accuracy

# Database
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Optional
TRACK_API_COSTS=true           # Enable cost logging
```

### Debugging Commands

```bash
# Check API health
curl -X GET /api/health

# Run specific tests
npm run test -- --grep "provider-manager"
npm run test -- --grep "answer-comparator"

# Check logs (Vercel)
vercel logs --follow

# Local debugging
DEBUG=grade-math:* npm run dev
```

### Health Check Endpoint

The `/api/health` endpoint returns provider availability:

```json
{
  "providers": {
    "openai": true,
    "anthropic": false,
    "groq": false
  },
  "mathpix": true,
  "wolfram": true,
  "database": true
}
```

---

## Cost Analysis and Expectations

### Per-Operation Costs

| Service | Cost | Notes |
|---------|------|-------|
| **Mathpix OCR** | $0.004/image | First 100/month free |
| **GPT-4o Vision** | ~$0.015/image | Input + output tokens |
| **Wolfram Alpha** | $0.02/query | First 2000/month free |

### Cost by Problem Difficulty

| Difficulty | Pipeline | Estimated Cost |
|------------|----------|----------------|
| **Simple** | GPT-4o only | $0.015 |
| **Moderate** | Mathpix + GPT-4o | $0.019 |
| **Complex** | Mathpix + GPT-4o + Wolfram | $0.039 |

### Monthly Cost Projections

Assuming distribution: 30% simple, 50% moderate, 20% complex

| Submissions/Month | Estimated Cost |
|-------------------|----------------|
| 100 | ~$2.18 |
| 500 | ~$10.90 |
| 1,000 | ~$21.80 |
| 5,000 | ~$109.00 |
| 10,000 | ~$218.00 |

### Free Tier Limits

| Service | Free Tier | After Free Tier |
|---------|-----------|-----------------|
| **OpenAI** | $5 trial credit (3 months) | Pay-as-you-go |
| **Mathpix** | 100 images/month | $0.004/image |
| **Wolfram Alpha** | 2,000 calls/month | $0.0005/call |

### Cost Optimization Tips

1. **Disable Mathpix for simple problems** - Save $0.004 per image
2. **Use Wolfram only for equations** - Save $0.02 per non-equation
3. **Batch processing** - Slight API volume discounts
4. **Cache repeated problems** - Avoid reprocessing identical work
5. **Monitor `needsReview` rate** - High rates indicate wasted processing

### Cost Tracking

Enable cost tracking to monitor API usage:

```env
TRACK_API_COSTS=true
```

Each grading result includes a cost breakdown:

```typescript
result.costBreakdown = {
  mathpix: 0.004,
  gpt4o: 0.015,
  wolfram: 0.02,
  total: 0.039
};
```

Logs are prefixed with `[COST]` for easy filtering:

```
[COST] Submission sub-123: Mathpix=$0.004, GPT-4o=$0.015, Total=$0.019
```

---

## Support

For issues and feature requests, please use GitHub Issues.
