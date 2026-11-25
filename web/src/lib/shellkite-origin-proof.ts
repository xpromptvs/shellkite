import {parseDevice} from '@rdev/protocol';
import {base64urlEncode} from './base64url';
import {AUTH_ORIGIN,SHELLKITE_ORIGIN,parseEnrollmentRequest,type EnrollmentRequest} from './shellkite-origin';
type Keys={signing:Uint8Array;noise:Uint8Array};
/** Bind consent to the actual browser window and the two keys authenticated by Noise. No private key crosses origins. */
export function verifyBrowserRecipient(request:EnrollmentRequest,device:Uint8Array,options:{signal?:AbortSignal;timeoutMs?:number;scope?:Window}={}):Promise<boolean>{
 const scope=options.scope??window,opener=scope.opener as Window|null,keys=parseDevice(device);
 if(!opener||!keys||options.signal?.aborted)return Promise.resolve(false);
 const challenge=base64urlEncode(crypto.getRandomValues(new Uint8Array(32)));
 return new Promise(resolve=>{
  let settled=false;
  const finish=(ok:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);scope.removeEventListener('message',message);options.signal?.removeEventListener('abort',abort);resolve(ok);};
  const abort=()=>finish(false);
  const message=(event:MessageEvent)=>{
   const data=event.data;
   if(event.origin!==SHELLKITE_ORIGIN||event.source!==opener||!data||data.t!=='shellkite-origin-proof'||data.requestId!==request.requestId||data.challenge!==challenge)return;
   finish(data.signing===base64urlEncode(keys.signingPublicKey)&&data.noise===base64urlEncode(keys.noisePublicKey));
  };
  const timer=setTimeout(()=>finish(false),options.timeoutMs??15000);
  scope.addEventListener('message',message);options.signal?.addEventListener('abort',abort,{once:true});
  try{opener.postMessage({t:'shellkite-origin-challenge',requestId:request.requestId,challenge},SHELLKITE_ORIGIN);}catch{finish(false);}
 });
}
/** The recipient answers only its own auth window with keys retained before navigation, never keys supplied in a message. */
export function createRecipientOriginProof(request:EnrollmentRequest,keys:Keys,scope:Window=window){
 let target:Window|null=null,closed=false;
 const signing=base64urlEncode(keys.signing),noise=base64urlEncode(keys.noise);
 const message=(event:MessageEvent)=>{
  const data=event.data;
  if(closed||!target||event.source!==target||event.origin!==AUTH_ORIGIN||!data||data.t!=='shellkite-origin-challenge'||data.requestId!==request.requestId||typeof data.challenge!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.challenge))return;
  target.postMessage({t:'shellkite-origin-proof',requestId:request.requestId,challenge:data.challenge,signing,noise},AUTH_ORIGIN);
 };
 scope.addEventListener('message',message);
 return {
  open(url:string):boolean{
   if(closed)return false;
   try{
    const parsed=parseEnrollmentRequest(new URL(url));if(!parsed||parsed.requestId!==request.requestId)return false;
    if(target&&!target.closed){target.focus();return true;}
    // Retain opener only for this fixed trusted origin: it is the browser-enforced origin proof.
    target=scope.open(url,'_blank');return target!==null;
   }catch{return false;}
  },
  close(){closed=true;target=null;scope.removeEventListener('message',message);},
 };
}
