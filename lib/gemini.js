function failure(status,publicMessage){return Object.assign(new Error(publicMessage),{status,publicMessage});}
function schemaForGemini(schema){
 const result={...schema,type:schema.type.toUpperCase()};
 if(schema.properties)result.properties=Object.fromEntries(Object.entries(schema.properties).map(([key,value])=>[key,schemaForGemini(value)]));
 if(schema.items)result.items=schemaForGemini(schema.items);
 return result;
}
export async function geminiJSON(instructions,input,schema){
 if(!process.env.GEMINI_API_KEY)throw failure(503,'Vercel에 GEMINI_API_KEY를 설정해 주세요.');
 const model=(process.env.GEMINI_MODEL||'gemini-3.5-flash-lite').trim();
 if(!/^[a-zA-Z0-9._-]+$/.test(model))throw failure(503,'GEMINI_MODEL에는 모델 ID만 입력해 주세요.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{
 method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
 body:JSON.stringify({systemInstruction:{parts:[{text:instructions}]},contents:[{role:'user',parts:[{text:JSON.stringify(input)}]}],generationConfig:{responseMimeType:'application/json',responseSchema:schemaForGemini(schema),maxOutputTokens:4096}})
 });
 if(!response.ok){
 if(response.status===429)throw failure(429,'Gemini 요청 한도에 도달했습니다. 수집을 중단했습니다. Google AI Studio에서 한도를 확인하고 나중에 다시 시도해 주세요.');
 throw failure(502,'Gemini 호출에 실패했습니다. 키와 모델 설정을 확인해 주세요.');
 }
 const data=await response.json(),candidate=data.candidates?.[0];
 if(candidate?.finishReason!=='STOP')throw failure(502,'완성된 응답을 받지 못했습니다. 다시 시도해 주세요.');
 const text=candidate.content?.parts?.filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('');
 try{return JSON.parse(text)}catch{throw failure(502,'응답 형식이 올바르지 않습니다.')}
 }catch(e){
 if(e.status)throw e;
 throw failure(e.name==='AbortError'?504:502,e.name==='AbortError'?'생성 시간이 초과됐습니다. 다시 시도해 주세요.':'Gemini 연결에 실패했습니다.');
 }finally{clearTimeout(timer)}
}
