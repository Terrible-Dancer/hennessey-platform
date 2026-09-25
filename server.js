import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("."));

const VERSION = "4.3.3";
const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
const hasExternal = Boolean(process.env.PDL_API_KEY);
const pdlUrl = process.env.PDL_SEARCH_URL || "https://api.peopledatalabs.com/v5/person/search";
const externalLimit = Math.min(Math.max(Number(process.env.EXTERNAL_RESULT_LIMIT) || 20, 1), 100);
const openai = hasOpenAI ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const safeError = (err) => ({ name: err?.name || "Error", message: err?.message || "Unknown error", status: err?.status || err?.statusCode || null, code: err?.code || err?.error?.code || null, type: err?.type || err?.error?.type || null, request_id: err?.request_id || err?.headers?.["x-request-id"] || null });
function publicError(err) {
  const e = safeError(err);
  if (e.status === 401) return { category: "authentication", message: "OpenAI authentication failed. Check OPENAI_API_KEY in Render Environment." };
  if (e.status === 429 && (e.code === "insufficient_quota" || /quota|billing|spend/i.test(e.message))) return { category: "billing_or_quota", message: "OpenAI API quota/billing limit reached. Check API billing, credits and project spend limits." };
  if (e.status === 429) return { category: "rate_limit", message: "OpenAI rate limit reached. Please retry shortly." };
  if (e.status === 404 || /model.*not found|does not exist|access.*model/i.test(e.message)) return { category: "model", message: `The configured OpenAI model (${model}) is unavailable to this API project.` };
  if (/schema|json_schema|response_format|structured/i.test(e.message)) return { category: "schema", message: "OpenAI rejected the structured-output schema. See Render logs for the safe diagnostic detail." };
  return { category: "openai_api", message: `OpenAI request failed${e.status ? ` (HTTP ${e.status})` : ""}. See Render logs for diagnostic detail.` };
}

app.get("/api/health", (req, res) => res.json({ ok: true, version: VERSION, openai_configured: hasOpenAI, openai_model: model, external_provider_configured: hasExternal, external_provider: hasExternal ? "People Data Labs" : null }));


app.get("/api/providers", (req,res) => res.json({
  architecture:"provider-independent",
  active_adapter: hasExternal ? "People Data Labs" : null,
  adapters:[
    {id:"pdl",name:"People Data Labs",implemented:true,configured:hasExternal},
    {id:"coresignal",name:"Coresignal",implemented:false,configured:false},
    {id:"crustdata",name:"Crustdata",implemented:false,configured:false}
  ],
  note:"External providers are normalised into a common Hennessey candidate schema. LinkedIn/profile URLs are provider-supplied; the platform does not scrape LinkedIn."
}));

app.post("/api/search/strategy", async (req,res) => {
 const tag=`strategy-${Date.now().toString(36)}`; const c=req.body||{};
 console.log(`[AI STRATEGY] ${tag} received; model=${model}; function=${c.function||""}; seniority=${c.seniority||""}`);
 if(!openai) return res.status(503).json({error:"OpenAI is not configured on the server.",category:"configuration"});
 if(!c.brief && !c.function && !c.seniority) return res.status(400).json({error:"Add or interpret a search brief before building the strategy.",category:"validation"});
 const schema={type:"object",additionalProperties:false,properties:{
   target_titles:{type:"array",items:{type:"string"}},
   adjacent_sectors:{type:"array",items:{type:"string"}},
   target_company_characteristics:{type:"array",items:{type:"string"}},
   evidence_priorities:{type:"array",items:{type:"string"}},
   hard_exclusions:{type:"array",items:{type:"string"}},
   research_flags:{type:"array",items:{type:"string"}},
   compensation_rule:{type:"string"},
   geography_rule:{type:"string"}
  },required:["target_titles","adjacent_sectors","target_company_characteristics","evidence_priorities","hard_exclusions","research_flags","compensation_rule","geography_rule"]};
 try{
  const response=await openai.responses.create({model,reasoning:{effort:"low"},input:[
   {role:"system",content:[{type:"input_text",text:"You are an executive-search research strategist. Expand a search brief into a concise research strategy. Preserve essential versus desirable criteria. Suggest adjacent job titles and sectors only where professionally plausible. Do not invent candidate counts, named people, compensation, or factual claims about companies. Compensation evidence must be classified only as Verified when supported by a reliable source, Estimated when a clearly identified estimate exists, or Not evidenced; never infer compensation from title or seniority. Geography is a ranking and research factor, not an automatic exclusion unless the user explicitly makes it a hard requirement: classify profiles as Within target area, Outside target area, or Location uncertain. Separate true hard exclusions from research flags requiring consultant judgement. Avoid discriminatory or protected-characteristic criteria."}]},
   {role:"user",content:[{type:"input_text",text:JSON.stringify(c)}]}
  ],text:{format:{type:"json_schema",name:"search_strategy",strict:true,schema}}});
  const parsed=JSON.parse(response.output_text); console.log(`[AI STRATEGY] ${tag} success`); res.json(parsed);
 }catch(err){const safe=safeError(err);console.error(`[AI STRATEGY] ${tag} failure:`,JSON.stringify(safe));const pub=publicError(err);res.status(safe.status&&Number.isInteger(safe.status)?safe.status:502).json({error:pub.message,category:pub.category});}
});

app.post("/api/search/interpret", async (req, res) => {
  const requestTag = `interpret-${Date.now().toString(36)}`;
  const brief = String(req.body?.brief || "").trim();
  console.log(`[AI DIAG] ${requestTag} received /api/search/interpret; model=${model}; key_configured=${hasOpenAI}; brief_chars=${brief.length}`);
  if (!brief) return res.status(400).json({ error: "Search brief is empty.", category: "input", request_tag: requestTag });
  if (!openai) return res.status(503).json({ error: "OpenAI is not configured on the server.", category: "configuration", request_tag: requestTag });
  const schema = { type:"object", additionalProperties:false, properties:{ function:{type:"string"}, seniority:{type:"string",enum:["Manager","Director","Head of","C-Suite",""]}, locations:{type:"array",items:{type:"string"}}, radius_miles:{type:["integer","null"]}, sectors:{type:"array",items:{type:"string"}}, compensation_min:{type:["integer","null"]}, compensation_max:{type:["integer","null"]}, employment_types:{type:"array",items:{type:"string"}}, essential:{type:"array",items:{type:"string"}}, desirable:{type:"array",items:{type:"string"}}, exclude_companies:{type:"array",items:{type:"string"}}, exclude_sectors:{type:"array",items:{type:"string"}} }, required:["function","seniority","locations","radius_miles","sectors","compensation_min","compensation_max","employment_types","essential","desirable","exclude_companies","exclude_sectors"] };
  try {
    const response = await openai.responses.create({ model, reasoning:{effort:"low"}, input:[
      {role:"system",content:[{type:"input_text",text:"Convert executive-search briefs into structured recruitment criteria. IMPORTANT: function is the professional discipline only (for example Human Resources, Finance, Operations, Commercial, Technology), never a job title. Put level only in seniority. Thus HR Director => function Human Resources and seniority Director. Extract only stated or clearly implied criteria. Use GBP numeric annual compensation when supplied. Do not invent exclusions."}]},
      {role:"user",content:[{type:"input_text",text:brief}]}
    ], text:{format:{type:"json_schema",name:"search_criteria",strict:true,schema}} });
    const raw=response.output_text; if(!raw) throw new Error("OpenAI returned no output_text.");
    const parsed=JSON.parse(raw); console.log(`[AI DIAG] ${requestTag} success; response_id=${response.id||"n/a"}; output_chars=${raw.length}`); return res.json(parsed);
  } catch(err) { const safe=safeError(err); console.error(`[AI DIAG] ${requestTag} OpenAI failure:`,JSON.stringify(safe)); const pub=publicError(err); return res.status(safe.status&&Number.isInteger(safe.status)?safe.status:502).json({error:pub.message,category:pub.category,request_tag:requestTag}); }
});

const titleAliases = (fn, seniority) => {
  const f=String(fn||"").toLowerCase(), s=String(seniority||"").toLowerCase();
  if (f.includes("human") || f === "hr" || f.includes("people")) {
    if (s.includes("director")) return ["hr director","human resources director","people director","director of human resources","director of people","group hr director","group people director","regional hr director"];
    if (s.includes("head")) return ["head of hr","head of human resources","head of people","people lead"];
    if (s.includes("manager")) return ["hr manager","human resources manager","people manager"];
    if (s.includes("c-suite")) return ["chief people officer","chief human resources officer","chief people & culture officer"];
  }
  return [[fn,seniority].filter(Boolean).join(" ").trim(), fn].filter(Boolean);
};
const normaliseLinkedIn = u => !u ? "" : (String(u).startsWith("http") ? String(u) : `https://${String(u).replace(/^\/+/,"")}`);
const pdlEvidence = (p, criteria) => {
  const ev=[]; const title=String(p.job_title||"").toLowerCase(); const industry=String(p.industry||p.job_company_industry||"").toLowerCase();
  if (criteria.seniority && title.includes(String(criteria.seniority).toLowerCase())) ev.push(`Verified · ${criteria.seniority} seniority`);
  if (p.job_title) ev.push(`Verified · Current title: ${p.job_title}`);
  if (p.industry || p.job_company_industry) ev.push(`Verified · Industry: ${p.industry||p.job_company_industry}`);
  if (p.linkedin_url) ev.push("Verified · LinkedIn profile URL available");
  if (criteria.sector && industry && industry.includes(String(criteria.sector).toLowerCase())) ev.push(`Verified · ${criteria.sector}`);
  return ev.slice(0,5);
};

app.post("/api/search/external", async (req,res) => {
  const tag=`external-${Date.now().toString(36)}`; const c=req.body||{};
  console.log(`[EXT DIAG] ${tag} external search requested; provider_configured=${hasExternal}; function=${c.function||""}; seniority=${c.seniority||""}; location=${(c.locations||[])[0]||""}`);
  if(!hasExternal) return res.status(503).json({error:"External Market provider is not configured. Add PDL_API_KEY in Render Environment.",category:"configuration"});
  try {
    const must=[]; const should=[]; const mustNot=[]; const titles=titleAliases(c.function,c.seniority);
    if(titles.length) should.push(...titles.map(t=>({match_phrase:{job_title:t}})));
    const loc=(c.locations||[])[0]; if(loc) must.push({match_phrase:{location_name:loc}});
    if(c.sector) must.push({match_phrase:{industry:c.sector}});
    if(Array.isArray(c.exclude_companies)) for(const x of c.exclude_companies) mustNot.push({match_phrase:{job_company_name:x}});
    const query={query:{bool:{must,should,must_not:mustNot,minimum_should_match:should.length?1:0}}};
    const r=await fetch(pdlUrl,{method:"POST",headers:{"Content-Type":"application/json","X-Api-Key":process.env.PDL_API_KEY},body:JSON.stringify({query,size:externalLimit,dataset:"resume",titlecase:true})});
    const text=await r.text(); let data={}; try{data=JSON.parse(text)}catch{}
    if(!r.ok){ console.error(`[EXT DIAG] ${tag} PDL failure status=${r.status}; body=${text.slice(0,700)}`); return res.status(r.status).json({error:data?.error?.message||data?.message||`People Data Labs request failed (HTTP ${r.status}).`,category:"external_provider",provider:"People Data Labs"}); }
    const people=Array.isArray(data.data)?data.data:[];
    const candidates=people.map(p=>({ provider_id:p.id||"", name:p.full_name||[p.first_name,p.last_name].filter(Boolean).join(" ")||"Profile", role:p.job_title||"", company:p.job_company_name||"", sector:p.industry||p.job_company_industry||"", location:p.location_name||p.location_locality||p.location_region||p.location_country||"", linkedin_url:normaliseLinkedIn(p.linkedin_url), profile_url:normaliseLinkedIn(p.linkedin_url), score:null, evidence:pdlEvidence(p,c), data_source:"People Data Labs", last_verified:p.job_last_verified||"" }));
    console.log(`[EXT DIAG] ${tag} success; returned=${candidates.length}; total=${data.total||"n/a"}`);
    return res.json({candidates,provider:"People Data Labs",live:true,total:data.total??candidates.length,notes:[c.radius?`Requested radius ${c.radius}; V4.3 currently uses provider location matching rather than exact radius geofencing.`:null,"LinkedIn links are provider-supplied profile URLs; Hennessey Platform does not scrape LinkedIn."].filter(Boolean)});
  } catch(err){console.error(`[EXT DIAG] ${tag} unexpected failure: ${err?.message||err}`);return res.status(502).json({error:"External Market request failed. See Render logs for diagnostic detail.",category:"external_provider"});}
});

const port=Number(process.env.PORT)||3001;
app.listen(port,"0.0.0.0",()=>console.log(`Hennessey Platform V${VERSION} listening on 0.0.0.0:${port}; OpenAI=${hasOpenAI}; model=${model}; External=${hasExternal}`));
