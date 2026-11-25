import {E2E_MODES,prologue,lengthPrefixed,type E2EMode} from "./e2e-wire.js";
/** An authenticated upper bound on application access, independent of transport or ownership. */
export type ConnectionScope = "full" | "desktopOnly";
export type HandshakeMode = E2EMode | `desktop-${E2EMode}`;
export function handshakeMode(mode:E2EMode,scope:ConnectionScope):HandshakeMode {
 if(!E2E_MODES.includes(mode)||!(scope==="full"||scope==="desktopOnly"))throw new Error("Unsupported handshake context");
 return scope==="desktopOnly"?`desktop-${mode}`:mode;
}
export function parseHandshakeMode(value:string):{mode:E2EMode;scope:ConnectionScope}|null {
 if(typeof value!=="string")return null;
 const desktop=value.startsWith("desktop-"),base=desktop?value.slice(8):value;
 return E2E_MODES.includes(base as E2EMode)?{mode:base as E2EMode,scope:desktop?"desktopOnly":"full"}:null;
}
/** Classic v3 is unchanged. A desktop selector changed by the relay fails Noise before admission. */
export function scopedPrologue(mode:E2EMode,room:string,scope:ConnectionScope):Uint8Array|null {
 if(scope==="full")return prologue(mode,room);
 if(scope!=="desktopOnly"||!E2E_MODES.includes(mode))return null;
 const enc=new TextEncoder(),parts=["rdev-e2e/desktop/v1",mode,room].map(s=>lengthPrefixed(enc.encode(s)));
 if(parts.some(p=>!p))return null;
 const out=new Uint8Array(parts.reduce((n,p)=>n+p!.length,0));let at=0;
 for(const p of parts){out.set(p!,at);at+=p!.length;}return out;
}
