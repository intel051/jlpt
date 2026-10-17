import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler,{validateExample} from '../api/example.js';
const valid={sentence:'状況を把握する。',translation:'상황을 파악하다.',tokens:[{text:'状況',reading:'じょうきょう'},{text:'を',reading:''},{text:'把握',reading:'はあく'},{text:'する。',reading:''}]};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.body=v;return this}});
test('furigana tokens must match the complete sentence',()=>{
 assert.equal(validateExample(valid).example_jp,valid.sentence);
 assert.throws(()=>validateExample({...valid,sentence:'違う文。'}));
 assert.throws(()=>validateExample({...valid,tokens:valid.tokens.map(t=>({...t,reading:''}))}));
});
test('server handles configuration, auth, success and provider failures',async()=>{
 const oldFetch=globalThis.fetch;
 const prior={...process.env};
 try{
 delete process.env.GEMINI_API_KEY;delete process.env.GEMINI_MODEL;delete process.env.APP_ACCESS_TOKEN;
 const req={method:'POST',headers:{host:'app.test',origin:'https://app.test'},body:{word:'把握',reading:'はあく'}};
 let res=response();await handler({...req,method:'GET'},res);assert.equal(res.code,405);
 res=response();await handler(req,res);assert.equal(res.code,503);
 process.env.GEMINI_API_KEY='test-only';process.env.GEMINI_MODEL='test-model';process.env.APP_ACCESS_TOKEN='private';
 res=response();await handler(req,res);assert.equal(res.code,401);
 req.headers['x-app-token']='private';
 let calls=0;
 globalThis.fetch=async(url,opts)=>{calls++;assert.equal(opts.headers['x-goog-api-key'],'test-only');assert.ok(!url.includes('test-only'));return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(valid)}]}}]})}};
 res=response();await handler(req,res);assert.equal(res.code,200);assert.equal(res.body.example_tokens[0].reading,'じょうきょう');assert.equal(calls,1);
 res=response();await handler({...req,body:{word:'a'.repeat(81)}},res);assert.equal(res.code,400);assert.equal(calls,1);
 globalThis.fetch=async()=>({ok:false,status:429});
 res=response();await handler(req,res);assert.equal(res.code,429);
 globalThis.fetch=async()=>({ok:true,json:async()=>({candidates:[{finishReason:'MAX_TOKENS'}]})});
 res=response();await handler(req,res);assert.equal(res.code,502);
 }finally{globalThis.fetch=oldFetch;for(const k of ['GEMINI_API_KEY','GEMINI_MODEL','APP_ACCESS_TOKEN']){if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k]}}
});
