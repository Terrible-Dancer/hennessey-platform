# Hennessey Platform V4.2.3 — AI Diagnostics

This release preserves the V4.2.2 interface and adds safe server-side diagnostics for live AI brief interpretation.

## What changed
- Logs every `/api/search/interpret` request with a non-secret request tag.
- Logs configured model and whether a key exists, never the key itself.
- Logs safe OpenAI status/code/type/message/request ID on failures.
- Front end displays a useful failure category while retaining local fallback parsing.
- `/api/health` reports version, configured model, OpenAI configuration state and external-provider state.
- Default model is `gpt-5.6-luna`.

## Render
Root Directory: blank when these files are in the repository root.
Build: `npm install`
Start: `npm start`
Health: `/api/health`

Keep `OPENAI_API_KEY` only in Render Environment. Do not commit `.env` or API keys.
