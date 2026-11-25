import {describe,it,expect,vi} from 'vitest';
import fixture from '../../protocol/fixtures/e2e-session.json';
import {E2EHostGate,E2EClientGate,deviceKeys,encodeInstallation,emptyTrustRecord,encodeTrustRecord,parseRoot,root as rootDescriptor,type InstallationBackend} from '@rdev/protocol';
import {ClientE2EIdentity} from '../src/client/e2e-identity';
import {parsePairing} from '../src/client/pairing';
import {BrowserDeviceAdoption,type RecipientHandlers} from '../src/client/browser-device-adoption';
const fx=fixture as any,hex=(s:string)=>Uint8Array.from(s.match(/../g)??[],x=>parseInt(x,16));
class Memory implements InstallationBackend {
 value:Uint8Array|null=null;fail=false;writes=0;
 constructor(value:Uint8Array|null=null){this.value=value;}
 async read(){return this.value;}async write(value:Uint8Array){this.writes++;if(this.fail)return false;this.value=value;return true;}async delete(){this.value=null;return true;}
}
async function setup({hold=false,fail=false,wrong=false,wrongAccount=false}={}){
 const n=fx.devices.N,h=fx.devices.H;
 const installation=new Memory(encodeInstallation({keys:deviceKeys(hex(n.signing_private_key),hex(n.noise_private_key))!,rendezvousSeed:new Uint8Array(32).fill(8)}));
 const root=parseRoot(hex(fx.root))!;
 const foreign=rootDescriptor(root.rpId,new Uint8Array([1,2,3,4]),root.publicKey)!;
 const trust=new Memory(wrongAccount?encodeTrustRecord({...emptyTrustRecord(),root:foreign}):null),identity=new ClientE2EIdentity(installation,trust,{rpId:fx.rp_id,rpName:'Test'},fx.allowed_origins[0]);
 await identity.load();trust.fail=fail;
 let handlers!:RecipientHandlers,issuer!:E2EHostGate,issue=()=>{};let ack:any=null,ackAfterWrite=false;
 const ready=vi.fn(async(url:string)=>{
  const carrier=new URLSearchParams(new URL(url).hash.slice(1)).get('adopt')!;
  const pairing=(await parsePairing(carrier))!;
  issuer=new E2EHostGate({roomCode:pairing.code,device:hex(h.descriptor),bundle:hex(h.bundle),noisePrivateKey:hex(h.noise_private_key),trustedRootId:hex(fx.root_id),policy:{rpId:fx.rp_id,allowedOrigins:fx.allowed_origins},route:fx.routes.H,pairingPsk:pairing.psk});
  handlers.onPeerJoined('issuer');
 });
 const adoption=new BrowserDeviceAdoption({identity,register:async()=>{},withLock:async job=>job(),open:(_material,callbacks)=>{
  handlers=callbacks;queueMicrotask(()=>callbacks.onReady());
  return {close(){},send(ct,peer,mode){queueMicrotask(()=>{
   const result=issuer.receive(ct,mode);if(!result.ok)throw Error(JSON.stringify(result));
   if(result.value.kind==='reply')for(const reply of result.value.cts)callbacks.onE2E(reply,peer);
   if(result.value.kind==='awaiting-issuance'){
    issue=()=>{const sent=issuer.issue(hex(wrong?fx.devices.C.bundle:fx.adoption.browser_bundle_for_N));if(sent.ok)callbacks.onE2E(sent.value.ct,peer);else callbacks.onError('issuer-refused');};
    if(!hold)issue();
   }
   if(result.value.kind==='signalling'){ack=JSON.parse(new TextDecoder().decode(result.value.inner));ackAfterWrite=trust.value!==null&&!trust.fail;}
  });}}
 }});
 return {identity,trust,adoption,ready,release:()=>issue(),acked:()=>ack,ackAfterWrite:()=>ackAfterWrite};
}
describe('persistent browser enrollment',()=>{
 it('validates and durably commits before sending the encrypted acknowledgement',async()=>{
  const f=await setup(),result=await f.adoption.start({onReady:f.ready});
  expect(result.ok).toBe(true);await vi.waitFor(()=>expect(f.acked()).toEqual({t:'adopted'}));expect(f.ackAfterWrite()).toBe(true);
  expect((await f.identity.status()).kind).toBe('ready');
 });
 it('cancellation before issuance cannot commit a late grant',async()=>{
  const f=await setup({hold:true}),abort=new AbortController();
  const done=f.adoption.start({onReady:f.ready,signal:abort.signal});await vi.waitFor(()=>expect(f.ready).toHaveBeenCalled());
  await new Promise(r=>setTimeout(r,20));abort.abort();expect(await done).toMatchObject({ok:false,reason:'cancelled'});
  f.release();await new Promise(r=>setTimeout(r,10));expect(f.acked()).toBe(null);expect((await f.identity.status()).kind).not.toBe('ready');
 });
 it('failed storage never sends an adopted acknowledgement',async()=>{
  const f=await setup({fail:true});expect(await f.adoption.start({onReady:f.ready})).toMatchObject({ok:false,reason:'storage'});expect(f.acked()).toBe(null);
 });
 it('a grant for another recipient cannot enroll this installation',async()=>{
  const f=await setup({wrong:true});expect((await f.adoption.start({onReady:f.ready})).ok).toBe(false);expect(f.acked()).toBe(null);
 });
 it('does not replace an existing account with the approving issuer account',async()=>{
  const f=await setup({wrongAccount:true}),before=f.trust.value;
  expect((await f.adoption.start({onReady:f.ready})).ok).toBe(false);
  expect(f.trust.value).toEqual(before);expect(f.acked()).toBe(null);
 });
 it('the saved browser grant can authenticate a desktop-only viewer connection',async()=>{
  const f=await setup();expect((await f.adoption.start({onReady:f.ready})).ok).toBe(true);
  const config=await f.identity.gateConfig('desktop-proof');expect(config).not.toBe(null);
  const client=new E2EClientGate({...config!,scope:'desktopOnly'}),h=fx.devices.H;
  const host=new E2EHostGate({roomCode:'desktop-proof',device:hex(h.descriptor),bundle:hex(h.bundle),noisePrivateKey:hex(h.noise_private_key),trustedRootId:hex(fx.root_id),policy:{rpId:fx.rp_id,allowedOrigins:fx.allowed_origins},route:fx.routes.H});
  const first=client.start();if(!first.ok)throw Error('start');
  const second=host.receive(first.value.ct,first.value.mode);if(!second.ok||second.value.kind!=='reply')throw Error('host');
  const third=client.receive(second.value.cts[0]!);if(!third.ok||third.value.kind!=='reply')throw Error('client');
  expect(host.receive(third.value.cts[0]!).ok).toBe(true);
  const accepted=host.receive(third.value.cts[1]!);if(!accepted.ok||accepted.value.kind!=='reply')throw Error('confirm');
  expect(client.receive(accepted.value.cts[0]!).ok).toBe(true);expect(client.maySignal).toBe(true);expect(host.accessScope).toBe('desktopOnly');
 });
 it('an expired request and another active tab do not open enrollment authority',async()=>{
  const f=await setup({hold:true});expect(await f.adoption.start({onReady:f.ready,timeoutMs:30})).toMatchObject({ok:false,reason:'expired'});
  const identity=f.identity,register=vi.fn(async()=>{}),open=vi.fn();
  const busy=new BrowserDeviceAdoption({identity,register,open,withLock:async()=>null});
  expect(await busy.start({onReady:()=>{}})).toMatchObject({ok:false,reason:'another-tab'});expect(register).not.toHaveBeenCalled();
 });
});
