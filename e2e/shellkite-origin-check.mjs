import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.RDEV_BASE??'http://127.0.0.1:5188';
const protocolURL='/@fs'+new URL('../protocol/src/index.ts',import.meta.url).pathname;
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch();try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(!['shellkite.xpromptvs.com','app.xpromptvs.ai'].includes(u.hostname)){await route.abort();return;}
   if(u.pathname==='/__origin_check__'){await route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><button id="open">Authorize</button><script type="module" src="/@vite/client"></script></body></html>'});return;}
   const r=await fetch(base+u.pathname+u.search);await route.fulfill({status:r.status,contentType:r.headers.get('content-type')??undefined,body:Buffer.from(await r.arrayBuffer())});
  });
  const recipient=await context.newPage();await recipient.goto('https://shellkite.xpromptvs.com/__origin_check__');
  await recipient.evaluate(async()=>{
   const {createRecipientOriginProof}=await import('/src/lib/shellkite-origin-proof.ts');
   window.proof=createRecipientOriginProof({purpose:'shellkite-browser',origin:location.origin,requestId:'request-123'},{signing:new Uint8Array(32).fill(1),noise:new Uint8Array(32).fill(2)});
   document.getElementById('open').onclick=()=>window.proof.open('https://app.xpromptvs.ai/__origin_check__?authorize=shellkite#adopt=AAAAAAAAAAAAAAAAAAAAAA&request=request-123');
  });
  const popup=context.waitForEvent('page');await recipient.locator('#open').click();const issuer=await popup;await issuer.waitForLoadState();
  const result=await issuer.evaluate(async protocolURL=>{
   const {verifyBrowserRecipient}=await import('/src/lib/shellkite-origin-proof.ts');
   const {device}=await import(protocolURL);
   const request={purpose:'shellkite-browser',origin:'https://shellkite.xpromptvs.com',requestId:'request-123'};
   const good=device(new Uint8Array(32),new Uint8Array(32).fill(1),new Uint8Array(32).fill(2));
   const bad=device(new Uint8Array(32),new Uint8Array(32).fill(7),new Uint8Array(32).fill(2));
   return {good:await verifyBrowserRecipient(request,good),wrongKeys:await verifyBrowserRecipient(request,bad),stale:await verifyBrowserRecipient({...request,requestId:'stale'},good,{timeoutMs:50})};
  },protocolURL);
  assert.deepEqual(result,{good:true,wrongKeys:false,stale:false});
  const unrelated=await context.newPage();await unrelated.goto('https://app.xpromptvs.ai/__origin_check__');assert.equal(await unrelated.evaluate(async()=>{const {verifyBrowserRecipient}=await import('/src/lib/shellkite-origin-proof.ts');return verifyBrowserRecipient({requestId:'request-123'},new Uint8Array());}),false);
  console.log(`PASS ${name}: real cross-origin exact-opener proof; wrong Noise keys, stale request and missing opener refused`);await context.close();
 }finally{await browser.close();}
}
