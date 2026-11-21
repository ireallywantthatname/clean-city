# CleanCity project context

## Overview

CleanCity is a web application for reporting municipal waste problems including overflowing bins, illegal dumping, and missed pickups under UN SDG 11.6. Citizens submit geotagged reports with photos, operations staff triage and dispatch tasks, and field crews resolve assigned jobs.

## Tech stack

- **Framework.** Next.js 16 App Router with React 19.
- **Runtime.** Bun.
- **Styling.** Tailwind CSS v4 with a monochrome theme and Radix UI primitives.
- **Maps.** OpenStreetMap tiles rendered with Leaflet and a Carto dark basemap.
- **Backend and database.** Convex tables, queries, mutations, and file storage.
- **AI integration.** OpenAI-compatible API defaulting to DeepSeek V4 Pro for text and vision tasks.

## Architecture

### Application routes

- **Public reporting at `/report`.** Three-step form for citizens to select an issue type, attach a photo, capture GPS coordinates, and submit a report.
- **Operations dashboard at `/ops`.** Queue, KPI strip, status and priority filters, map view, manual and automated triage, crew assignment, and CSV export.
- **Crew dashboard at `/crew`.** Assigned job list where field workers start jobs, block or unblock work, upload completion photos, and mark jobs done.
- **API routes under `/api`.** Endpoints for authentication, report management, analytics aggregation, user lookup, and AI processing.

### AI pipeline

- **Garbage detection.** Vision model checks whether the uploaded photo shows waste and caches results by SHA-256 image hash in `ai_image_cache`.
- **Vision triage.** Vision model classifies hazards, volume, recommended crew type, PPE, and priority.
- **Crew briefing.** Text model generates a short summary, checklist, and safety warnings for field crews.
- **Duplicate detection.** Text model ranks recent reports within 500 meters by similarity.
- **Resolution notes.** Text model drafts a public resolution note and internal summary when a crew completes a job.

### Convex data model

The schema in `convex/schema.ts` defines seven tables:

- `users` stores staff accounts and roles for `ops` and `crew`.
- `sessions` stores active authentication tokens and expiration timestamps.
- `reports` stores waste reports, coordinates, geohashes, storage IDs for photos, assignment fields, SLA timestamps, and nested AI results.
- `activities` stores the audit log for report creation, triage, assignment, status transitions, merges, and completion.
- `ai_runs` records model invocations, latency, status, and errors.
- `ai_image_cache` caches vision garbage detection outputs by SHA-256 hash.
- `ai_weekly_insights` stores generated weekly summaries, top issues, risk areas, and recommendations.
