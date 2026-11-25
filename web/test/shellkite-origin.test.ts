import {it,expect} from 'vitest';
import {policyFor,PRODUCT_ORIGINS} from '../src/lib/product-origin';
import {authorizationURL,parseEnrollmentRequest,SHELLKITE_ORIGIN} from '../src/lib/shellkite-origin';
it('verifies old grants at the new viewer origin without accepting it as a passkey issuer',()=>{
 expect(policyFor(SHELLKITE_ORIGIN)).toEqual({rpId:'xpromptvs.ai',allowedOrigins:['https://xpromptvs.ai','https://app.xpromptvs.ai']});
 expect(PRODUCT_ORIGINS).not.toContain(SHELLKITE_ORIGIN);
});
it('puts one-use enrollment context in an auth-origin fragment without a return credential',()=>{
 const url=new URL(authorizationURL('a'.repeat(22),'req-123'));
 expect(url.origin).toBe('https://app.xpromptvs.ai');expect(url.searchParams.get('authorize')).toBe('shellkite');
 const hash=new URLSearchParams(url.hash.slice(1));expect(hash.get('adopt')).toBe('a'.repeat(22));
 expect(parseEnrollmentRequest(url)).toEqual({purpose:'shellkite-browser',origin:SHELLKITE_ORIGIN,requestId:'req-123'});
 expect(parseEnrollmentRequest(new URL('https://evil.test/'+url.search+url.hash))).toBe(null);
 expect([...url.searchParams.keys()]).toEqual(['authorize']);
});

it('never starts an existing-RP ceremony from the Shellkite viewer',async()=>{
 const {ClientE2EIdentity}=await import('../src/client/e2e-identity');
 const {vi}=await import('vitest');
 const ceremony=vi.fn(async()=>{throw Error('unexpected ceremony');});
 const memory=()=>({read:async()=>null,write:async()=>true,delete:async()=>true});
 const identity=new ClientE2EIdentity(memory(),memory(),{rpId:'xpromptvs.ai',rpName:'Shellkite'},SHELLKITE_ORIGIN,{createRoot:ceremony,discoverRoot:ceremony,rootCheck:ceremony,signalUnknown:ceremony,issue:ceremony,random:n=>crypto.getRandomValues(new Uint8Array(n))},memory());
 await expect(identity.signIn(async()=>({kind:'absent'}))).rejects.toThrow(/authorization/);
 await expect(identity.enroll({route:'create'})).rejects.toThrow(/authorization/);
 expect(ceremony).not.toHaveBeenCalled();
});
