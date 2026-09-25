# Hennessey Platform V4.3.0 — Live Talent Search

V4.3 keeps the working Render + OpenAI architecture from V4.2.3 and activates a People Data Labs (PDL) Person Search adapter.

## What changed
- Cleaner AI interpretation: Function and Seniority are kept separate (e.g. Human Resources + Director).
- Live External Market endpoint using PDL Person Search when `PDL_API_KEY` is configured.
- HR title expansion for Director / Head / Manager / C-Suite searches.
- Provider-supplied LinkedIn profile links appear as a LinkedIn button where available. Hennessey Platform does **not** scrape LinkedIn.
- Live provider results can be saved into the browser-based Hennessey Network prototype.
- Safe external-provider diagnostics in Render logs; API keys are never logged.
- `Both` merges Hennessey Network prototype records with live provider results.

## Render environment
Keep:
- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-5.6-luna`

Add:
- `PDL_API_KEY=<your People Data Labs API key>`

Optional:
- `PDL_SEARCH_URL=https://api.peopledatalabs.com/v5/person/search`
- `EXTERNAL_RESULT_LIMIT=20`

After saving the PDL key, Render will restart. `/api/health` should report `external_provider_configured: true`, and the platform badge should become **LIVE SEARCH READY**.

## Important current limitations
- PDL free plans obscure many location/contact field values, so live testing may return limited location display data.
- V4.3 sends location criteria to PDL but does not yet implement exact radius geofencing; that is a subsequent enhancement.
- Alignment is evidence-led; V4.3 deliberately avoids inventing a match percentage for provider profiles.
- Operational data is still stored in browser localStorage. Production database, authentication, permissions, audit logs, retention/GDPR workflows and backups remain the next architecture phase.

## Deploy
Upload the individual files in this folder to the root of the existing GitHub repository and commit. Render should auto-deploy. Do not upload only the ZIP.
