# HireSync — Development Rules

These rules apply to both developers and every AI coding assistant used on this project.

## 1. Before coding

1. Read `README.md` and all files in `docs/`.
2. Confirm the feature against `PROJECT_CONTRACT.md`.
3. Confirm request/response fields against `API_CONTRACT.md`.
4. Confirm tables and relationships against `DATABASE_SCHEMA.md`.
5. If a change is needed, discuss it with the other developer and update the contract first.

## 2. Two-person ownership

### Developer 1 — backend/AI
Owns:
- Supabase schema, migrations, and server-side data access.
- API routes and validation.
- PDF/DOCX extraction and private file handling.
- LLM structured extraction, evidence mapping, and draft generation.
- Deterministic scoring and ranking.
- Conflict-free scheduling and state transitions.
- Email provider integration and candidate response tokens.
- Backend tests and integration support.

### Developer 2 — frontend/UX
Owns:
- Dashboard and navigation.
- Job creation and rubric UI.
- Resume upload and processing status UI.
- Candidate profile, evidence, score breakdown, comparison.
- HR review and shortlist approval UI.
- Interviewer availability and schedule/calendar UI.
- Email drafting/approval UI.
- Activity log, notifications, responsive/accessibility behavior.
- Frontend tests and integration support.

Shared:
- API contract changes.
- End-to-end testing.
- Bug triage, code review, integration, demo preparation.

## 3. Git workflow

Branches:
- `main`: stable integrated branch.
- `feature/backend-ai`: Developer 1.
- `feature/frontend`: Developer 2.

Rules:
- Never commit directly to `main`.
- Pull latest changes before starting a work session.
- Commit small logical changes with descriptive messages.
- Push your feature branch regularly.
- Open a pull request into `main`; the other developer reviews it.
- Resolve conflicts deliberately; never choose “accept all” without inspecting.
- Do not force-push shared branches.
- Do not commit `.env.local`, API keys, service-role keys, resume files, database dumps, or personal data.

Suggested commands for Developer 1:
```powershell
git switch feature/backend-ai
git pull
git status
```

Suggested commands for Developer 2 (run once after repository access is granted):
```powershell
git clone https://github.com/nikhilchauhan0549-ui/HireSync.git
cd HireSync
git switch -c feature/frontend origin/feature/backend-ai
git push -u origin feature/frontend
```

After initial setup, Developer 2 starts each session with:
```powershell
git switch feature/frontend
git pull
git status
```

Before merging, the branch owner pushes and opens a pull request. The other developer reviews it on GitHub.

## 4. AI coding assistant rules

Paste this instruction into the coding assistant at the beginning of the project:

> You are contributing to HireSync. First read README.md and every file in docs/. Treat PROJECT_CONTRACT.md, API_CONTRACT.md, DATABASE_SCHEMA.md, and DEVELOPMENT_RULES.md as authoritative. Do not invent endpoints, database fields, states, or dependencies. Do not rewrite unrelated files or the entire application. Work only on the requested task, explain files changed, and run relevant checks. Never hardcode secrets or fake successful API/database/email operations. Keep AI outputs schema-validated; scoring, authorization, conflict checks, and state transitions must be enforced by deterministic server code. Ask before changing a shared contract.

## 5. Implementation order

Build in small vertical milestones; do not build every screen/API independently and integrate at the end.

1. Repository and app scaffold; environment setup; health check.
2. Supabase connection, auth boundary, and initial migration.
3. Job creation + rubric save/load (frontend and backend together).
4. Resume upload + private storage + processing status.
5. Text extraction + structured extraction + evidence display.
6. Deterministic score calculation + candidate review.
7. HR decision and shortlist approval.
8. Interviewer availability + scheduler proposal/confirmation + conflict tests.
9. Email draft + HR approval + provider send.
10. Candidate response page + token security.
11. End-to-end test, deployment, and demo rehearsal.

At each milestone, integrate and test before moving on.

## 6. Quality and safety rules

- Validate all inputs on the server (Zod or equivalent).
- Enforce authorization on every protected route.
- Never trust browser-supplied user IDs, scores, weights, or booking availability.
- Never let an LLM decide final numeric weighted totals or confirm bookings.
- Preserve exact source evidence for extracted claims.
- Treat “not found” as unknown, not as proof of absence.
- Avoid protected-characteristic inference and discriminatory scoring criteria.
- Do not log resume contents, secrets, or unnecessary personal data.
- Use private storage and short-lived authorized download links.
- Add tests for scoring math, rubric validation, timezones, overlaps, race conditions, token expiry, and state transitions.
- Handle loading, empty, success, and error states.
- Label mock/demo behavior visibly. Never present mock behavior as a real integration.
- Keep UI components small and typed; avoid `any` unless justified.
- Do not add packages without explaining why and checking compatibility.

## 7. Definition of done for each task

- [ ] Contract checked.
- [ ] Server validation and authorization added where relevant.
- [ ] UI states implemented where relevant.
- [ ] Tests added/updated.
- [ ] Lint/typecheck/build pass.
- [ ] No secrets or personal data committed.
- [ ] Docs updated if contract changed.
- [ ] PR description explains behavior, tests, and known limitations.
