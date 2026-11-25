import { mountLaunchDashboard } from "../../../web/src/shared/launch-dashboard.js";
import { E2E_STATUS, e2eRow, e2eSettings, isShareOnly, openClientView, type E2EInput } from "./e2e-row.js";
import { publishStatus, type PublicationState } from "./publish-status.js";
import { permissionRowAction, permissionRowLabel } from "./permissions.js";
import { mountDashboard, type Dashboard } from "../../../web/src/shared/dashboard.js";
import type { DeviceListState } from "../../../web/src/shared/device-list.js";
import { startTheme } from "../../../web/src/shared/theme.js";
import { mountE2ESetup, type SetupFlow } from "../../../web/src/shared/e2e-setup.js";
/**
 * The app UI. **The app PUSHES its state and this page asks for nothing while idle**
 * (`rdevApp.subscribe`, spec 2026-09-26-app-push-state): native code builds one snapshot on a
 * 250 ms change detector and sends it only when it differs. The 500 ms poll that used to live here
 * — seven bridge round trips per beat, and the page on §12.1's critical path — is gone.
 *
 * **The device list, the Devices/Settings nav and preference controls are SHARED with the browser
 * client** (`web/src/shared/`), which is why this file is bundled by esbuild rather than emitted by
 * tsc. Both dashboards show the same Macs from the same §12.2 directory; they were two hand-written
 * copies until 2026-09-14 and had already drifted. `docs/ui-design.md`.
 */

/** Mirrors what main's `app:state` handler returns — `hostState()` plus permissions. */
interface AppState {
  status: number;                 // 0 idle · 1 starting · 2 running · <0 failed
  code?: string;
  connectUrl?: string;
  qrDataUrl?: string;
  error?: string;
  permissions?: { screen: string; accessibility: boolean; asked?: { screen: boolean; accessibility: boolean } };
}

/**
 * Mirrors main's `app:account-state` handler. **There is no account behind it any more** — the
 * name was kept because the pushed state still carries it for the publication line, and renaming it
 * is a change to two files for no property.
 */
interface AccountState {
  publish: PublicationState;
}

/** Mirrors main's `app:sessions` handler, which reads §12.2's listing out of the dylib. */
interface DeviceListing {
  state: "loading" | "ready" | "error";
  error: string;
  refreshing: boolean;
  sessions: Array<{ name: string; code: string }>;
}

/** What `rdevApp.subscribe` delivers: exactly the union of what the retired poll read. */
interface PushedState {
  state: AppState;
  account: AccountState;
  e2e: E2EInput;
  capabilities: number;
  /** `sessions(refresh: false)` — names and codes, never a room token. */
  listing: DeviceListing;
}

declare global {
  interface Window {
    ShellstormMotion?: {
      begin(opts: {row?: HTMLElement; button?: HTMLElement; onCancel: () => void}): boolean;
      restore(connected?: boolean): void;
      unlight(row: HTMLElement): void;
      readonly active: boolean;
    };
    rdevApp: {
      dismissDashboard(): Promise<void>;
      state(): Promise<AppState>;
      /** The current snapshot at once, then every change. Returns the unsubscribe. */
      subscribe(callback: (state: PushedState) => void): () => void;
      openClient(pairing?: string, requestId?: string, motion?: MotionSettings): Promise<void>;
      openLocal?(requestId?: string, motion?: MotionSettings): Promise<void>;
      cancelConnect?(requestId: string): Promise<void>;
      onClientClosed?(callback: (requestId: string) => void): () => void;
      sessions?(refresh?: boolean): Promise<DeviceListing>;
      connectSession?(code: string, requestId?: string, motion?: MotionSettings): Promise<void>;
      share?(): Promise<void>;
      settings?(): Promise<{ autoShare: boolean; allowRemoteUpdates: boolean }>;
      setAutoShare?(on: boolean): Promise<{ autoShare: boolean }>;
      stop?(): Promise<void>;
      openPermission?(which: "screen" | "accessibility"): Promise<void>;
      requestPermission?(which: "screen" | "accessibility"): Promise<boolean>;
      e2eState?(): Promise<E2EInput>;
      e2eSignIn?(): Promise<CeremonyOutcome>;
      e2eCreatePasskey?(): Promise<CeremonyOutcome>;
      e2eAuthorise?(): Promise<CeremonyOutcome>;
      e2ePending?(): Promise<boolean>;
      e2eCapabilities?(): Promise<number>;
      e2eForget?(): Promise<boolean>;
      accountState?(): Promise<AccountState>;
      setChromeGap?(left: number, right: number, width: number): Promise<void>;
    };
  }
}

/**
 * The host's listing, as the shared list's state. Pure: the pushed snapshot and the 15 s forced
 * refresh both come through here, so they cannot disagree about what a listing means.
 */
function toDeviceListState(listing: DeviceListing | undefined, isEnrolled: boolean): DeviceListState {
  if (!isEnrolled) return { kind: "no-identity" };
  if (!listing || listing.state === "error") return { kind: "unreachable" };
  // The host answers the fetch on a later tick, and pushes the answer when it lands.
  if (listing.state === "loading") return { kind: "loading" };
  return { kind: "ready", devices: listing.sessions.map(s => ({ label: s.name, code: s.code })) };
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// **Through `theme.ts`, which the browser client already used.** The app read and wrote
// `rdev.theme` by hand here, so it had neither the system-preference fallback nor the change
// listeners — a Mac in light mode opened a dark app with nothing stored. It follows the OS now, the
// way the browser always has, and Settings still overrides and persists.
startTheme();

const initialView = new URLSearchParams(location.search).get("view");
const sharingPanel = $("share");
const detailTitles = { share: "Share this Mac", connect: "Connect to another Mac" };
let backFromDetail: (() => void) | null = null;

function showDashboardDetail(view: keyof typeof detailTitles, goBack: () => void): void {
  backFromDetail = goBack;
  $("dashboard-detail-title").textContent = detailTitles[view];
  document.documentElement.dataset.view = view;
  sharingPanel.hidden = view !== "share";
  $(view === "share" ? "share" : "home-devices").scrollTop = 0;
  $("dashboard-detail-back").focus();
}

function hideDashboardDetail(): void {
  document.documentElement.dataset.view = "home";
  sharingPanel.hidden = true;
  backFromDetail = null;
}

function returnFromDashboardDetail(): void {
  const goBack = backFromDetail;
  hideDashboardDetail();
  goBack?.();
}

function showSharing(opener: HTMLElement | null = null): void {
  showDashboardDetail("share", () => {
    (opener ?? $("home").querySelector<HTMLElement>("button[data-home]"))?.focus();
  });
}

function showError(error: unknown): void {
  dashboard.showError(error instanceof Error ? error.message
                                             : "Something went wrong. Please try again.");
}
/// What a new client window is handed (`ClientURL.make`): it is another origin, with its own storage.
interface MotionSettings { debug: boolean; slow: boolean }
const motionSettings = (): MotionSettings => ({
  debug: location.hash === "#debug" || new URLSearchParams(location.search).has("debug"),
  slow: document.documentElement.style.getPropertyValue("--motion-scale") === "10",
});
const connectedRows = new Map<string,HTMLElement>();
window.rdevApp.onClientClosed?.(id => {
  const row = connectedRows.get(id);
  if (row) window.ShellstormMotion?.unlight(row);
  connectedRows.delete(id);
});
let connectionRequest = 0;
let localOpening = false;
async function connectWithMotion(start: (requestId: string) => Promise<void>, row?: HTMLElement): Promise<void> {
  const requestId = String(++connectionRequest);
  let cancelled = false;
  const motion = window.ShellstormMotion;
  if (motion && !motion.begin({row, button:row ? undefined : document.querySelector<HTMLElement>("[data-connect-quick]")!, onCancel:() => {
    cancelled = true;
    connectedRows.delete(requestId);
    void window.rdevApp.cancelConnect?.(requestId).catch(showError);
  }})) return;
  if (row) connectedRows.set(requestId,row);
  dashboard.showError("");
  try { await start(requestId); if (!cancelled) motion?.restore(true); }
  catch (error) { connectedRows.delete(requestId); if (!cancelled) {motion?.restore(); showError(error);} }
}
/** Whether this Mac has an identity to list under — the gate the sign-in state used to be. */
let enrolled = false;

/** What one of the Mac's passkey ceremonies ended with (`E2EHost.CeremonyOutcome`). */
interface CeremonyOutcome { ok: boolean; reason?: string; rootId?: string; deviceId?: string }

/**
 * **SIGNING IN, ON THE MAC ITSELF** (2026-10-06): the browser's sign-in panel (`e2e-setup.ts`, one
 * implementation for both dashboards), driven by the Mac's NATIVE passkey ceremony — `ASAuthorization`
 * on this app, where it used to send the person to a browser and poll a courier. Each bridge call
 * resolves when its prompt does; everything else (the identity, the device list) arrives pushed.
 * Deleting a stranded passkey is the browser's alone (the Signal API), so it is never offered here.
 */
const macSetup: SetupFlow = {
  device: "mac",
  enroll: async (source, onStep) => {
    const outcome = (r: CeremonyOutcome | undefined) => r?.ok
      ? { ok: true as const, deviceId: r.deviceId ?? "", rootId: r.rootId ?? "" }
      : { ok: false as const, reason: r?.reason ?? "bridge" };
    if (source === "discover") return outcome(await window.rdevApp.e2eSignIn?.());
    if (source === "create") {
      const made = await window.rdevApp.e2eCreatePasskey?.();
      if (!made?.ok) return outcome(made);
      // The panel's Continue between the two prompts, as in the browser: "Not now" keeps the passkey,
      // and the form offers Finish setting up next time.
      if (await onStep?.("authorising") === false) return { ok: false, reason: "dismissed" };
    }
    return outcome(await window.rdevApp.e2eAuthorise?.());
  },
  pending: async () => ({ resume: (await window.rdevApp.e2ePending?.()) === true, discard: false }),
  discard: async () => ({ ok: false, reason: "unsupported" }),
  done: () => {},
};

function openSetup(): void {
  const panel = document.getElementById("e2e-setup");
  if (panel) mountE2ESetup(panel, macSetup);
}

/**
 * **THE DASHBOARD, and it is the browser client's** (`web/src/shared/dashboard.ts`): the header,
 * "Your workspace, anywhere", the quick-connect field, My Devices, Settings and the profile alert
 * are one implementation that both surfaces mount. What is passed in is everything only a Mac can
 * answer — where the listing comes from (the dylib, through one IPC channel), what connecting does
 * (a native window, not a navigation), and what logging out means.
 *
 * **SIGNING IN IS THE MAC'S OWN** since 2026-10-06 (`macSetup` above): the same panel and the same
 * "Sign in with a passkey" the browser's empty list offers, run as a native passkey ceremony.
 */
const dashboard: Dashboard = mountDashboard({
  host: $("home"),
  beforeShowPage: hideDashboardDetail,
  adapter: {
    surface: "mac",

    listDevices: async (force) => {
      // The 15 s safety net (`device-poll.ts`) and the refresh button: ask the host to FETCH. What
      // it holds between those arrives pushed, through `applyDevices` below.
      if (!enrolled) return { kind: "no-identity" };
      try {
        return toDeviceListState(await window.rdevApp.sessions?.(force) as DeviceListing | undefined, enrolled);
      } catch (error) {
        // A throw here is a broken bridge, not a silent control plane — so the specific reason goes
        // to the error line in its own words, and the list falls back to the advice that is true
        // either way: a connection link can open the Mac directly.
        showError(error);
        return { kind: "unreachable" };
      }
    },

    // **A SHARE-ONLY MAC CANNOT CONNECT OUT, and says so instead of failing.** The client window at
    // `app://client/` needs a subordinate grant, and a Mac without `enroll` cannot issue one —
    // pressing this would surface as "this Mac refused to certify its own window", which names
    // neither the cause nor the fix.
    connect: (code, row) => {
      const gate = openClientView({ capabilities });
      if (!gate.enabled) { showError(new Error(gate.reason)); return; }
      void connectWithMotion(
        id => window.rdevApp.connectSession?.(code, id, motionSettings()) ?? Promise.resolve(), row);
    },

    // **THE PAIRING PARSER IS THE CLIENT'S.** Raw input goes to `main`, which hands it to the client
    // window in a fragment; there is still only one `parsePairing` in the product.
    quickConnect: (raw) => {
      const gate = openClientView({ capabilities });
      if (!gate.enabled) { showError(new Error(gate.reason)); return; }
      void connectWithMotion(id => window.rdevApp.openClient(raw, id, motionSettings()));
    },

    // **THIS MAC NEEDS NOTHING**: no enrollment, no Worker, no permission — the bridge to this app's own
    // host is the whole connection (docs/desktop-app.md, "The local window"), so no gate stands before it.

    identity: async () => {
      const id = identityCode;
      return id ? { kind: "signed-in", identity: id } : { kind: "signed-out" };
    },

    // **The alert IS the confirmation** — it carries the warning that logging out revokes nothing
    // and how to come back — so this acts. Everything that happens next arrives pushed, which is
    // why nothing here waits: the status returns to `unenrolled` and the devices page
    // offers to sign in again.
    logOut: () => { void window.rdevApp.e2eForget?.(); },

    signIn: openSetup,
  },
});

const dashboardTitle = $("home").querySelector<HTMLElement>(".ss-dashboard-title")!;
dashboardTitle.after($<HTMLTemplateElement>("dashboard-detail-header").content);

// ClientChrome can drag only the part of the title bar that contains no controls. Measure the
// dashboard title and trailing actions after layout, including when the identity button
// appears or the window resizes. The native grip and the workbench use the same report.
{
  const header = document.querySelector<HTMLElement>(".ss-header");
  const detailHeading = $("dashboard-detail-heading");
  const actions = header?.querySelector<HTMLElement>(".ss-header-actions");
  if (header && actions) {
    let pending = 0;
    let last = "";
    const measure = () => {
      pending = 0;
      const origin = header.getBoundingClientRect().left;
      // Leave a little space between the drag area and the header content.
      const leftControls = backFromDetail ? detailHeading : dashboardTitle;
      const left = Math.ceil(leftControls.getBoundingClientRect().right - origin + 6);
      const right = Math.floor(actions.getBoundingClientRect().left - origin - 4);
      const width = Math.round(window.innerWidth);
      const span: [number, number, number] = right > left ? [left, right, width] : [0, 0, width];
      const key = span.join(":");
      if (key !== last) {
        last = key;
        void window.rdevApp.setChromeGap?.(...span)?.catch(console.error);
      }
    };
    const schedule = () => { if (!pending) pending = requestAnimationFrame(measure); };
    new ResizeObserver(schedule).observe(header);
    new ResizeObserver(schedule).observe(dashboardTitle);
    new ResizeObserver(schedule).observe(detailHeading);
    new ResizeObserver(schedule).observe(actions);
    new MutationObserver(schedule).observe(actions, { attributes: true, subtree: true, attributeFilter: ["hidden"] });
    window.addEventListener("resize", schedule);
    schedule();
  }
}

/**
 * **The app's OWN rows, moved into the shared page's slots.** They live in `index.html` rather than
 * being built here so that the markup a person inspects is the markup that ships — and they are
 * moved rather than copied, because a `<template>`'s contents are inert until they are: nothing
 * below could find `#door-share` by id while it sat in one.
 */
for (const [slot, id] of [[dashboard.lead, "home-extras-lead"],
                          [dashboard.settings, "home-extras-settings"],
                          [dashboard.headingActions, "home-add-mac-action"]] as const) {
  slot.appendChild($<HTMLTemplateElement>(id).content);
}

$("home-add-device").addEventListener("click", () => {
  const dialog = $<HTMLDialogElement>("add-mac-help");
  if (!dialog.open) dialog.showModal();
});

/**
 * **Auto share on start.** Main owns the value — it decides at startup, before this page exists — so
 * the box shows what main has STORED, read once here and replaced by main's answer after every
 * change. Disabled until that first read: a box that could be clicked before it says anything would
 * let a person turn off a setting they had no way of seeing was on.
 */
{
  const box = $<HTMLInputElement>("auto-share");
  box.disabled = true;
  void window.rdevApp.settings?.().then((s) => { box.checked = s.autoShare; box.disabled = false; });
  box.addEventListener("change", () => {
    void window.rdevApp.setAutoShare?.(box.checked).then((s) => { box.checked = s.autoShare; });
  });
}

/**
 * §10.3's capability the last pushed state carried. **0 means unknown and never a restriction** — an older
 * `main` sends none and an unreadable library reports it, and disabling a working button for either
 * would be a claim that is not true.
 */
let capabilities = 0;
/** The last identity pushed, as §10.1's readable code. Empty means this Mac belongs to none. */
let identityCode = "";

let permissionKey = "";


for (const id of ["door-share", "settings-sharing-open"]) {
  const button = $<HTMLButtonElement>(id);
  button.addEventListener("click", () => showSharing(button));
}
$("dashboard-detail-back").addEventListener("click", returnFromDashboardDetail);
document.addEventListener("keydown", event => {
  if (!backFromDetail || event.key !== "Escape" || document.querySelector("dialog[open]")) return;
  event.preventDefault();
  event.stopPropagation();
  returnFromDashboardDetail();
}, { capture: true });
$("settings-account-action").addEventListener("click", () => {
  if (enrolled) dashboard.confirmSignOut();
  else openSetup();
});
const sharingError = (error: unknown) => {
  $("status").textContent = error instanceof Error ? error.message : "Could not update sharing.";
};
$("start-sharing").addEventListener("click", () => { void window.rdevApp.share?.().catch(sharingError); });
$("stop").addEventListener("click", () => { void window.rdevApp.stop?.().catch(sharingError); });
/** One copy button's behaviour: write `source`'s text, then confirm on the button itself. */
function wireCopy(buttonId: string, sourceId: string): void {
  $(buttonId).addEventListener("click", async () => {
    const text = $(sourceId).textContent ?? "";
    if (!text || text === "\u2014" || text === "starting\u2026" || text === "…") return;
    await navigator.clipboard.writeText(text);
    const b = $(buttonId);
    if (b.textContent === "Copied") return;
    const label = b.textContent;
    b.textContent = "Copied";
    setTimeout(() => { b.textContent = label; }, 1200);
  });
}
wireCopy("copy-link", "connect-url");

function render(s: AppState): void {
  $("status").textContent = s.error
    ? `Error: ${s.error}`
    : s.status === 2 ? "Sharing is on" : s.status === 1 ? "Starting sharing…" : "Sharing is off.";

  // A data-URL <img>, not innerHTML of the SVG: `img-src 'self' data:` already allows it, and it
  // keeps the CSP free of 'unsafe-inline' while removing the HTML-injection surface entirely.
  $("share-connection").hidden = s.status !== 2;
  $("sharing-connect-wait").hidden = s.status === 2;
  $("stop").hidden = s.status !== 2;
  $("start-sharing").hidden = s.status === 2;
  $<HTMLButtonElement>("start-sharing").disabled = s.status === 1;
  $("start-sharing").textContent = s.status === 1 ? "Starting…" : "Start sharing";
  const img = $<HTMLImageElement>("qr-img");
  if (s.qrDataUrl && img.src !== s.qrDataUrl) img.src = s.qrDataUrl;
  $("sharing-scan").hidden = !s.qrDataUrl;

  // SHOWN ONLY ONCE THERE IS A REAL URL. A placeholder here would be worse than nothing: this is a
  // value people copy and send, so an em-dash or a half-formed address is something they can act on
  // wrongly. Both the label and the row hide together, or the label captions an empty box.
  $("connect-url").textContent = s.connectUrl ?? "";
  $("link-hint").hidden = !s.connectUrl;
  $("link-row").hidden = !s.connectUrl;

  $("local-state").textContent = s.status === 2 ? "Sharing · ready to connect" : s.status === 1 ? "Starting sharing…" : s.error ? `Sharing failed: ${s.error}` : "Use this Mac from your other devices.";
  $("door-share").textContent = s.status === 2 ? "Sharing settings" : "Set up sharing";
  const perms = $("perms");
  // A push about something else must not replace a focused permission button.
  const nextPermissions = JSON.stringify(s.permissions);
  if (nextPermissions === permissionKey) return;
  permissionKey = nextPermissions;
  perms.replaceChildren();
  $("permissions-loading").hidden = Boolean(s.permissions);
  perms.hidden = !s.permissions;
  if (s.permissions) {
    const rows = [
      { label: "Screen Recording", help: "Lets your other device see this Mac’s screen.", ok: s.permissions.screen === "granted", which: "screen" },
      { label: "Accessibility", help: "Lets you use your mouse and keyboard to control this Mac from the other device.", ok: s.permissions.accessibility, which: "accessibility" },
    ] as const;
    for (const { label, help, ok, which } of rows) {
      const row = document.createElement("div");
      row.className = "sharing-row sharing-permission";
      const details = document.createElement("div");
      const name = document.createElement("span");
      name.className = "sharing-label";
      name.textContent = label;
      const description = document.createElement("p");
      description.textContent = help;
      details.append(name, description);
      row.append(details);
      if (ok) {
        const status = document.createElement("span");
        status.className = "permission-allowed";
        status.textContent = "Allowed";
        status.setAttribute("aria-label", label + " allowed");
        row.append(status);
      } else {
        // ASK FIRST, Settings once asking is spent. macOS shows each prompt once per app
        // signature and never again, so a second Grant would be a button that does nothing —
        // and it cannot be told apart from "declined", because both preflight false. `asked`
        // is main's own memory of what this run has requested; absent (an older main) leaves
        // the row exactly as it was, a plain Settings link.
        const b = document.createElement("button");
        const action = permissionRowAction(s.permissions?.asked?.[which]);
        b.type = "button";
        b.textContent = action === "grant" ? "Allow" : permissionRowLabel(action);
        b.setAttribute("aria-label", b.textContent + " for " + label);
        b.addEventListener("click", () => {
          if (action === "settings") { void window.rdevApp.openPermission?.(which); return; }
          // The reply is usually false and that is not a refusal: the Accessibility dialog only
          // offers Settings, and Screen Recording needs a relaunch. Either way the grant lands
          // through the pushed state, and `asked` flips this row to Settings when it does.
          b.disabled = true;
          void window.rdevApp.requestPermission?.(which).finally(() => { b.disabled = false; });
        });
        row.appendChild(b);
      }
      perms.appendChild(row);
    }
  }
}

/**
 * The publication line — all that is left of what used to be the account row.
 *
 * The DECISION is `publishStatus` (pure, tested); this only paints it. Claiming a Mac is listed
 * when it is not is worse than saying nothing — but so is silence when it has dropped out, which is
 * what the old boolean did.
 */
function renderAccount(s: AccountState): void {
  const published = $("published");
  const pub = publishStatus(s.publish);
  published.hidden = pub.hidden;
  published.textContent = pub.text;
  published.dataset.tone = pub.tone;
}

/**
 * The encryption row. The DECISION is `e2eRow` (pure, tested); this only paints it — the same split
 * `publishStatus` uses, and for the same reason: §10.1's requirement that the interface NAME the
 * identity being adopted lives in a line of text, and a line of text is otherwise untestable here.
 */
let e2eKey = "";
function renderE2E(state: E2EInput): void {
  const row = $("e2e");
  // A push about something else must not replace a focused button, or rebuild the id under a
  // selection while someone is reading it against their browser. Same guard the permission rows carry.
  const next = JSON.stringify(state);
  if (next === e2eKey) return;
  e2eKey = next;

  // **THE DEVICE LIST IS GATED ON AN IDENTITY, which is what sign-in used to gate it on.** A Mac
  // with no committed chain has no root whose rooms it could ask for, and every `ready` variant does
  // — §12.2's two unconfirmed-publication codes included, since those are about THIS Mac's own
  // listing and say nothing about its ability to read the directory.
  const READY: number[] = [E2E_STATUS.ready, E2E_STATUS.readyListingNotConfirmed,
                           E2E_STATUS.readyPublicationRejected];
  const nowEnrolled = READY.includes(state.status);
  // The list is gated on this, and the same push applies the listing right after — the refresh
  // control appears and disappears with the state (`deviceListView.canRefresh`) rather than being
  // a static button this file hides.
  enrolled = nowEnrolled;
  // The header button, from the identity's OWN ABI function. Empty means this Mac belongs to no
  // identity, which is exactly when there is no profile to offer.
  identityCode = state.identity ?? "";
  capabilities = state.capabilities ?? 0;
  dashboard.refreshIdentity();

  // **Settings first: it is the surface that always has something to say.** The row below is for
  // what a person must DO; a working Mac shows nothing there, which is the whole point of `hidden`.
  const settings = e2eSettings(state);
  const section = $("e2e-settings");
  section.dataset.tone = settings.tone;
  $("e2e-settings-body").textContent = state.status === E2E_STATUS.unenrolled && !state.detail
    ? "Not signed in. Sign in to connect and share."
    : state.status === E2E_STATUS.ready && !isShareOnly(state) ? "Signed in on this Mac." : settings.body;
  $("e2e-settings-technical").textContent = state.status === E2E_STATUS.unenrolled && !state.detail
    ? "Sign in to link this Mac with your other devices." : settings.body;
  $("e2e-settings-group").textContent = state.identity ?? "";
  $("e2e-settings-group-row").hidden = !state.identity;
  const accountAction = $<HTMLButtonElement>("settings-account-action");
  accountAction.textContent = nowEnrolled ? "Sign out" : "Sign in";
  accountAction.classList.toggle("danger", nowEnrolled);
  accountAction.disabled = state.status === E2E_STATUS.enrolling;
  // textContent, never innerHTML: this string comes from the host library by way of a ceremony.
  $("e2e-settings-device").textContent = settings.deviceId;
  $("e2e-settings-device-row").hidden = settings.deviceId === "";

  // **§10.3's upgrade, and the only place it is offered.** A share-only Mac is working as intended,
  // so the row below stays silent about it; this is where the limit is stated and so it is where the
  // way past it belongs. Rebuilt with the section, which the state key already guards against a
  // push stealing focus.
  const settingsAction = $("e2e-settings-action");
  settingsAction.replaceChildren();
  settingsAction.hidden = settings.action === null;
  if (settings.action) {
    const b = document.createElement("button");
    b.id = "e2e-upgrade";
    b.textContent = settings.action.label;
    b.addEventListener("click", () => {
      b.disabled = true;
      // ONE prompt for this Mac's OWN root's passkey: a ceremony is refused on an enrolled Mac EXCEPT
      // for this case (`E2EUpgrade.mayUpgrade`), and the new capability arrives pushed.
      void Promise.resolve(window.rdevApp.e2eSignIn?.()).finally(() => { b.disabled = false; });
    });
    settingsAction.appendChild(b);
  }

  const view = e2eRow(state);
  row.hidden = view.hidden;
  // EMPTIED, not merely hidden: a row left holding "Add this Mac to this identity?" is a question
  // still in the document after it has been answered.
  if (view.hidden) { row.replaceChildren(); return; }
  row.dataset.tone = view.tone;
  row.textContent = state.status === E2E_STATUS.unenrolled && !state.detail
    ? "" : view.text;

  if (view.identity) {
    const id = document.createElement("code");
    id.className = "e2e-identity";
    // textContent, never innerHTML: this string comes from the host library by way of a ceremony.
    id.textContent = view.identity;
    row.appendChild(id);
  }
  if (view.kind === "sign-in" && enrolled) {
    const b = document.createElement("button");
    b.id = "e2e-sign-in";
    b.textContent = view.action ?? "";
    // The panel, as the device list's empty state opens it — one flow, two entrances.
    b.addEventListener("click", openSetup);
    row.appendChild(b);
  }
  row.hidden = !row.hasChildNodes();
}

/**
 * **ONE SUBSCRIPTION, and nothing polls.** The snapshot is the union of what the page used to read
 * every 500 ms; each piece goes to the renderer it always went to, and every renderer keeps its
 * early return on an unchanged state — they protect focus and the connection animation, because a
 * push about ANY part of the state re-renders every part. The listing goes LAST, so it reads the
 * `enrolled` that `renderE2E` just wrote.
 */
window.rdevApp.subscribe((s: PushedState) => {
  try {
    render(s.state);
    renderAccount(s.account);
    // §10.3's capability rides beside e2e rather than in it: it is orthogonal to status (a Mac at
    // capability 2 is `ready`, not a degraded `ready`).
    const e2e: E2EInput = { ...s.e2e, capabilities: s.capabilities };
    renderE2E(e2e);
    dashboard.applyDevices(toDeviceListState(s.listing, enrolled));
  } catch (error) { showError(error); }
});

export {};

if (initialView === "launch" || initialView === "share") {
  mountLaunchDashboard($("home"), {
    local: () => window.rdevApp.dismissDashboard(),
    share: async () => showSharing($("home").querySelector<HTMLElement>('[data-launch="share"]')),
    connect: goBack => showDashboardDetail("connect", goBack),
  });
}

if (initialView === "share") showSharing();
