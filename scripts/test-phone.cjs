const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function harness({file='[]', replies=[], token=true, downloadError=false}={}) {
  let downloaded=false, writes=0; const requests=[];
  const fm={documentsDirectory:()=>'/docs',joinPath:(a,b)=>a+'/'+b,fileExists:()=>file!==null,
    downloadFileFromiCloud:async()=>{await Promise.resolve(); if(downloadError) throw Error('iCloud unavailable'); downloaded=true;},
    readString:()=>{assert.ok(downloaded,'download must finish first'); return file;},
    writeString:(_,value)=>{writes++;file=value;}};
  class Request {constructor(url){this.url=url;} async loadString(){requests.push(this);const r=replies.shift();if(!r)throw Error('Unexpected request');this.response={statusCode:r.status};return JSON.stringify(r.data);} async loadJSON(){return JSON.parse(await this.loadString());}}
  const context={module:{exports:{}},Request,FileManager:{iCloud:()=>fm},Keychain:{contains:()=>token,get:()=> 'test-token'},Data:{fromString:s=>({toBase64String:()=>Buffer.from(s).toString('base64')}),fromBase64String:s=>({toRawString:()=>Buffer.from(s,'base64').toString()})}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../RSFData.js'),'utf8'),context);
  return {api:context.module.exports,requests,get writes(){return writes;},get file(){return JSON.parse(file);}};
}
const sample=(t,count)=>({t,count,pct:Math.round(count/140*1000)/10});
const remote=(items,sha='old')=>({status:200,data:{sha,encoding:'base64',content:Buffer.from(JSON.stringify(items)).toString('base64')}});
test('awaits iCloud before appending and preserves old data',async()=>{const h=harness({file:JSON.stringify([sample(1,10)])});await h.api.recordSample(20);assert.equal(h.file.length,2);});
test('failed download and corrupt file never overwrite history',async()=>{for(const options of [{downloadError:true},{file:'bad json'}]){const h=harness(options);await assert.rejects(h.api.recordSample(20));assert.equal(h.writes,0);}});
test('HTTP auth errors do not count as upload success',async()=>{const h=harness({replies:[remote([]),{status:401,data:{message:'Bad credentials'}}]});const r=await h.api.pushHistoryToGitHub([sample(1,10)]);assert.equal(r.ok,false);assert.match(r.error,/401/);});
test('failed remote read never proceeds to write',async()=>{const h=harness({replies:[{status:403,data:{message:'Forbidden'}}]});assert.equal((await h.api.pushHistoryToGitHub([sample(1,10)])).ok,false);assert.equal(h.requests.length,1);});
test('merge retries conflicts and retains concurrent readings',async()=>{const h=harness({replies:[remote([sample(1,10)]),{status:409,data:{}},remote([sample(1,10),sample(3,30)],'new'),{status:200,data:{commit:{sha:'commit'}}}]});assert.equal((await h.api.pushHistoryToGitHub([sample(2,20)])).ok,true);const body=JSON.parse(h.requests[3].body);assert.equal(body.sha,'new');assert.deepEqual(JSON.parse(Buffer.from(body.content,'base64').toString()).map(e=>e.t),[1,2,3]);});
test('missing token is explicit and makes no request',async()=>{const h=harness({token:false});assert.equal((await h.api.pushHistoryToGitHub([])).skipped,true);assert.equal(h.requests.length,0);});
test('invalid live count is never recorded',async()=>{const h=harness({replies:[{status:200,data:{}}]});await assert.rejects(h.api.fetchCount());await assert.rejects(h.api.recordSample(null));assert.equal(h.writes,0);});
test('unchanged history does not create another commit',async()=>{const entries=[sample(1,10)];const h=harness({replies:[remote(entries)]});assert.equal((await h.api.pushHistoryToGitHub(entries)).ok,true);assert.equal(h.requests.length,1);});
