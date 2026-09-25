import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("."));

const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
const hasExternal = Boolean(process.env.PDL_API_KEY);
const openai = hasOpenAI ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const safeError = (err) => ({
  name: err?.name || "Error",
  message: err?.message || "Unknown error",
  status: err?.status || err?.statusCode || null,
  code: err?.code || err?.error?.code || null,
  type: err?.type || err?.error?.type || null,
  request_id: err?.request_id || err?.headers?.["x-request-id"] || null
});

function publicError(err) {
  const e = safeError(err);
  if (e.status === 401) return { category: "authentication", message: "OpenAI authentication failed. Check OPENAI_API_KEY in Render Environment." };
  if (e.status === 429 && (e.code === "insufficient_quota" || /quota|billing|spend/i.test(e.message))) return { category: "billing_or_quota", message: "OpenAI API quota/billing limit reached. Check API billing, credits and project spend limits." };
  if (e.status === 429) return { category: "rate_limit", message: "OpenAI rate limit reached. Please retry shortly." };
  if (e.status === 404 || /model.*not found|does not exist|access.*model/i.test(e.message)) return { category: "model", message: `The configured OpenAI model (${model}) is unavailable to this API project.` };
  if (/schema|json_schema|response_format|structured/i.test(e.message)) return { category: "schema", message: "OpenAI rejected the structured-output schema. See Render logs for the safe diagnostic detail." };
  return { category: "openai_api", message: `OpenAI request failed${e.status ? ` (HTTP ${e.status})` : ""}. See Render logs for diagnostic detail.` };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, version: "4.2.3", openai_configured: hasOpenAI, openai_model: model, external_provider_configured: hasExternal });
});

app.post("/api/search/interpret", async (req, res) => {
  const requestTag = `interpret-${Date.now().toString(36)}`;
  const brief = String(req.body?.brief || "").trim();
  console.log(`[AI DIAG] ${requestTag} received /api/search/interpret; model=${model}; key_configured=${hasOpenAI}; brief_chars=${brief.length}`);
  if (!brief) return res.status(400).json({ error: "Search brief is empty.", category: "input", request_tag: requestTag });
  if (!openai) {
    console.warn(`[AI DIAG] ${requestTag} OPENAI_API_KEY is not configured.`);
    return res.status(503).json({ error: "OpenAI is not configured on the server.", category: "configuration", request_tag: requestTag });
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      function: { type: "string" },
      seniority: { type: "string", enum: ["Manager", "Director", "Head of", "C-Suite", ""] },
      locations: { type: "array", items: { type: "string" } },
      radius_miles: { type: ["integer", "null"] },
      sectors: { type: "array", items: { type: "string" } },
      compensation_min: { type: ["integer", "null"] },
      compensation_max: { type: ["integer", "null"] },
      employment_types: { type: "array", items: { type: "string" } },
      essential: { type: "array", items: { type: "string" } },
      desirable: { type: "array", items: { type: "string" } },
      exclude_companies: { type: "array", items: { type: "string" } },
      exclude_sectors: { type: "array", items: { type: "string" } }
    },
    required: ["function","seniority","locations","radius_miles","sectors","compensation_min","compensation_max","employment_types","essential","desirable","exclude_companies","exclude_sectors"]
  };

  try {
    const response = await openai.responses.create({
      model,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: [{ type: "input_text", text: "You convert executive-search briefs into structured recruitment criteria. Extract only what is stated or clearly implied. Use GBP numeric annual compensation values when supplied. Do not invent exclusions." }] },
        { role: "user", content: [{ type: "input_text", text: brief }] }
      ],
      text: { format: { type: "json_schema", name: "search_criteria", strict: true, schema } }
    });
    const raw = response.output_text;
    if (!raw) throw new Error("OpenAI returned no output_text.");
    const parsed = JSON.parse(raw);
    console.log(`[AI DIAG] ${requestTag} success; response_id=${response.id || "n/a"}; output_chars=${raw.length}`);
    return res.json(parsed);
  } catch (err) {
    const safe = safeError(err);
    console.error(`[AI DIAG] ${requestTag} OpenAI failure:`, JSON.stringify(safe));
    const pub = publicError(err);
    return res.status(safe.status && Number.isInteger(safe.status) ? safe.status : 502).json({ error: pub.message, category: pub.category, request_tag: requestTag });
  }
});

app.post("/api/search/external", async (req, res) => {
  console.log(`[EXT DIAG] external search requested; provider_configured=${hasExternal}`);
  if (!hasExternal) return res.status(503).json({ error: "External Market provider is not configured.", category: "configuration" });
  return res.status(501).json({ error: "External provider adapter is reserved for the next activation step.", category: "provider_pending" });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, "0.0.0.0", () => console.log(`Hennessey Platform V4.2.3 listening on 0.0.0.0:${port}; OpenAI=${hasOpenAI}; model=${model}; External=${hasExternal}`));
