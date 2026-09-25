# Hennessey Platform V4.3.2 — Talent Intelligence Architecture

This build evolves V4.3 into a provider-independent executive-search intelligence layer.

## New in V4.3.2
- AI Search Strategy before candidate search: target titles, adjacent sectors, target-organisation characteristics, evidence priorities and exclusions.
- Market Map populated only from returned search data; AI is explicitly prevented from inventing pool counts.
- Relationship intelligence on results: known Hennessey relationship vs no relationship evidenced.
- Provider provenance retained on every external profile.
- Provider registry endpoint (`/api/providers`) with PDL implemented and Coresignal/Crustdata reserved for comparative adapters.
- PDL remains the current live adapter; no new provider key is required to deploy this version.
- LinkedIn/profile links remain provider-supplied only. The platform does not scrape LinkedIn.

## Render deployment
Upload the individual files to the existing GitHub repo root and commit. Render should auto-deploy. Keep existing `OPENAI_API_KEY` and `OPENAI_MODEL`. `PDL_API_KEY` is optional until PDL is connected.

## Production note
This remains a prototype. Production still requires persistent database storage, authentication/RBAC, audit logging, GDPR/retention workflows, encryption, backups and provider contractual validation.


## V4.3.2 Search Strategy fix
- Build Search Strategy is explicitly wired to the UI and backend.
- Button shows a working state and cannot be double-clicked while running.
- Strategy failures are shown in the Search Strategy panel and logged safely.
- Returned strategy chips are editable before external search.
- Existing AI interpretation and provider architecture are retained.
