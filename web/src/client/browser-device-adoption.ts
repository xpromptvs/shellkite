import {createRecipientOriginProof} from '../lib/shellkite-origin-proof';
import {E2EClientGate,derivePairing,encodePairingSeed,parseBundle,verifyBundle,rootId,type PairingMaterial,type ClientGateConfig} from '@rdev/protocol';
import type {ClientE2EIdentity} from './e2e-identity';
import {authorizationURL,SHELLKITE_ORIGIN,type EnrollmentRequest} from '../lib/shellkite-origin';
import {SignalingClient} from '../lib/signaling';
import {base64urlEncode,base64urlDecode} from '../lib/base64url';
import {controlPlaneOrigin} from '../lib/signaling-base';
export type AdoptionStage='preparing'|'waiting'|'committing'|'ready'|'failed';
export type AdoptionResult={ok:true}|{ok:false;reason:string};
type PublicRoom=Pick<PairingMaterial,'code'|'token'>;
export interface RecipientHandlers {
 onReady():void;onPeerJoined(peer:string):void;onE2E(ct:Uint8Array,peer:string):void;onError(reason:string):void;onClosed():void;
}
interface RecipientSocket {send(ct:Uint8Array,peer:string,mode?:string):void;close():void}
interface AdoptionDeps {
 identity:Pick<ClientE2EIdentity,'load'|'pairGateConfig'|'commitPaired'>;
 register?:(room:PublicRoom,signal?:AbortSignal)=>Promise<void|'conflict'>;
 open?:(room:PublicRoom,handlers:RecipientHandlers)=>RecipientSocket;
 withLock?:<T>(job:()=>Promise<T>)=>Promise<T|null>;
}
interface StartOptions {onReady:(url:string)=>void|Promise<void>;onState?:(stage:AdoptionStage)=>void;signal?:AbortSignal;timeoutMs?:number}
/** Recipient keys remain in this origin's installation store. The URL carries only a one-use PSK seed. */
export class BrowserDeviceAdoption {
 private running=false;
 private authorize:(()=>boolean)|null=null;
 openAuthorization():boolean{return this.authorize?.()??false;}
 constructor(private readonly deps:AdoptionDeps){}
 async start(options:StartOptions):Promise<AdoptionResult> {
  if(this.running)return {ok:false,reason:'another-tab'};
  if(options.signal?.aborted)return {ok:false,reason:'cancelled'};
  const report=options.onState;
  const state=(stage:AdoptionStage)=>{try{report?.(stage);}catch{}};
  options={...options,onState:state};
  this.running=true;
  try {
   const lock=this.deps.withLock??browserEnrollmentLock;
   const result=await lock(()=>this.run(options));
   if(result===null){options.onState?.('failed');return {ok:false,reason:'another-tab'};}
   return result;
  }catch{options.onState?.('failed');return {ok:false,reason:options.signal?.aborted?'cancelled':'unavailable'};}
  finally{this.running=false;this.authorize=null;}
 }
 private async run(options:StartOptions):Promise<AdoptionResult> {
  options.onState?.('preparing');
  const cancelled=()=>options.signal?.aborted===true;
  const loaded=await this.deps.identity.load();
  if(cancelled())return {ok:false,reason:'cancelled'};
  if('kind' in loaded||loaded.status.kind==='blocked')return {ok:false,reason:'storage'};
  if(loaded.status.kind==='ready'){options.onState?.('ready');return {ok:true};}
  let material:PairingMaterial|null=null,carrier='';
  for(let attempt=0;attempt<4;attempt++){
   const seed=crypto.getRandomValues(new Uint8Array(16));
   carrier=encodePairingSeed(seed)!;material=await derivePairing(seed);
   if(!material||cancelled())return {ok:false,reason:'cancelled'};
   const registered=await (this.deps.register??registerRoom)({code:material.code,token:material.token},options.signal);
   if(cancelled())return {ok:false,reason:'cancelled'};
   if(registered!=='conflict')break;
   material=null;
  }
  if(!material)return {ok:false,reason:'room-conflict'};
  const config=await this.deps.identity.pairGateConfig(material.code,material.psk);
  if(cancelled())return {ok:false,reason:'cancelled'};
  if(!config)return {ok:false,reason:'storage'};
  const request:EnrollmentRequest={purpose:'shellkite-browser',origin:SHELLKITE_ORIGIN,requestId:crypto.randomUUID()};
  const url=authorizationURL(carrier,request.requestId);
  const bound:ClientGateConfig={...config,scope:'full',trustedRootId:loaded.record.root?rootId(loaded.record.root):config.trustedRootId,appHello:()=>new TextEncoder().encode(JSON.stringify(request))};
  if(!bound.devicePublicKeys)return {ok:false,reason:"storage"};
  const proof=createRecipientOriginProof(request,bound.devicePublicKeys);
  this.authorize=()=>proof.open(url);
  return new Promise<AdoptionResult>(resolve=>{
   let socket:RecipientSocket|undefined,gate:E2EClientGate|undefined,peer:string|undefined,settled=false,committing=false,transportLost=false;
   let chain=Promise.resolve();
   const finish=(result:AdoptionResult)=>{
    if(settled)return;settled=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);
    proof.close();this.authorize=null;
    try{gate?.close();}catch{}try{socket?.close();}catch{}options.onState?.(result.ok?'ready':'failed');resolve(result);
   };
   // Once the durable commit begins, cancellation cannot claim to undo it. The UI disables Cancel.
   const abort=()=>{if(!committing)finish({ok:false,reason:'cancelled'});};
   options.signal?.addEventListener('abort',abort,{once:true});
   const timer=setTimeout(()=>{if(!committing)finish({ok:false,reason:'expired'});},options.timeoutMs??180000);
   const lost=(reason:string)=>{transportLost=true;if(!committing)finish({ok:false,reason});};
   const handlers:RecipientHandlers={
    onReady:()=>{
     if(settled)return;options.onState?.('waiting');
     void Promise.resolve(options.onReady(url)).catch(()=>finish({ok:false,reason:'navigation'}));
    },
    onPeerJoined:id=>{
     if(settled||peer)return;peer=id;gate=new E2EClientGate(bound);
     const started=gate.start();if(!started.ok){finish({ok:false,reason:'handshake'});return;}
     socket?.send(started.value.ct,id,started.value.mode);
    },
    onE2E:(ct,id)=>{
     chain=chain.then(async()=>{
      if(settled||id!==peer||!gate||committing)return;
      const received=gate.receive(ct);if(!received.ok){finish({ok:false,reason:'verification'});return;}
      if(received.value.kind==='reply')for(const reply of received.value.cts)socket?.send(reply,id);
      const bundle=gate.acceptedBundle;
      if(!gate.maySignal||!bundle)return;
      const parsed=parseBundle(bundle);
      const verified=parsed.ok?verifyBundle(bundle,{trustedRootId:rootId(parsed.bundle.root),policy:bound.policy}):null;
      if(!verified?.ok||verified.chain.leaf.capabilities!==1){finish({ok:false,reason:'capabilities'});return;}
      if(cancelled()){finish({ok:false,reason:'cancelled'});return;}
      committing=true;options.onState?.('committing');
      const committed=await this.deps.identity.commitPaired(bundle);
      if(!committed.ok){finish({ok:false,reason:'storage'});return;}
      const ack=gate.seal(new TextEncoder().encode(JSON.stringify({t:'adopted'})));
      if(transportLost||!ack.ok||!socket){finish({ok:false,reason:'committed-unconfirmed'});return;}
      socket.send(ack.value,id);finish({ok:true});
     }).catch(()=>finish({ok:false,reason:committing?'committed-unconfirmed':'verification'}));
    },
    onError:reason=>lost(reason),onClosed:()=>lost('disconnected'),
   };
   try{socket=(this.deps.open??openRoom)({code:material!.code,token:material!.token},handlers);}
   catch{finish({ok:false,reason:'disconnected'});}
   if(cancelled())abort();
  });
 }
}
async function browserEnrollmentLock<T>(job:()=>Promise<T>):Promise<T|null> {
 if(!navigator.locks)throw Error('Web Locks unavailable');
 return navigator.locks.request('shellkite-browser-enrollment',{ifAvailable:true},lock=>lock?job():null);
}
async function registerRoom(room:PublicRoom,signal?:AbortSignal):Promise<void|'conflict'> {
 if(location.origin!==SHELLKITE_ORIGIN)throw Error('Open the Shellkite website to enroll');
 const response=await fetch(new URL('/pair',controlPlaneOrigin()),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(room),signal});
 if(response.status===409)return 'conflict';if(!response.ok)throw Error('Registration failed');
}
function openRoom(room:PublicRoom,handlers:RecipientHandlers):RecipientSocket {
 const base=controlPlaneOrigin().replace(/^http/,'ws');
 const socket=new WebSocket(base+'/session/'+room.code);
 const signaling=new SignalingClient(socket,{role:'host',token:room.token},{onWelcome:()=>handlers.onReady(),onPeerJoined:handlers.onPeerJoined,onError:handlers.onError,onE2E:(ct,peer)=>{const bytes=base64urlDecode(ct);if(bytes&&peer)handlers.onE2E(bytes,peer);}});
 socket.addEventListener('error',()=>handlers.onError('disconnected'));socket.addEventListener('close',()=>handlers.onClosed());
 const ping=setInterval(()=>{if(socket.readyState===WebSocket.OPEN)signaling.ping();},15000);
 return {send:(ct,peer,mode)=>{if(socket.readyState!==WebSocket.OPEN)throw Error('Socket closed');signaling.sendE2E(base64urlEncode(ct),mode,peer);},close:()=>{clearInterval(ping);socket.close(4001);}};
}
