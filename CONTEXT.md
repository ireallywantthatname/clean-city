# CleanCity - Project Context

## Overview
CleanCity is a modern web application designed to help citizens report municipal waste issues such as overflowing bins, illegal dumping, and missed pickups (aligning with UN SDG 11.6). 

It features tailored interfaces for different user roles, utilizing AI to automate report triage, deduplication, and routing.

## Tech Stack
- **Framework:** Next.js 16 (App Router) with React 19
- **Runtime:** Bun
- **Styling:** Tailwind CSS v4, monochrome design system, shadcn/radix-ui components
- **Map Integration:** OpenStreetMap via Leaflet (Carto dark basemap)
- **Backend & Database:** Supabase (PostgreSQL with PostGIS for geospatial data, Auth, Storage)
- **AI Integration:** OpenAI-compatible API (defaults to DeepSeek V4 Pro text and vision models)

## Architecture & Features
The application is structured around specific user roles and workflows:

### Key Areas
- **Public Reporting (`/report`):** Interface for citizens to submit issues with location data and photos.
- **Operations Dashboard (`/ops`):** Triage, analytics, hotspot mapping, and dispatching for operations staff.
- **Crew Dashboard (`/crew`):** Task list and resolution interface for field workers.
- **API Engine (`/api`):** 26 specialized endpoints covering reports, analytics, user management, and AI processing.

### AI Capabilities
AI is deeply integrated into the workflow to minimize manual operations tasks:
- Image validation (verifying garbage presence via vision models).
- Automated triage and severity assessment.
- Duplicate report detection based on context and location.
- Generation of crew briefs and public-facing resolution notes.

### Data Model Highlights
The database relies on Supabase and is structured via migrations (`supabase/migrations/`). Key tables include:
- `profiles`: Role-based access control (e.g., ops, crew).
- `reports`: Core entity storing issue details, status, and geography (PostGIS).
- `activities`: Audit logs and activity tracking.
- `ai_tables`: Storage for AI job logs, outputs, and embeddings.
