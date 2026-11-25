import {it,expect,vi,afterEach} from 'vitest';
import {mountBrowserDeviceAdoption} from '../src/client/browser-device-adoption-ui';
vi.mock('../src/client/instance/overlays',()=>({openClientDialog:(d:HTMLElement)=>d.setAttribute('open',''),closeClientDialog:(d:HTMLElement)=>d.removeAttribute('open')}));
afterEach(()=>document.body.replaceChildren());
function panel(){const root=document.createElement('dialog');root.innerHTML='<h2 id="e2e-setup-title"></h2><div id="e2e-setup-body"></div><div id="e2e-setup-actions"></div><div id="e2e-setup-identity"></div>';document.body.append(root);return root;}
it('opens authorization explicitly in another tab and cancels the pending request',()=>{
 const root=panel();let signal:AbortSignal|undefined;const openAuthorization=vi.fn(()=>true);
 mountBrowserDeviceAdoption({root,identity:{} as any,onDone:vi.fn()},()=>({openAuthorization,start:async(o:any)=>{signal=o.signal;o.onReady('https://app.xpromptvs.ai/?authorize=shellkite#opaque');return new Promise(()=>{});}} as any));
 const buttons=root.querySelectorAll('button');buttons[0]!.click();expect(openAuthorization).toHaveBeenCalledOnce();
 buttons[1]!.click();expect(signal?.aborted).toBe(true);expect(root.hasAttribute('open')).toBe(false);
});
it('blocks Escape while saving and exposes Done only after durable success',()=>{
 const root=panel(),done=vi.fn();let state:(s:any)=>void=()=>{};
 mountBrowserDeviceAdoption({root,identity:{} as any,onDone:done},()=>({start:async(o:any)=>{state=o.onState;return new Promise(()=>{});}} as any));
 state('committing');expect(root.querySelector('button')).toBeNull();root.dispatchEvent(new Event('cancel',{cancelable:true}));expect(root.hasAttribute('open')).toBe(true);
 state('ready');root.querySelector('button')!.click();expect(done).toHaveBeenCalledOnce();
});
it('offers retry after expiry and ignores an already aborted mount',async()=>{
 const root=panel(),start=vi.fn(async()=>({ok:false,reason:'expired'}));
 mountBrowserDeviceAdoption({root,identity:{} as any,onDone:vi.fn()},()=>({start} as any));await Promise.resolve();expect(root.textContent).toContain('expired');root.querySelector('button')!.click();expect(start).toHaveBeenCalledTimes(2);
 const abort=new AbortController();abort.abort();const create=vi.fn();mountBrowserDeviceAdoption({root:panel(),identity:{} as any,signal:abort.signal,onDone:vi.fn()},create);expect(create).not.toHaveBeenCalled();
});
