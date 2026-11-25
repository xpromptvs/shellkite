import {it,expect,vi} from 'vitest';
import fixture from '../../protocol/fixtures/e2e-session.json';
import {E2EClientGate,deviceKeys,encodeInstallation,encodeTrustRecord,emptyTrustRecord,PublicationStatus} from '@rdev/protocol';
import {ClientE2EIdentity} from '../src/client/e2e-identity';
import {runAdoption} from '../src/client/adopt';
import {parsePairing} from '../src/client/pairing';
import {base64urlEncode,base64urlDecode} from '../src/lib/base64url';
const fx=fixture as any,hex=(s:string)=>Uint8Array.from(s.match(/../g)??[],x=>parseInt(x,16));
const carrier='AAAAAAAAAAAAAAAAAAAAAA';
const request={purpose:'shellkite-browser' as const,origin:'https://shellkite.xpromptvs.com' as const,requestId:'request-123'};
const memory=(value:Uint8Array|null)=>({read:async()=>value,write:async(bytes:Uint8Array)=>{value=bytes;return true;},delete:async()=>{value=null;return true;}});
async function flow(mismatch=false,proof=true){
 const h=fx.devices.H,n=fx.devices.N,pairing=(await parsePairing(carrier))!;
 const identity=new ClientE2EIdentity(memory(encodeInstallation({keys:deviceKeys(hex(h.signing_private_key),hex(h.noise_private_key))!,rendezvousSeed:new Uint8Array(32).fill(6)})),memory(encodeTrustRecord({...emptyTrustRecord(),root:hex(fx.root),bundle:hex(h.bundle),publicationStatus:PublicationStatus.Unconfirmed})),{rpId:fx.rp_id,rpName:'Test'},fx.allowed_origins[0]);
 const recipient=new E2EClientGate({roomCode:pairing.code,device:new Uint8Array(),bundle:new Uint8Array(),noisePrivateKey:hex(n.noise_private_key),signingPrivateKey:hex(n.signing_private_key),trustedRootId:null,policy:{rpId:fx.rp_id,allowedOrigins:fx.allowed_origins},mode:'pair',pairingPsk:pairing.psk,devicePublicKeys:{signing:hex(n.signing_public_key),noise:hex(n.noise_public_key)},appHello:()=>new TextEncoder().encode(JSON.stringify({...request,requestId:mismatch?'wrong-request':request.requestId}))});
 const confirm=vi.fn(async()=>true),issue=vi.fn(async()=>({ok:true as const,bundle:hex(fx.adoption.browser_bundle_for_N)})),states:unknown[]=[];
 const result=await runAdoption(carrier,{identity,origin:fx.allowed_origins[0],enrollmentRequest:request,verifyBrowserOrigin:proof?async()=>true:undefined,confirm,issue,state:s=>states.push(s),answerMs:1000,ackMs:1000,connect:(_url,_token,handlers)=>{
  queueMicrotask(()=>{const opening=recipient.start();if(!opening.ok)throw Error('opening');handlers.onE2E(base64urlEncode(opening.value.ct),undefined,opening.value.mode);});
  return {close(){},send(ct){queueMicrotask(()=>{
   const response=recipient.receive(base64urlDecode(ct)!);if(!response.ok)throw Error(JSON.stringify(response));
   if(response.value.kind==='reply')for(const reply of response.value.cts)handlers.onE2E(base64urlEncode(reply));
   if(recipient.maySignal){const ack=recipient.seal(new TextEncoder().encode('{"t":"adopted"}'));if(ack.ok)handlers.onE2E(base64urlEncode(ack.value));}
  });}};
 }});
 return {result,confirm,issue,states};
}
it('rejects a different authenticated enrollment request before user confirmation or signing',async()=>{
 const f=await flow(true);expect(f.result).toMatchObject({kind:'failed',reason:'enrollment-request-mismatch'});expect(f.confirm).not.toHaveBeenCalled();expect(f.issue).not.toHaveBeenCalled();
});
it('names the browser origin and asks for CONNECT only after explicit confirmation',async()=>{
 const f=await flow();expect(f.result.kind).toBe('added');expect(f.confirm).toHaveBeenCalledOnce();expect(f.issue).toHaveBeenCalledWith(expect.objectContaining({capabilities:1,binding:expect.objectContaining({kind:'remote'})}));
 expect(f.states).toContainEqual(expect.objectContaining({kind:'confirm',browserOrigin:request.origin}));
});

it('refuses a self-asserted browser origin before consent or signing',async()=>{const f=await flow(false,false);expect(f.result).toMatchObject({kind:'failed',reason:'browser-origin-unverified'});expect(f.confirm).not.toHaveBeenCalled();expect(f.issue).not.toHaveBeenCalled();});

it('malformed browser enrollment cannot fall back to a host grant',async()=>{
 const load=vi.fn(),connect=vi.fn(),confirm=vi.fn(),issue=vi.fn();
 const result=await runAdoption(carrier,{identity:{load} as any,enrollmentRequired:true,origin:'https://app.xpromptvs.ai',connect,state:()=>{},confirm,issue});
 expect(result).toMatchObject({kind:'failed',reason:'invalid-browser-enrollment'});expect(load).not.toHaveBeenCalled();expect(connect).not.toHaveBeenCalled();expect(issue).not.toHaveBeenCalled();
});
