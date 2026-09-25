# Hennessey Platform V4.2.2 — Render Ready

This package is configured as a Node/Express Web Service for Render.

## Render settings
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Health check: `/api/health`
- Server binds to `0.0.0.0` and Render's `PORT`.
- Secrets are environment variables and are not committed to source control.

## Deployment sequence
1. Create a private GitHub repository.
2. Upload the contents of this folder to the repository root.
3. In Render choose New > Web Service and connect the repository.
4. Use Node runtime, `npm install` as Build Command, and `npm start` as Start Command.
5. Add `OPENAI_API_KEY` in Render > Environment.
6. Add `OPENAI_MODEL` only if you want to override the app default.
7. Leave `PDL_API_KEY` unset until the licensed external-market connector is being activated.
8. Deploy and open the generated `onrender.com` address.
9. The platform status badge should show AI connectivity when the OpenAI key is valid.

Never put an API key in `index.html`, GitHub, screenshots, or chat.

Before real candidate/client data is stored, add authentication, persistent database storage, role-based access,
audit logging, encryption, backups, retention/deletion workflows, source provenance and UK GDPR/DPIA controls.
