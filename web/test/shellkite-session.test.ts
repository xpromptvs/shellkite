import 'fake-indexeddb/auto';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import html from '../src/client/instance/session.html?raw';
import {createSession,type Session} from '../src/client/session';
import {createClientMount} from '../src/client/instance/mount';
import {productFeatures} from '../src/shared/product-features';
import {encodeJson,decodeJson} from '../src/lib/codec';
import type {ConnectionSink,Transport} from '../src/client/connection';
class Channel extends EventTarget {
 readyState:RTCDataChannelState='open';binaryType:BinaryType='arraybuffer';bufferedAmount=0;sent:unknown[]=[];
 constructor(readonly label:string){super();}
 send(data:Uint8Array){this.sent.push(decodeJson(data));}
 receive(data:unknown){this.dispatchEvent(new MessageEvent('message',{data:encodeJson(data).slice().buffer}));}
}
let session:Session|undefined;
beforeEach(()=>{
 document.body.innerHTML=html;
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 Object.defineProperty(window,'matchMedia',{configurable:true,value:(media:string)=>({matches:false,media,addEventListener(){},removeEventListener(){}})});
});
afterEach(()=>{session?.dispose();session=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('real Shellkite product session',()=>{
 for(const layout of ['floating','tabbed'] as const)it(`renders displays without terminal machinery in ${layout}`,()=>{
  expect(productFeatures.desktopOnly).toBe(true);
  const control=new Channel('control'),input=new Channel('input'),terminal=new Channel('terminal'),bulk=new Channel('bulk');
  let sink!:ConnectionSink;
  const transport:Transport={carriesMedia:true,sameMac:false,connect(deps){sink=deps.sink;sink.channels({control,input,terminal,bulk});return {connectionState:'connected',media:null,closeDialogs(){},leave(){},close(){}};}};
  session=createSession({params:new URLSearchParams(),code:'test',token:'test',psk:Promise.resolve(null),layout:()=>layout,transport},{state(){},requestClose(){}});
  control.receive({t:'control-state',active:true,clients:1,accessScope:'desktopOnly',sourceKinds:['display']});
  control.receive({t:'view-set',subs:[],windows:[],focused:null,tabOrder:[],view:{surface:'windows',fullscreen:null},version:1});
  control.receive({t:'source-list',sources:[{id:'win:1',kind:'window',name:'secret',inputCapable:true,running:true},{id:'dsp:1',kind:'display',name:'Monitor',inputCapable:true,running:true}],display:{availability:'ok'}});
  expect((session.debug.sources as {id:string}[]).map(s=>s.id)).toEqual(['dsp:1']);
  expect(control.sent.filter((m:any)=>m.t==='subscribe')).toEqual([{t:'subscribe',source:'dsp:1',delivery:'rtp'}]);
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'T',metaKey:true,shiftKey:true,bubbles:true}));
  expect(document.querySelector('.xterm')).toBe(null);
  expect(terminal.sent).toEqual([]);
  expect(control.sent.some((m:any)=>/term|tmux|agent|apps/.test(m.t))).toBe(false);
 });
});

it("refuses an embedded glasses layout under the actual Shellkite profile",()=>{
 const mount=createClientMount(()=>{throw Error("must not initialize");});
 expect(()=>mount(document.createElement("div"),{layout:"glasses"})).toThrow("Glasses layout is unavailable");
});
