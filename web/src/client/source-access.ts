import type {Source,ViewSetMsg} from './source-picker';
/** Descriptive UI capabilities. The host independently enforces the authenticated scope. */
export class SourceAccess {
 private restricted:boolean;
 private initialRequested=false;
 constructor(desktopOnly=false){this.restricted=desktopOnly;}
 get desktopOnly():boolean{return this.restricted;}
 observe(message:unknown):void {
  const m=message as {t?:string;accessScope?:string}|null;
  if(m?.t==='control-state'&&m.accessScope==='desktopOnly')this.restricted=true;
 }
 acceptsSource(source:unknown):boolean {
  if(!this.restricted)return true;
  if(typeof source!=='string'||!/^dsp:[1-9][0-9]*$/.test(source))return false;
  return Number(source.slice(4))<=0xffffffff;
 }
 acceptsAction(id:string):boolean {
  return !this.restricted||id==='action:claim'||(id.startsWith('source:')&&this.acceptsSource(id.slice(7)));
 }
 permits(message:unknown):boolean {
  if(!this.restricted)return true;
  const m=message as Record<string,unknown>|null;
  if(!m||typeof m.t!=='string')return false;
  if(/^(term-|terminal-|agent|apps-|sim-)/.test(m.t)||['key','resize','list-terminals','open-terminal','reopen-terminal','close-terminal','switch-terminal','list-tmux','open-tmux','new-tmux','kill-tmux','file-get'].includes(m.t))return false;
  if(typeof m.source==='string'&&!this.acceptsSource(m.source))return false;
  if(m.t==='set-view'&&m.surface!==undefined&&m.surface!=='windows')return false;
  if(m.t==='set-view'&&typeof m.fullscreen==='string'&&!this.acceptsSource(m.fullscreen))return false;
  if(['move-tab','rename-tab'].includes(m.t)&&(!this.acceptsSource(m.tab)||(m.before!=null&&!this.acceptsSource(m.before))))return false;
  if(m.t==='paste-begin'){
   const target=m.to as {term?:string;win?:string}|undefined;
   if(!target||target.term!==undefined||!this.acceptsSource(target.win))return false;
  }
  return true;
 }
 sources(sources:Source[]):Source[]{return sources.filter(s=>this.acceptsSource(s.id));}
 view(state:ViewSetMsg):ViewSetMsg {
  if(!this.restricted)return state;
  const windows=state.windows.filter(w=>this.acceptsSource(w.source));
  return {...state,windows,subs:state.subs.filter(s=>this.acceptsSource(s.source)),agents:[],selectedAgent:null,
   tabOrder:state.tabOrder.filter(id=>this.acceptsSource(id)),focused:this.acceptsSource(state.focused)?state.focused:windows.find(w=>!w.minimized)?.source??null,
   view:{surface:'windows',fullscreen:this.acceptsSource(state.view.fullscreen)?state.view.fullscreen:null}};
 }
 initialDisplay(active:boolean,receivedView:boolean,windows:readonly {source:string;minimized?:boolean}[],sources:readonly {id:string}[]):string|null {
  if(!this.restricted||this.initialRequested||!active||!receivedView||windows.length)return null;
  const source=sources.find(s=>this.acceptsSource(s.id))?.id;
  if(!source)return null;
  this.initialRequested=true;return source;
 }
}
