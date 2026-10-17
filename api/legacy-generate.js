// Compatibility proxy for the preserved Firebase learning screen.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 if(!process.env.GEMINI_API_KEY||!process.env.GEMINI_MODEL)return res.status(503).json({error:'Set GEMINI_API_KEY and GEMINI_MODEL'});
 const body=req.body;
 if(!body||!Array.isArray(body.contents)||JSON.stringify(body).length>24000)return res.status(400).json({error:'Invalid input'});
 try{const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(process.env.GEMINI_MODEL)+':generateContent',{method:'POST',signal:AbortSignal.timeout(45000),headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify({contents:body.contents,generationConfig:{responseMimeType:'application/json',maxOutputTokens:4096}})});if(!r.ok)return res.status(502).json({error:'Gemini request failed'});return res.status(200).json(await r.json())}catch{return res.status(502).json({error:'Gemini connection failed'})}
}
