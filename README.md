# CleanCity

Report overflowing bins, illegal dumping, and missed pickups — SDG 11.6.

Built with Next.js 16, Supabase, OpenAI-compatible AI, and OpenStreetMap.

## Setup

### Prerequisites

- [Bun](https://bun.sh) runtime
- Supabase project (configured with schema from migrations)
- OpenAI-compatible API key (e.g. [DeepSeek](https://api-docs.deepseek.com/))

### Environment

Create `.env.local` (see values from Supabase Dashboard → Project Settings → API):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # optional for local; falls back to anon key
INTERNAL_AI_SECRET=random-secret-for-internal-ai-calls

# OpenAI-compatible AI (DeepSeek example)
DEEPSEEK_API_KEY=sk-...               # or OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat
# OPENAI_VISION_MODEL=gpt-4o          # optional; for providers with vision
AI_PROVIDER=deepseek                  # label stored in ai_runs
```

Any OpenAI-compatible base URL works (OpenAI, DeepSeek, local vLLM, etc.).

### Database

SQL migrations live in `supabase/migrations/`. Apply them via the Supabase SQL editor, CLI, or MCP:

```
001_enable_extensions → 002_create_enum_types → 003_create_profiles →
004_create_reports → 005_create_activities → 006_create_ai_tables →
007_create_storage_bucket → 008_seed_demo_users
```

### Install & Run

```bash
bun install
bun run dev          # start dev server on http://localhost:3000
bun run seed         # optional: create demo users via Admin API (needs service role)
```

Demo users are also created by migration `008_seed_demo_users`.

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Ops Admin | ops@cleancity.dev | password123 |
| Crew One | crew1@cleancity.dev | password123 |
| Crew Two | crew2@cleancity.dev | password123 |

## Architecture

- **Auth**: Supabase Auth (email/password) with roles in `profiles` table
- **Database**: PostgreSQL with PostGIS, RLS policies
- **Storage**: Supabase Storage (`report-photos` bucket)
- **AI**: OpenAI-compatible chat API (garbage detection, triage, crew briefs, duplicates, resolution notes). Text-only providers fall back when vision is unsupported.
- **Maps**: OpenStreetMap tiles via Leaflet (Carto dark basemap)
- **UI**: Tailwind CSS v4, monochrome design system, DM Sans + DM Mono fonts

### API Routes (26 endpoints)

| Group | Routes |
|-------|--------|
| Reports | CRUD, assign, complete, triage, status, merge, duplicates, export |
| Analytics | summary (KPI), hotspots (geohash grid) |
| Users | list crew users |
| AI | process-report, process-completion, garbage-check, triage, crew-brief, duplicates, public-note, status, retry-pending, weekly-insights |

## Build

```bash
bun run build
```
