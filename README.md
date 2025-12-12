# Grade Math - AI Homework Grading

A Progressive Web App (PWA) for teachers to grade math homework using AI. Scan or upload homework images, and get instant grading with detailed feedback.

## Features

- **AI-Powered Grading**: Uses Claude AI to grade math homework with detailed explanations
- **Batch Processing**: Upload multiple assignments at once
- **Student Roster Management**: Maintain a class roster and auto-match student names
- **Token-Based Usage**: Fair usage system with signup bonuses and bulk discounts
- **Offline Support**: PWA with offline capabilities
- **Mobile-First**: Responsive design optimized for tablets and phones
- **Project Organization**: Organize assignments by project/assignment

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI**: Anthropic Claude API
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

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key
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
│   ├── ai/               # AI/Claude integration
│   ├── services/         # Business logic services
│   │   ├── tokens.ts     # Token management
│   │   └── student-grouping.ts # Name matching
│   ├── supabase/         # Database client
│   ├── graceful-degradation.ts # Retry/fallback utilities
│   └── toast.ts          # Toast notifications
└── types/                # TypeScript types
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

## Support

For issues and feature requests, please use GitHub Issues.
