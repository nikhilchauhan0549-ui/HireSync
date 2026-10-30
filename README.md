# HireSync

**Recruit. Schedule. Hire.**

HireSync is an AI-assisted recruitment workflow for HR teams. It turns job requirements and uploaded resumes into evidence-backed candidate assessments, supports human-reviewed shortlisting, finds conflict-free interview slots, and prepares email workflows.

## Product principle

**AI recommends. Software verifies. Humans approve. Agents execute.**

- AI may extract information, explain evidence, and draft communications.
- Deterministic application code calculates scores, validates constraints, and prevents scheduling conflicts.
- HR must review and approve shortlist decisions and outbound emails.
- Never invent candidate qualifications, availability, bookings, or successful email delivery.

## MVP scope

1. HR creates a job and weighted evaluation rubric.
2. HR uploads PDF/DOCX resumes.
3. The system extracts candidate information with source evidence.
4. The backend calculates rubric scores and ranks candidates.
5. HR reviews evidence, edits decisions, and approves a shortlist.
6. HR enters interviewer availability and scheduling constraints.
7. The scheduler proposes conflict-free interview slots.
8. HR approves email drafts before sending through a configured test/transactional provider.
9. Candidates can accept, decline, or request a reschedule through a secure response link.

## Out of scope for the MVP

- LinkedIn scraping or integration.
- Training a new AI model.
- Claiming Google Calendar, Gmail, or video-meeting integration unless implemented and tested.
- Fully autonomous rejection, hiring, or sending emails without HR approval.

## Technology baseline

- Next.js App Router + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase PostgreSQL and private Storage
- One configured LLM provider for extraction, evidence mapping, explanations, and email drafting
- Server-side PDF/DOCX extraction
- Resend or another configured transactional email provider
- GitHub for version control; Vercel for deployment

Use the versions already agreed by the team when initializing the application. Do not independently upgrade or replace core dependencies without agreement.

## Team

| Owner | Responsibility |
|---|---|
| Developer 1 — backend/AI | Database, server APIs, file processing, LLM integration, deterministic scoring, scheduling, email integration, integration tests |
| Developer 2 — frontend/UX | Dashboard, job setup, uploads, candidate review, shortlist approval, availability UI, calendar, email center, activity log |

Both developers must read `docs/DEVELOPMENT_RULES.md` and follow the API/database contracts before implementing features.

## Repository workflow

- `main`: stable, integrated code only.
- `feature/backend-ai`: Developer 1.
- `feature/frontend`: Developer 2.

Do not commit directly to `main`. Push work to your own branch and open a pull request. Integrate in small, reviewable changes.

## Setup pack contents

- `docs/PROJECT_CONTRACT.md`: product scope and functional requirements.
- `docs/API_CONTRACT.md`: frontend/backend request and response contract.
- `docs/DATABASE_SCHEMA.md`: entities and relationships.
- `docs/DEVELOPMENT_RULES.md`: shared engineering and Git rules.
- `supabase/migrations/0001_initial_schema.sql`: initial relational schema proposal.
- `.env.example`: environment variable names only; never put real secrets in Git.
- `.gitignore`: common local/generated files to keep out of Git.

## Definition of done

A feature is done only when:
1. Its UI and server behavior are integrated.
2. Loading, empty, success, and error states are handled.
3. Validation and authorization are enforced server-side.
4. Relevant tests pass.
5. No fake success, fabricated data, or exposed secrets are present.
6. The relevant contract/docs are updated if behavior or data structures changed.
