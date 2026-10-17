export function strictSchema(schema){
 const result={...schema,type:schema.type.toLowerCase()};
 if(schema.properties){result.properties=Object.fromEntries(Object.entries(schema.properties).map(([k,v])=>[k,strictSchema(v)]));result.additionalProperties=false;}
 if(schema.items)result.items=strictSchema(schema.items);
 return result;
}
function failure(status,publicMessage){return Object.assign(new Error(publicMessage),{status,publicMessage});}
export async function openaiJSON(instructions,input,name,schema){
 if(!process.env.OPENAI_API_KEY)throw failure(503,'Vercel에 OPENAI_API_KEY를 설정해 주세요.');
 const model=(process.env.OPENAI_MODEL||'gpt-5.6-luna').trim();
 if(!/^[a-zA-Z0-9._-]+$/.test(model))throw failure(503,'OPENAI_MODEL에는 모델 ID만 입력해 주세요.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{
 const response=await fetch('https://api.openai.com/v1/responses',{
 method:'POST',signal:controller.signal,
 headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.OPENAI_API_KEY},
 body:JSON.stringify({model,...(model.startsWith('gpt-5.6')?{reasoning:{effort:'low'}}:{}),store:false,instructions,input:JSON.stringify(input),max_output_tokens:4096,
 text:{format:{type:'json_schema',name,strict:true,schema}}})
 });
 if(!response.ok)throw failure(response.status===429?429:502,response.status===429?'OpenAI 사용 한도 또는 잔액을 확인해 주세요.':'OpenAI 호출에 실패했습니다. 서버의 키와 모델 설정을 확인해 주세요.');
 const data=await response.json();
 if(data.status!=='completed')throw failure(502,'완성된 응답을 받지 못했습니다. 다시 시도해 주세요.');
 const parts=(data.output||[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]);
 if(parts.some(x=>x.type==='refusal'))throw failure(502,'이 입력으로는 결과를 생성하지 못했습니다.');
 const text=parts.filter(x=>x.type==='output_text').map(x=>x.text).join('');
 try{return JSON.parse(text)}catch{throw failure(502,'응답 형식이 올바르지 않습니다.')}
 }catch(e){
 if(e.status)throw e;
 throw failure(e.name==='AbortError'?504:502,e.name==='AbortError'?'생성 시간이 초과됐습니다. 다시 시도해 주세요.':'OpenAI 연결에 실패했습니다.');
 }finally{clearTimeout(timer)}
}

