# Grade-Math Project

## Overview

Math Homework AI Grading App - A mobile-first PWA that enables teachers to grade math homework using AI-powered vision recognition.

## Tech Stack

- **Frontend:** Next.js 14+ (App Router) with PWA capabilities
- **Deployment:** Vercel (Serverless + Background Functions)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (Email/Password + Google OAuth)
- **Storage:** Supabase Storage (images, PDFs)
- **AI Vision:** Groq (Llama 3.2), OpenAI (GPT-4o), Anthropic (Claude)

## Conventions

### File Structure
```
src/
├── app/                    # Next.js App Router pages
├── components/             # React components
│   ├── ui/                 # Base UI components
│   └── features/           # Feature-specific components
├── lib/                    # Utilities and helpers
│   ├── supabase/           # Supabase client & helpers
│   ├── ai/                 # AI provider abstraction
│   └── utils/              # General utilities
├── hooks/                  # Custom React hooks
├── services/               # Business logic services
└── types/                  # TypeScript types
```

### Naming Conventions
- **Components:** PascalCase (`ProjectCard.tsx`)
- **Hooks:** camelCase with `use` prefix (`useProjects.ts`)
- **Services:** camelCase (`gradingService.ts`)
- **Types:** PascalCase (`Project.ts`)
- **Database tables:** snake_case (`graded_results`)

### Code Style
- TypeScript strict mode
- Functional components with hooks
- Server Components by default, Client Components when needed
- Tailwind CSS for styling

## OpenSpec Usage

### Change Proposals
All significant changes go through OpenSpec:
1. Create proposal in `openspec/changes/<slug>/`
2. Include prd.md, proposal.md, tasks.md
3. Get approval before implementation
4. Use `/openspec:apply` to implement

### Spec Format
Use WHEN/THEN scenarios in `openspec/specs/<capability>/spec.md`
