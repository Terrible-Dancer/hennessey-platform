import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
dotenv.config();
const app=express(); app.use(cors()); app.use(express.json({limit:"250kb"})); app.use(express.static("."));
const openai=process.env.OPENAI_API_KEY?new OpenAI({apiKey:process.env.OPENAI_API_KEY}):null;

const schema={type:"object",additionalProperties:false,properties:{
 function:{type:"string"},seniority:{type:"string",enum:["Manager","Director","Head of","C-Suite",""]},
 locations:{type:"array",items:{type:"string"}},radius_miles:{type:["number","null"]},
 sectors:{type:"array",items:{type:"string"}},compensation_min:{type:["number","null"]},compensation_max:{type:["number","null"]},
 employment_types:{type:"array",items:{type:"string"}},essential:{type:"array",items:{type:"string"}},
 desirable:{type:"array",items:{type:"string"}},exclude_companies:{type:"array",items:{type:"string"}},exclude_sectors:{type:"array",items:{type:"string"}}
},required:["function","seniority","locations","radius_miles","sectors","compensation_min","compensation_max","employment_types","essential","desirable","exclude_companies","exclude_sectors"]};

app.get("/api/health",(req,res)=>res.json({ok:true,openai_configured:!!process.env.OPENAI_API_KEY,external_provider_configured:!!process.env.PDL_API_KEY}));

app.post("/api/search/interpret",async(req,res)=>{
 if(!openai)return res.status(503).json({error:"OPENAI_API_KEY is not configured"});
 try{
  const response=await openai.responses.create({
   model:process.env.OPENAI_MODEL||"gpt-6-luna",store:false,
   input:[{role:"system",content:"Extract executive-search criteria. Do not invent missing requirements. Return empty strings, empty arrays, or null where absent."},{role:"user",content:req.body.brief||""}],
   text:{format:{type:"json_schema",name:"hennessey_search",strict:true,schema}}
  });
  res.json(JSON.parse(response.output_text));
 }catch(e){res.status(500).json({error:"Interpretation failed",detail:e.message})}
});

// Provider adapter. This route is production-safe: the browser never receives the API key.
// PDL_QUERY_MODE defaults to a conservative Elasticsearch-style query.
// Review your licensed provider account/field availability before production deployment.
app.post("/api/search/external",async(req,res)=>{
 if(!process.env.PDL_API_KEY)return res.status(503).json({error:"PDL_API_KEY is not configured"});
 try{
   const c=req.body||{};
   const must=[];
   if(c.function) must.push({match:{"job_title_role":String(c.function).toLowerCase()}});
   if(c.seniority) must.push({match:{"job_title_levels":String(c.seniority).toLowerCase()}});
   if(c.locations?.[0]) must.push({match:{"location_name":c.locations[0]}});
   const body={query:{bool:{must}},size:Number(process.env.EXTERNAL_RESULT_LIMIT||20)};
   const r=await fetch(process.env.PDL_SEARCH_URL||"https://api.peopledatalabs.com/v5/person/search",{
     method:"POST",headers:{"Content-Type":"application/json","X-Api-Key":process.env.PDL_API_KEY},body:JSON.stringify(body)
   });
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json({error:"External provider request failed",provider:data});
   const people=(data.data||[]).map(p=>({
     name:p.full_name||[p.first_name,p.last_name].filter(Boolean).join(" "),
     role:p.job_title||"",company:p.job_company_name||"",sector:p.job_company_industry||"",
     location:p.location_name||"",profile_url:p.linkedin_url||"",
     evidence:[p.job_title,p.job_company_industry,p.location_name].filter(Boolean),
     score:0
   }));
   res.json({candidates:people,total:data.total??people.length});
 }catch(e){res.status(500).json({error:"External search failed",detail:e.message})}
});
const port=Number(process.env.PORT)||3001;
app.listen(port,"0.0.0.0",()=>console.log(`Hennessey Platform V4.2.2 listening on 0.0.0.0:${port}`));
