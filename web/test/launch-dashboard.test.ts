import { it, expect, vi } from 'vitest';
import { mountLaunchDashboard } from '../src/shared/launch-dashboard';
it('routes explicit actions and leaves the existing dashboard available', () => {
 const host = document.createElement('main'); document.body.append(host);
 const local = vi.fn(async () => {}), share = vi.fn(async () => {}), connect = vi.fn();
 const dispose = mountLaunchDashboard(host, {local, share, connect});
 expect(host.querySelector('footer')).toBeNull();
 host.querySelector<HTMLButtonElement>('[data-launch="share"]')!.click(); expect(share).toHaveBeenCalledOnce();
 host.querySelector<HTMLButtonElement>('[data-launch="connect"]')!.click(); expect(connect).toHaveBeenCalledOnce();
 expect(host.classList.contains('has-launch-dashboard')).toBe(false);
 dispose(); host.remove();
});

it('keeps the welcome state across Settings and Devices without undoing explicit connection navigation', () => {
 const host = document.createElement('main');
 host.innerHTML = '<button data-home>Devices</button><button data-settings>Settings</button>';
 document.body.append(host);
 const dispose = mountLaunchDashboard(host, {local: async()=>{}, share: async()=>{}, connect: ()=>{}});
 const panel = host.querySelector<HTMLElement>('.launch-dashboard')!;
 const home = host.querySelector<HTMLButtonElement>('[data-home]')!;
 const settings = host.querySelector<HTMLButtonElement>('[data-settings]')!;
 settings.click(); expect(panel.hidden).toBe(true);
 home.click(); expect(panel.hidden).toBe(false);
 expect(host.classList.contains('has-launch-dashboard')).toBe(true);
 panel.querySelector<HTMLButtonElement>('[data-launch="connect"]')!.click();
 settings.click(); home.click(); expect(panel.hidden).toBe(true);
 dispose(); host.remove();
});

it('returns to the welcome screen and restores focus when navigating back from Connect', () => {
 const host = document.createElement('main');
 document.body.append(host);
 try {
  const connect = vi.fn<(goBack: () => void) => void>();
  const dispose = mountLaunchDashboard(host, {local: async()=>{}, share: async()=>{}, connect});
  try {
   const button = host.querySelector<HTMLButtonElement>('[data-launch="connect"]')!;
   button.click();
   expect(host.classList.contains('has-launch-dashboard')).toBe(false);
   const [goBack] = connect.mock.calls[0]!;
   expect(goBack).toBeTypeOf('function');
   goBack();
   expect(host.classList.contains('has-launch-dashboard')).toBe(true);
   expect(document.activeElement).toBe(button);
  } finally { dispose(); }
 } finally { host.remove(); }
});

it('offers desktop sharing and connections without a local terminal entry',()=>{
 const host=document.createElement('main');document.body.append(host);
 const local=vi.fn(async()=>{});
 const dispose=mountLaunchDashboard(host,{local,share:async()=>{},connect(){}});
 expect(host.querySelector('[data-launch="local"]')).toBe(null);
 expect(host.textContent).not.toMatch(/terminal/i);
 document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));expect(local).not.toHaveBeenCalled();
 dispose();host.remove();
});
