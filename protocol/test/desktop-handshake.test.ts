import {describe,expect,test} from "vitest";
import {readFileSync} from "node:fs";
import {E2EClientGate} from "../src/e2e-signalling-gate";
import {E2EHostGate} from "../src/e2e-host-gate";
import {prologue,E2E_MODES} from "../src/e2e-wire";
import {handshakeMode,parseHandshakeMode,scopedPrologue} from "../src/connection-scope";
import {XXHandshakeState} from "../src/noise/protocol";
import {wrapCrypto} from "../src/noise/crypto";
import {pureJsCrypto} from "../src/noise/crypto-js";
import {Uint8ArrayList} from "uint8arraylist";
import {x25519} from "@noble/curves/ed25519.js";
const fx=JSON.parse(readFileSync(new URL("../fixtures/e2e-session.json",import.meta.url),"utf8"));
const hex=(s:string)=>Uint8Array.from(s.match(/../g)??[],x=>parseInt(x,16));
const config=(name:string)=>({roomCode:"scope-proof",device:hex(fx.devices[name].descriptor),bundle:hex(fx.devices[name].bundle),noisePrivateKey:hex(fx.devices[name].noise_private_key),trustedRootId:hex(fx.root_id),policy:{rpId:fx.rp_id,allowedOrigins:fx.allowed_origins}});
const host=()=>new E2EHostGate({...config("H"),route:fx.routes.H});
const client=()=>new E2EClientGate({...config("C"),signingPrivateKey:hex(fx.devices.C.signing_private_key),appHello:()=>new TextEncoder().encode('{"scope":"desktopOnly"}')});
const replies=(r:any):Uint8Array[]=>{expect(r.ok).toBe(true);expect(r.value.kind).toBe("reply");return r.value.cts;};
describe("desktop-only negotiation boundary",()=>{
 test("an application hello alone does not stop a legacy host from admitting",()=>{
  const h=host(),c=client(),start=c.start();if(!start.ok)throw Error("start");
  const [m2]=replies(h.receive(start.value.ct,start.value.mode));
  const [m3,confirm]=replies(c.receive(m2!));expect(h.receive(m3!).ok).toBe(true);
  replies(h.receive(confirm!));expect(h.maySignal).toBe(true);
  expect(new TextDecoder().decode(h.appHello)).toContain("desktopOnly");
 });
 test("desktop tags are strict and classic prologues remain byte-identical",()=>{
  for(const mode of E2E_MODES){
   expect(handshakeMode(mode,"full")).toBe(mode);
   expect(handshakeMode(mode,"desktopOnly")).toBe("desktop-"+mode);
   expect(parseHandshakeMode("desktop-"+mode)).toEqual({mode,scope:"desktopOnly"});
   expect(parseHandshakeMode(mode)).toEqual({mode,scope:"full"});
   expect(scopedPrologue(mode,"room","full")).toEqual(prologue(mode,"room"));
   expect(scopedPrologue(mode,"room","desktopOnly")).not.toEqual(prologue(mode,"room"));
  }
  for(const bad of ["desktop","desktop-auth-extra","desktop-desktop-auth","AUTH","", "desktop-unknown"])expect(parseHandshakeMode(bad)).toBeNull();
 });
 test("a relay cannot downgrade desktop scope before confirmation",()=>{
  const make=(initiator:boolean,scope:"full"|"desktopOnly")=>{
   const key=hex(fx.devices[initiator?"C":"H"].noise_private_key);
   return new XXHandshakeState({crypto:wrapCrypto(pureJsCrypto),protocolName:"Noise_XX_25519_ChaChaPoly_SHA256",initiator,prologue:scopedPrologue("auth","room",scope)!,s:{privateKey:key,publicKey:x25519.getPublicKey(key)}});
  };
  const c=make(true,"desktopOnly"),h=make(false,"full");
  const m1=c.writeMessageA(new Uint8ArrayList());h.readMessageA(new Uint8ArrayList(m1));
  const m2=h.writeMessageB(new Uint8ArrayList());
  expect(()=>c.readMessageB(new Uint8ArrayList(m2))).toThrow();
 });
});

describe("desktop scope in production gates",()=>{
 const desktop=()=>new E2EClientGate({...config("C"),signingPrivateKey:hex(fx.devices.C.signing_private_key),scope:"desktopOnly"} as any);
 test("the bound scope is known before an admitted host can send state",()=>{
  const h=host(),c=desktop(),s=c.start();if(!s.ok)throw Error("start");
  expect(s.value.mode).toBe("desktop-auth");expect((h as any).accessScope).toBeNull();
  const [m2]=replies(h.receive(s.value.ct,s.value.mode));const [m3,confirm]=replies(c.receive(m2!));
  expect(h.receive(m3!).ok).toBe(true);const [start]=replies(h.receive(confirm!));
  expect(h.maySignal).toBe(true);expect((h as any).accessScope).toBe("desktopOnly");
  expect(c.receive(start!).ok).toBe(true);
 });
 test("rewriting the wire tag to classic cannot make the desktop client send confirmation",()=>{
  const h=host(),c=desktop(),s=c.start();if(!s.ok)throw Error("start");
  const [m2]=replies(h.receive(s.value.ct,"auth"));
  expect(c.receive(m2!).ok).toBe(false);expect(h.maySignal).toBe(false);
  expect(h.seal(new Uint8Array([1])).ok).toBe(false);
 });
 test("metadata on later messages cannot widen authenticated desktop scope",()=>{
  const h=host(),c=desktop(),s=c.start();if(!s.ok)throw Error("start");
  const [m2]=replies(h.receive(s.value.ct,s.value.mode)),[m3,confirm]=replies(c.receive(m2!));
  expect(h.receive(m3!,"auth").ok).toBe(true);replies(h.receive(confirm!,"auth"));
  expect((h as any).accessScope).toBe("desktopOnly");
 });
});

test("desktop scope bytes match independently generated vectors",()=>{
 const rows=JSON.parse(readFileSync(new URL("../fixtures/connection-scope.json",import.meta.url),"utf8"));
 expect(rows).toHaveLength(16);
 for(const r of rows){expect(handshakeMode(r.mode,r.scope)).toBe(r.tag);expect(Buffer.from(scopedPrologue(r.mode,r.room,r.scope)!).toString("hex")).toBe(r.prologue);}
 expect(scopedPrologue("auth","x".repeat(65536),"desktopOnly")).toBeNull();
});
