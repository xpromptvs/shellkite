import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.RDEV_BASE??'http://127.0.0.1:5188';
for(const [engine,name] of [[chromium,'chromium'],[webkit,'webkit']]){
 const browser=await engine.launch();
 try{
  for(const mobile of [false,true]){
   const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1200,height:800},isMobile:mobile,hasTouch:mobile});
   await page.route('**/__shellkite_check__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body,#test{margin:0;width:100%;height:100%;background:#171717}</style></head><body><div id="test"></div><script type="module" src="/@vite/client"></script></body></html>'}));
   await page.goto(base+'/__shellkite_check__');
   const result=await page.evaluate(async mobile=>{
    const {mountClient}=await import('/src/client/embed.ts');
    const {encodeJson,decodeJson}=await import('/src/lib/codec.ts');
    class Channel extends EventTarget {
     readyState='open';binaryType='arraybuffer';bufferedAmount=0;sent=[];
     constructor(label){super();this.label=label;}
     send(data){this.sent.push(decodeJson(data));}
     receive(data){this.dispatchEvent(new MessageEvent('message',{data:encodeJson(data).slice().buffer}));}
    }
    const control=new Channel('control'),terminal=new Channel('terminal');
    let sink;
    const handle=mountClient(document.getElementById('test'),{layout:mobile?'tabbed':'floating'});
    window.__shellkiteHandle=handle;
    handle.connect({kind:'transport',transport:{carriesMedia:true,sameMac:false,connect(deps){sink=deps.sink;sink.channels({control,terminal,input:new Channel('input'),bulk:new Channel('bulk')});sink.status('connected','Connected');return {connectionState:'connected',media:null,closeDialogs(){},leave(){},close(){}};}}});
    const root=document.getElementById('test').querySelector('div').shadowRoot;
    window.__shellkiteRoot=root;
    control.receive({t:'control-state',active:true,clients:1,accessScope:'desktopOnly',sourceKinds:['display']});
    control.receive({t:'view-set',subs:[],windows:[],focused:null,tabOrder:[],view:{surface:'windows',fullscreen:null},version:1});
    control.receive({t:'source-list',sources:[{id:'dsp:1',kind:'display',name:'Main Monitor',inputCapable:true,running:true,w:1920,h:1080},{id:'dsp:2',kind:'display',name:'Second Monitor',inputCapable:true,running:true,w:1920,h:1080},{id:'win:1',kind:'window',name:'Private Editor',inputCapable:true,running:true}],display:{availability:'ok'}});
    root.getElementById('palette-open').click();
    await new Promise(requestAnimationFrame);
    const tiles = root.getElementById('palette-grid').textContent;
    const actions = root.getElementById('palette-actions').textContent;
    const main = {source:'dsp:1',name:'Main Monitor'};
    control.receive({t:'view-set',subs:[{source:main.source,scale:1,fps:60,bitrateBps:2000000}],windows:[{...main,minimized:false}],focused:main.source,tabOrder:[],view:{surface:'windows',fullscreen:null},version:2});
    await new Promise(requestAnimationFrame);
    const chrome = {
      tabBarHidden: getComputedStyle(root.getElementById('tabbar')).display === 'none',
      displayControlInFooter: !!root.querySelector('#statusbar #palette-open'),
      disconnectInFooter: !!root.querySelector('#statusbar #session-disconnect'),
      pointerMode: root.querySelector('.source-window')?.dataset.pointerMode,
    };
    return {chrome,layout:root.querySelector('.client-root').dataset.layout,terminalDisplay:getComputedStyle(root.getElementById('term-surface')).display,xterms:root.querySelectorAll('.xterm').length,actions,tiles,sent:control.sent,terminalMessages:terminal.sent.length};
   },mobile);
   assert.equal(result.layout,mobile?'tabbed':'floating');
   assert.deepEqual(result.chrome,{tabBarHidden:true,displayControlInFooter:true,disconnectInFooter:true,pointerMode:mobile?'trackpad':'direct'});
   assert.equal(result.terminalDisplay,'none');assert.equal(result.xterms,0);assert.equal(result.terminalMessages,0);
   assert.ok(result.tiles.includes('Main Monitor')&&result.tiles.includes('Second Monitor'));
   assert.ok(!result.tiles.includes('Private Editor'));assert.ok(!/terminal|tmux|agent/i.test(result.actions));
   assert.ok(result.sent.some(m=>m.t==='subscribe'&&m.source==='dsp:1'));
   assert.ok(!result.sent.some(m=>/term|tmux|agent|apps/.test(m.t)));
   await page.screenshot({path:`/tmp/shellkite-${name}-${mobile?'mobile':'desktop'}.png`});
   await page.evaluate(()=>window.__shellkiteHandle.destroy());await page.close();
   console.log(`PASS ${name} ${mobile?'mobile':'desktop'}: display palette, layout, default selection, no terminal renderer or intents`);
  }
 }finally{await browser.close();}
}
