export const SHELLKITE_ORIGIN='https://shellkite.xpromptvs.com';
export const AUTH_ORIGIN='https://app.xpromptvs.ai';
export interface EnrollmentRequest {purpose:'shellkite-browser';origin:typeof SHELLKITE_ORIGIN;requestId:string}
export function authorizationURL(carrier:string,requestId:string):string {
 if(!/^[A-Za-z0-9_-]{22}$/.test(carrier)||!/^[A-Za-z0-9_-]{6,80}$/.test(requestId))throw Error('Invalid enrollment request');
 const url=new URL('/?authorize=shellkite',AUTH_ORIGIN);
 url.hash=new URLSearchParams({adopt:carrier,request:requestId}).toString();return url.href;
}
/** Only the existing trusted auth page assigns the intended recipient origin. A URL cannot choose it. */
export function parseEnrollmentRequest(url:URL):EnrollmentRequest|null {
 if(url.origin!==AUTH_ORIGIN||url.searchParams.get('authorize')!=='shellkite')return null;
 const requestId=new URLSearchParams(url.hash.slice(1)).get('request');
 return requestId&&/^[A-Za-z0-9_-]{6,80}$/.test(requestId)?{purpose:'shellkite-browser',origin:SHELLKITE_ORIGIN,requestId}:null;
}
export function matchesEnrollmentRequest(data:Uint8Array,expected:EnrollmentRequest):boolean {
 try{const request=JSON.parse(new TextDecoder().decode(data));return request.purpose===expected.purpose&&request.origin===expected.origin&&request.requestId===expected.requestId;}catch{return false;}
}
