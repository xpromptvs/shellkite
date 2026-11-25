import {it,expect,vi} from 'vitest';
import {device} from '@rdev/protocol';
import {verifyBrowserRecipient,createRecipientOriginProof} from '../src/lib/shellkite-origin-proof';
const request={purpose:'shellkite-browser' as const,origin:'https://shellkite.xpromptvs.com' as const,requestId:'request-123'};
const keys={signing:new Uint8Array(32).fill(1),noise:new Uint8Array(32).fill(2)},descriptor=device(new Uint8Array(32),keys.signing,keys.noise)!;
const event=(scope:EventTarget,data:unknown,origin:string,source:unknown)=>{const e=new Event('message');Object.assign(e,{data,origin,source});scope.dispatchEvent(e);};
it('requires exact opener, fixed origin, fresh challenge and both Noise recipient keys',async()=>{
 const opener={postMessage:vi.fn()},scope=Object.assign(new EventTarget(),{opener}) as any;
 const result=verifyBrowserRecipient(request,descriptor,{scope,timeoutMs:100});
 const challenge=opener.postMessage.mock.calls[0]![0],proof={...challenge,t:'shellkite-origin-proof',signing:'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE',noise:'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI'};
 event(scope,proof,'https://evil.test',opener);event(scope,proof,request.origin,{});event(scope,{...proof,challenge:'stale'},request.origin,opener);
 event(scope,{...proof,signing:'wrong'},request.origin,opener);expect(await result).toBe(false);
 const accepted=verifyBrowserRecipient(request,descriptor,{scope,timeoutMs:100});const fresh=opener.postMessage.mock.calls.at(-1)![0];event(scope,{...proof,challenge:fresh.challenge},request.origin,opener);expect(await accepted).toBe(true);
});
it('refuses a missing opener, timeout, and cancellation',async()=>{
 expect(await verifyBrowserRecipient(request,descriptor,{scope:{opener:null} as any})).toBe(false);
 const opener={postMessage:vi.fn()},scope=Object.assign(new EventTarget(),{opener}) as any;
 expect(await verifyBrowserRecipient(request,descriptor,{scope,timeoutMs:1})).toBe(false);
 const abort=new AbortController(),pending=verifyBrowserRecipient(request,descriptor,{scope,signal:abort.signal});abort.abort();expect(await pending).toBe(false);
});
it('answers only the captured auth window using locally retained keys, and stops after close',()=>{
 const auth={postMessage:vi.fn(),closed:false},scope=Object.assign(new EventTarget(),{open:vi.fn(()=>auth)}) as any;
 const proof=createRecipientOriginProof(request,keys,scope);expect(proof.open('https://app.xpromptvs.ai/?authorize=shellkite#adopt=AAAAAAAAAAAAAAAAAAAAAA&request=request-123')).toBe(true);
 const challenge={t:'shellkite-origin-challenge',requestId:request.requestId,challenge:'a'.repeat(43),signing:'attacker'};
 event(scope,challenge,'https://evil.test',auth);event(scope,challenge,'https://app.xpromptvs.ai',{});expect(auth.postMessage).not.toHaveBeenCalled();
 event(scope,challenge,'https://app.xpromptvs.ai',auth);expect(auth.postMessage).toHaveBeenCalledWith(expect.objectContaining({signing:'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE',noise:'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI'}),'https://app.xpromptvs.ai');
 proof.close();auth.postMessage.mockClear();event(scope,challenge,'https://app.xpromptvs.ai',auth);expect(auth.postMessage).not.toHaveBeenCalled();
});
