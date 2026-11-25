/** Startup presentation shared by the native dashboard and its workbench adapter. */
export function mountLaunchDashboard(host: HTMLElement, actions: {
  local(): Promise<void>; share(): Promise<void>; connect(goBack: () => void): void;
}) {
  const d = host.ownerDocument;
  const panel = d.createElement('section');
  panel.className = 'launch-dashboard';
  panel.innerHTML = `<div class="launch-heading"><h1 aria-label="What would you like to do?">What would you<br>like to do?</h1><p>Connect to a Mac or share this desktop.</p></div>
    <div class="launch-actions">
      <button type="button" data-launch="share"><span class="launch-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="14" height="11" rx="2"/><path d="M5 19h8m-4-4v4"/><rect x="16" y="10" width="6" height="11" rx="1.5"/></svg></span><span><strong>Access this Mac remotely</strong><small>Use this desktop from another device.</small></span><span aria-hidden="true">→</span></button>
      <button type="button" data-launch="connect"><span class="launch-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 8h15l-4-4m5 12H5l4 4"/><path d="m19 8-4 4M5 16l4-4"/></svg></span><span><strong>Connect to another Mac</strong><small>Choose a Mac you’ve set up for sharing.</small></span><span aria-hidden="true">→</span></button>
    </div><p class="launch-error" role="alert" hidden></p>`;
  host.append(panel); host.classList.add('has-launch-dashboard');
  const error = panel.querySelector<HTMLElement>('.launch-error')!;
  const report = (e: unknown) => { error.hidden = false; error.textContent = e instanceof Error ? e.message : 'Please try again.'; };
  const connectButton = panel.querySelector<HTMLButtonElement>('[data-launch="connect"]')!;
  let welcome = true;
  const showWelcome = (show: boolean) => {
    host.classList.toggle('has-launch-dashboard', show);
    panel.hidden = !show;
  };
  const returnToWelcome = () => {
    welcome = true;
    showWelcome(true);
    connectButton.focus();
  };
  const connect = () => {
    welcome = false;
    showWelcome(false);
    actions.connect(returnToWelcome);
  };
  panel.querySelector<HTMLButtonElement>('[data-launch="share"]')!.onclick = () => { void actions.share().catch(report); };
  connectButton.onclick = connect;
  // Settings temporarily hides the welcome page; only an explicit connection action leaves it.
  const nav = (e: Event) => {
    const target = e.target as Element;
    if (target.closest('[data-settings]')) showWelcome(false);
    else if (target.closest('[data-home]')) showWelcome(welcome);
  };
  const escape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !panel.hidden && !d.querySelector('dialog[open]')) { e.preventDefault(); connect(); }
  };
  host.addEventListener('click', nav); d.addEventListener('keydown', escape);
  return () => { host.removeEventListener('click', nav); d.removeEventListener('keydown', escape); panel.remove(); host.classList.remove('has-launch-dashboard'); };
}
