import {test} from 'node:test';
import assert from 'node:assert/strict';
import example from '../api/example.js';
import translate from '../api/translate.js';
const response=()=>({setHeader(){},status(n){this.code=n;return this},json(v){this.body=v;return this}});
test('Gemini translation and example validation, auth, failures and timeouts',async()=>{
 const oldFetch=globalThis.fetch,prior={...process.env};
 try{
 process.env.GEMINI_API_KEY='test-only';process.env.OPENAI_API_KEY='ignored';delete process.env.GEMINI_MODEL;delete process.env.APP_ACCESS_TOKEN;
 const req={method:'POST',headers:{host:'app.test',origin:'https://app.test'},body:{word:'把握',reading:'はあく',meaning_en:'grasp'}};
 let output={meaning_kr:'파악; 이해'};
 globalThis.fetch=async(url,opts)=>{
 assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');assert.equal(opts.headers['x-goog-api-key'],'test-only');assert.equal(opts.headers.Authorization,undefined);
 const body=JSON.parse(opts.body);assert.equal(body.generationConfig.responseMimeType,'application/json');
 return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(output)}]}}]})};
 };
 let res=response();await translate(req,res);assert.equal(res.code,200);assert.equal(res.body.translation_source,'gemini');
 output={sentence:'把握する。',translation:'파악하다.',tokens:[{text:'把握',reading:'はあく'},{text:'する。',reading:''}]};
 res=response();await example(req,res);assert.equal(res.code,200);assert.equal(res.body.example_source,'gemini');
 output.tokens[0].reading='';res=response();await example(req,res);assert.equal(res.code,502);
 output={meaning_kr:'English only'};res=response();await translate(req,res);assert.equal(res.code,502);
 process.env.APP_ACCESS_TOKEN='private';res=response();await translate(req,res);assert.equal(res.code,401);delete process.env.APP_ACCESS_TOKEN;
 res=response();await translate({...req,headers:{...req.headers,origin:'https://other.test'}},res);assert.equal(res.code,403);
 res=response();await translate({...req,body:{word:'a'.repeat(81)}},res);assert.equal(res.code,400);
 globalThis.fetch=async()=>({ok:false,status:429});res=response();await translate(req,res);assert.equal(res.code,429);
 globalThis.fetch=async()=>({ok:true,json:async()=>({status:'incomplete',output:[]})});res=response();await example(req,res);assert.equal(res.code,502);
 globalThis.fetch=async()=>{throw Object.assign(new Error('timeout'),{name:'AbortError'})};res=response();await translate(req,res);assert.equal(res.code,504);
 delete process.env.GEMINI_API_KEY;res=response();await translate(req,res);assert.equal(res.code,503);
 }finally{globalThis.fetch=oldFetch;for(const key of ['OPENAI_API_KEY','GEMINI_API_KEY','GEMINI_MODEL','APP_ACCESS_TOKEN']){if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key]}}
});
