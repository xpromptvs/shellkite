import {AUTH_ORIGIN} from './shellkite-origin';
export function connectionEntryFor(url:URL):string|null {
 const hash=new URLSearchParams(url.hash.slice(1));
 if(hash.has('adopt'))return AUTH_ORIGIN+'/'+url.search+url.hash;
 if(hash.has('pair')||url.searchParams.has('code')||url.searchParams.has('token'))return url.origin+'/app'+url.search+url.hash;
 return null;
}
