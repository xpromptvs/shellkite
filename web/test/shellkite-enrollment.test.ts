import {describe,expect,test} from "vitest";
import fixture from "../../protocol/fixtures/e2e-session.json";
import {E2EClientGate,E2EHostGate,verifyBundle} from "@rdev/protocol";
const fx=fixture as any;
const hex=(s:string)=>Uint8Array.from(s.match(/../g)??[],x=>parseInt(x,16));
const policy={rpId:fx.rp_id,allowedOrigins:fx.allowed_origins};
const psk=new Uint8Array(32).fill(0x5a);
const reply=(r:any)=>{expect(r.ok,JSON.stringify(r)).toBe(true);expect(r.value.kind).toBe("reply");return r.value.cts as Uint8Array[];};
function parked(appHello?:Uint8Array){
 const n=fx.devices.N,h=fx.devices.H;
 const recipient=new E2EClientGate({roomCode:"adopt-proof",device:new Uint8Array(),bundle:new Uint8Array(),noisePrivateKey:hex(n.noise_private_key),signingPrivateKey:hex(n.signing_private_key),trustedRootId:null,policy,mode:"pair",pairingPsk:psk,appHello:()=>appHello??new Uint8Array(),devicePublicKeys:{signing:hex(n.signing_public_key),noise:hex(n.noise_public_key)}});
 const issuer=new E2EHostGate({roomCode:"adopt-proof",device:hex(h.descriptor),bundle:hex(h.bundle),noisePrivateKey:hex(h.noise_private_key),trustedRootId:hex(fx.root_id),policy,route:fx.routes.H,pairingPsk:psk});
 const started=recipient.start();if(!started.ok)throw Error("start");
 const [m2]=reply(issuer.receive(started.value.ct,started.value.mode));
 const [m3,confirm]=reply(recipient.receive(m2!));expect(issuer.receive(m3!).ok).toBe(true);
 const parked=issuer.receive(confirm!);expect(parked.ok&&parked.value.kind).toBe("awaiting-issuance");
 return {recipient,issuer};
}
describe("Shellkite cross-origin adoption compatibility proof",()=>{
 test("the issuer can validate the authenticated enrollment request before signing",()=>{
  const request=new TextEncoder().encode(JSON.stringify({purpose:"shellkite-browser",origin:"https://shellkite.xpromptvs.com",requestId:"request-123"}));
  const {issuer}=parked(request);
  expect([...issuer.pendingApplicationHello]).toEqual([...request]);
  expect(issuer.maySignal,"no application admission while waiting for issuance").toBe(false);
 });
 test("a recipient can receive an existing-RP grant without running its own passkey ceremony",()=>{
  const {recipient,issuer}=parked();
  const issued=issuer.issue(hex(fx.adoption.bundle_for_N));if(!issued.ok)throw Error(JSON.stringify(issued));
  expect(recipient.receive(issued.value.ct).ok).toBe(true);
  expect(recipient.acceptedBundle).toEqual(hex(fx.adoption.bundle_for_N));
  const verified=verifyBundle(recipient.acceptedBundle!,{trustedRootId:hex(fx.root_id),policy});
  expect(verified.ok).toBe(true);
  expect(policy.allowedOrigins).not.toContain("https://shellkite.xpromptvs.com");
  expect(verifyBundle(recipient.acceptedBundle!,{trustedRootId:hex(fx.root_id),policy:{rpId:"shellkite.xpromptvs.com",allowedOrigins:["https://shellkite.xpromptvs.com"]}}).ok).toBe(false);
 });
 test("a valid grant for another recipient is refused",()=>{
  const {issuer}=parked();expect(issuer.issue(hex(fx.devices.C.bundle)).ok).toBe(false);
 });
 test("closing the recipient before issuance cannot adopt its returned grant",()=>{
  const {recipient,issuer}=parked();recipient.close();
  const issued=issuer.issue(hex(fx.adoption.bundle_for_N));if(!issued.ok)throw Error("issue");
  expect(recipient.receive(issued.value.ct).ok).toBe(false);expect(recipient.acceptedBundle).toBeNull();
 });
 test("a replayed issuance fails Noise and cannot issue twice",()=>{
  const {recipient,issuer}=parked(),issued=issuer.issue(hex(fx.adoption.bundle_for_N));if(!issued.ok)throw Error("issue");
  expect(recipient.receive(issued.value.ct).ok).toBe(true);
  expect(recipient.receive(issued.value.ct).ok).toBe(false);
  expect(issuer.issue(hex(fx.adoption.bundle_for_N)).ok).toBe(false);
 });
});
