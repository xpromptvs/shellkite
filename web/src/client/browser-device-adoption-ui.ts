import {BrowserDeviceAdoption,type AdoptionStage} from './browser-device-adoption';
import type {ClientE2EIdentity} from './e2e-identity';
import {openClientDialog,closeClientDialog} from './instance/overlays';
const owners=new WeakMap<HTMLElement,()=>void>();
/** Existing dialog chrome, with an explicit auth-origin link that works without a popup permission. */
export function mountBrowserDeviceAdoption(opts:{root:HTMLElement;identity:ClientE2EIdentity;signal?:AbortSignal;onDone():void},create=()=>new BrowserDeviceAdoption({identity:opts.identity})):void {
 if(opts.signal?.aborted)return;
 owners.get(opts.root)?.();
 const root=opts.root as HTMLDialogElement,d=root.ownerDocument,abort=new AbortController();
 let stage:AdoptionStage='preparing',live=true;
 const dispose=()=>{if(!live)return;live=false;abort.abort();root.removeEventListener('cancel',cancel);opts.signal?.removeEventListener('abort',closed);if(owners.get(root)===dispose)owners.delete(root);};
 owners.set(root,dispose);
 const title=root.querySelector<HTMLElement>('#e2e-setup-title')!,body=root.querySelector<HTMLElement>('#e2e-setup-body')!,actions=root.querySelector<HTMLElement>('#e2e-setup-actions')!;
 root.querySelector<HTMLElement>('#e2e-setup-identity')!.hidden=true;
 const close=(done=false)=>{dispose();closeClientDialog(root);if(done)opts.onDone();};
 const cancel=(e:Event)=>{e.preventDefault();if(stage!=='committing')close();};
 const closed=()=>{dispose();closeClientDialog(root);};
 root.addEventListener('cancel',cancel);opts.signal?.addEventListener('abort',closed,{once:true});
 const button=(label:string,run:()=>void)=>{const b=d.createElement('button');b.type='button';b.textContent=label;b.onclick=run;actions.append(b);return b;};
 const show=(next:AdoptionStage)=>{
  if(!live)return;stage=next;
  if(next==='committing'){actions.replaceChildren();title.textContent='Saving this browser';body.textContent='Finishing authorization…';}
  else if(next==='preparing'){actions.replaceChildren();title.textContent='Sign in to Shellkite';body.textContent='Preparing a one-use browser authorization…';button('Cancel',()=>close());}
  else if(next==='ready'){actions.replaceChildren();title.textContent='Signed in';body.textContent='This browser can now connect to your Macs.';button('Done',()=>close(true));}
 };
 const start=async()=>{
  if(!live)return;show('preparing');
  const recipient=create();
  const result=await recipient.start({signal:abort.signal,onState:show,onReady:url=>{
   if(!live)return;
   actions.replaceChildren();title.textContent='Authorize this browser';body.textContent='Continue on Xpromptvs to choose your existing account and approve Shellkite. Keep this tab open, then return here.';
   button('Continue with Xpromptvs',()=>{if(!recipient.openAuthorization())body.textContent='Allow opening the authorization tab, then try Continue with Xpromptvs again.';});button('Cancel',()=>close());
  }});
  if(!live||result.ok)return;
  actions.replaceChildren();title.textContent=result.reason==='committed-unconfirmed'?'Browser authorized':'Could not sign in';
  const reasons:Record<string,string>={'another-tab':'Sign-in is already open in another Shellkite tab.','expired':'This request expired. Try again.','storage':'The browser could not save its device identity.','committed-unconfirmed':'Your identity was saved, but its confirmation was interrupted. Close this panel and reconnect.','capabilities':'This authorization did not grant browser access. Use Continue with Xpromptvs.','verification':'The authorization could not be verified. Start a new request.'};
  body.textContent=reasons[result.reason]??'Sign-in could not finish. Open shellkite.xpromptvs.com and try again.';
  if(result.reason==='committed-unconfirmed')button('Done',()=>close(true));else{button('Try again',()=>{void start();});button('Close',()=>close());}
 };
 root.setAttribute('aria-label','Sign in to Shellkite');openClientDialog(root);void start();
}
