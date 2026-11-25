import {chromium,webkit} from 'playwright';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.RDEV_BASE??'http://127.0.0.1:5188';
const fixture=JSON.parse(readFileSync(new URL('../protocol/fixtures/e2e-session.json',import.meta.url)));
const protocolURL='/@fs'+new URL('../protocol/src/index.ts',import.meta.url).pathname;
for(const [engine,name] of [[chromium,'chromium'],[webkit,'webkit']]){
 const browser=await engine.launch();
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route('**/__enrollment_check__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script type="module" src="/@vite/client"></script></body></html>'}));
  const page=await context.newPage();await page.goto(base+'/__enrollment_check__');
  await page.evaluate(async({fx,protocolURL})=>{
   const p=await import(protocolURL),{ClientE2EIdentity}=await import('/src/client/e2e-identity.ts'),{BrowserDeviceAdoption}=await import('/src/client/browser-device-adoption.ts'),{parsePairing}=await import('/src/client/pairing.ts');
   const hex=s=>Uint8Array.from(s.match(/../g)??[],x=>parseInt(x,16));
   class Memory{constructor(value=null){this.value=value;}async read(){return this.value;}async write(value){this.value=value;return true;}async delete(){this.value=null;return true;}}
   const h=fx.devices.H,n=fx.devices.N,trust=new Memory();
   const identity=new ClientE2EIdentity(new Memory(p.encodeInstallation({keys:p.deviceKeys(hex(n.signing_private_key),hex(n.noise_private_key)),rendezvousSeed:new Uint8Array(32).fill(5)})),trust,{rpId:fx.rp_id,rpName:'Test'},fx.allowed_origins[0]);
   let handlers,issuer;window.__ack=false;window.__waiting=false;
   const adoption=new BrowserDeviceAdoption({identity,register:async()=>{},open:(_room,callbacks)=>{
    handlers=callbacks;queueMicrotask(()=>callbacks.onReady());
    return {close(){},send(ct,peer,mode){queueMicrotask(()=>{
     const r=issuer.receive(ct,mode);if(!r.ok)throw Error(JSON.stringify(r));
     if(r.value.kind==='reply')for(const reply of r.value.cts)callbacks.onE2E(reply,peer);
     if(r.value.kind==='awaiting-issuance'){
      window.__waiting=true;
      window.__release=()=>{const issued=issuer.issue(hex(fx.adoption.browser_bundle_for_N));if(!issued.ok)throw Error('issue');callbacks.onE2E(issued.value.ct,peer);};
     }
     if(r.value.kind==='signalling'){window.__ack=JSON.parse(new TextDecoder().decode(r.value.inner)).t==='adopted'&&trust.value!==null;}
    });}};
   }});
   window.__adoption=adoption.start({onReady:async url=>{
    const seed=new URLSearchParams(new URL(url).hash.slice(1)).get('adopt'),room=await parsePairing(seed);
    issuer=new p.E2EHostGate({roomCode:room.code,device:hex(h.descriptor),bundle:hex(h.bundle),noisePrivateKey:hex(h.noise_private_key),trustedRootId:hex(fx.root_id),policy:{rpId:fx.rp_id,allowedOrigins:fx.allowed_origins},route:fx.routes.H,pairingPsk:room.psk});handlers.onPeerJoined('issuer');
   }});
   window.__identity=identity;
  },{fx:fixture,protocolURL});
  await page.waitForFunction(()=>window.__waiting);
  const other=await context.newPage();await other.goto(base+'/__enrollment_check__');
  const blocked=await other.evaluate(async()=>{
   const {BrowserDeviceAdoption}=await import('/src/client/browser-device-adoption.ts');let entered=false;
   const a=new BrowserDeviceAdoption({identity:{load:async()=>{entered=true;throw Error('must not enter');}},register:async()=>{entered=true;},open:()=>{throw Error('must not open');}});
   return {result:await a.start({onReady(){}}),entered};
  });
  assert.deepEqual(blocked,{result:{ok:false,reason:'another-tab'},entered:false});
  await page.evaluate(()=>window.__release());
  const result=await page.evaluate(async()=>({result:await window.__adoption,status:(await window.__identity.status()).kind}));
  assert.equal(result.result.ok,true);assert.equal(result.status,'ready');await page.waitForFunction(()=>window.__ack);
  const locks=await other.evaluate(async()=>(await navigator.locks.query()).held.filter(l=>l.name==='shellkite-browser-enrollment').length);
  assert.equal(locks,0);
  await context.close();console.log(`PASS ${name}: encrypted enrollment, durable ACK, real cross-tab lock, released lock`);
 }finally{await browser.close();}
}
