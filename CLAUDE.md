# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI dApp Builder - a Next.js application that generates Ethereum dApps from natural language prompts. Users describe their dApp, Claude AI generates Solidity contracts and React frontends, then the system compiles, tests, and deploys to blockchain networks and Vercel.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
npm run start    # Run production server
```

## Architecture

### Data Flow

```
User Prompt → Analyze (Claude) → Plan Review → Generate (Claude) → Preview/Edit → Checks → Tests → Deploy → Results
```

### Key Directories

- **`app/api/`** - Backend routes for AI generation, compilation, deployment
  - `analyze/` - Claude analyzes prompts, asks clarifying questions
  - `generate/` - Claude generates contracts, pages, tests
  - `compile/` - Solidity compilation with solc, fetches OpenZeppelin from unpkg
  - `check/` - Security analysis, gas estimation
  - `fix/` - Claude fixes compilation/security errors
  - `github/`, `vercel/` - Deployment integrations

- **`components/builder/`** - Step-by-step wizard components (prompt, plan, preview, checks, testing, deploy, results)

- **`lib/store.ts`** - Zustand store managing entire builder state with localStorage persistence for saved projects

### Tech Stack

- Next.js 16 (App Router), React 19, TailwindCSS 4
- Wagmi + RainbowKit (wallet connection, supports Sepolia/Base/Optimism/Arbitrum testnets + mainnets)
- NextAuth 5 with GitHub OAuth
- Monaco Editor for code editing
- Claude Sonnet 4 via Anthropic SDK
- Solidity 0.8.20+ with OpenZeppelin v5.0.0

### API Patterns

All Claude interactions return structured JSON with `status` field. API routes use POST with JSON bodies. Compilation dynamically resolves OpenZeppelin imports from unpkg CDN with caching.

## Environment Variables

Required (see `.env.example`):
- `ANTHROPIC_API_KEY` - Claude API
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` - GitHub OAuth
- `NEXTAUTH_SECRET` - Session encryption
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - Wallet connections
