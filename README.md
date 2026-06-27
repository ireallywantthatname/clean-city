# CleanCity

Report overflowing bins, illegal dumping, and missed pickups — SDG 11.6.

Built with Next.js 16, Supabase, Google Gemini AI, and Google Maps.

## Setup

### Prerequisites

- [Bun](https://bun.sh) runtime
- Supabase project (configured with schema from migrations)
- Google Gemini API key
- Google Maps API key

### Environment

Copy `.env.local` and fill in your keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-maps-key
INTERNAL_AI_SECRET=random-secret-for-internal-ai-calls
```

### Database

Run the migrations in order from the Supabase dashboard or via CLI:

```
001_enable_extensions → 002_create_enum_types → 003_create_profiles →
004_create_reports → 005_create_activities → 006_create_ai_runs →
007_create_ai_image_cache → 008_create_ai_weekly_insights →
009_create_functions → 010_create_storage_bucket
```

### Install & Run

```bash
bun install
bun run dev          # start dev server on http://localhost:3000
bun run seed         # create demo users
```

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
- **AI**: Google Gemini (vision garbage detection, triage, crew briefs, duplicates, resolution notes)
- **Maps**: Google Maps with monochrome styling
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
