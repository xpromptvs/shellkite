import {describe,it,expect} from 'vitest';
import {SourceAccess} from '../src/client/source-access';
describe('host-advertised desktop-only sessions',()=>{
 it('full viewers keep classic behavior until the authenticated host limits the session',()=>{
  const a=new SourceAccess();expect(a.permits({t:'open-terminal'})).toBe(true);
  a.observe({t:'control-state',accessScope:'desktopOnly',sourceKinds:['display']});
  for(const message of [{t:'open-terminal'},{t:'new-tmux'},{t:'term-mode'},{t:'agent',op:'list'},{t:'subscribe',source:'win:1'},{t:'subscribe',source:'sim:1'},{t:'set-view',surface:'terminal'}])expect(a.permits(message)).toBe(false);
  expect(a.permits({t:'subscribe',source:'dsp:1'})).toBe(true);
  a.observe({t:'control-state',accessScope:'full'});expect(a.desktopOnly).toBe(true);
 });
 it('restricted products reject unsupported action and URL families before connecting',()=>{
  const a=new SourceAccess(true);
  for(const source of ['win:1','sim:1','app:1','dsp:01','dsp:0','dsp:4294967296'])expect(a.acceptsSource(source)).toBe(false);
  expect(a.acceptsSource('dsp:1')).toBe(true);
  expect(a.acceptsAction('action:new-terminal')).toBe(false);expect(a.acceptsAction('tmux:$1')).toBe(false);
  expect(a.acceptsAction('source:dsp:1')).toBe(true);expect(a.acceptsAction('action:claim')).toBe(true);
 });
 it('display clipboard transfers stay available while terminal pastes are refused',()=>{
  const a=new SourceAccess(true);
  expect(a.permits({t:'paste-begin',to:{win:'dsp:1'}})).toBe(true);
  expect(a.permits({t:'paste-begin',to:{term:'pty:1'}})).toBe(false);
  expect(a.permits({t:'paste-begin',to:{win:'win:1'}})).toBe(false);
 });
 it('default selection waits for active control, a whole view, and a display inventory',()=>{
  const a=new SourceAccess(true),sources=[{id:'dsp:1'}];
  expect(a.initialDisplay(false,true,[],sources)).toBe(null);
  expect(a.initialDisplay(true,false,[],sources)).toBe(null);
  expect(a.initialDisplay(true,true,[{source:'dsp:2',minimized:true}],sources)).toBe(null);
  expect(a.initialDisplay(true,true,[],sources)).toBe('dsp:1');
  expect(a.initialDisplay(true,true,[],sources)).toBe(null);
 });
});

describe('desktop-only palette',()=>{
 it('offers only display tiles, including when an old window/simulator query is entered',async()=>{
  const {paletteModel}=await import('../src/client/command-palette');
  const ctx={active:true,desktopOnly:true,sources:[{id:'dsp:1',kind:'display',name:'Monitor',inputCapable:true,running:true},{id:'win:1',kind:'window',name:'Editor',inputCapable:true,running:true}],subscribed:new Set<string>(),focused:null,thumbs:new Map(),display:null,tmux:null,openTmux:new Set<string>(),activeTmux:null};
  expect(paletteModel(ctx,'').actions).toEqual([]);expect(paletteModel(ctx,'').tiles.map(t=>t.id)).toEqual(['dsp:1']);
  expect(paletteModel(ctx,'Editor','launch-simulator').tiles).toEqual([]);
  expect(paletteModel({...ctx,active:false},'').actions.map(a=>a.id)).toEqual(['action:claim']);
 });
});
