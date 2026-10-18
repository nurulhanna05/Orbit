# AnomalyGuard: Audit Report

**Date:** 2026-10-19  **Scope:** full repository at `A-AI-main/`, dev server (`next dev`, port 3123), production static export (`out/`), and a clean `npm ci` + build in an isolated copy.
**Method:** read-only. No source file was modified; this report is the only file created.

> **Update 2026-10-19 — fixes applied** (verified at runtime in Chrome; `tsc`, `next lint` and `next build` pass):
> - **F-01** Plaintext password removed from the bundle (salted SHA-256 in `config/auth.config.json`, pure-JS hash in `lib/auth/sha256.ts`); sessions expire after 12 h and are validated on load; build-time override `NEXT_PUBLIC_ANOMALYGUARD_LOGIN_USER` / `_SHA256` replaces the demo account and hides its hint. *Still client-side only: a static export cannot enforce auth (see README → Security model).*
> - **F-02** Sandbox in mock mode blurs the whole frame, draws no fake face patches, and labels detections "Simulated · clip not analysed"; blob URLs revoked.
> - **F-03 / F-04** Stored snapshots are always anonymised; the shield only affects the live view. Both toggles share one confirm dialog with a logged reason. Copy and README updated.
> - **F-06 / F-19** Reset requires confirmation, keeps the audit trail and logs itself; audit entries record the operator.
> - **F-07 / F-10 / F-11** Alert↔ticket transitions kept in sync both ways; repeat detections fold into the open alert (no duplicate wear); crowd counts mean-revert to each zone's baseline. F-12 (tick lost-update) fixed along the way.
> - Not yet addressed: everything else in §4.

---

## 1. Executive summary

AnomalyGuard is in **good working shape for a demo**. It type-checks with zero errors, lints with zero warnings, builds a 12-route static export, installs and builds cleanly from `npm ci` on Node 26, and the full demo flow (all six classes, dispatch, ticketing, resolve, re-open, shield toggle, camera controls, CSV export, sandbox upload, reset) ran in Chrome with **no runtime errors**. The only console output is a known Recharts dev warning. Links and cross-links all resolve, and there are no leftover references to the original project's security, identity or author content.

The serious problems are about **trust, not crashes**:

1. **Privacy claims the code does not fully back up.** This is the core of the pitch. The Model Sandbox shows a "Faces anonymised" badge over unblurred uploaded footage. The Privacy Shield toggle implies raw faces are retained, contradicting "blurred at the edge before storage". The audit trail can be silently wiped.
2. **No real authentication.** The `admin/admin` password ships inside the client JavaScript, and the session is a localStorage flag anyone can forge. This is fine for a local hackathon demo but unsafe if the static build is put on a public URL.
3. **Several state sync bugs** between alerts, tickets and assets, all reproduced at runtime.

| Severity | Count |
|---|---|
| Critical | 2 |
| High | 4 |
| Medium | 13 |
| Low | 14 |
| **Total** | **33** |

---

## 2. Project overview

**Purpose.** A privacy-first situational awareness and predictive maintenance dashboard for Sime Darby Property townships (demo: City of Elmina). It detects object states (lamp off, bin overflow, pipe leak, ramp obstructed), posture (fall) and anonymous crowd density, then turns detections into alerts, contractor tickets and asset-lifespan impact.

**Tech stack.** Next.js 13.5.1 (App Router, `output: 'export'`), React 18.2, TypeScript 5.2 (strict), Tailwind 3.3, shadcn/ui (Radix), Recharts 2, date-fns 3, Framer Motion. There is no backend. A FastAPI + YOLOv8 seam is defined in `lib/anomaly/api.ts`.

**Route map** (all statically exported, all client-rendered):

| Route | Page |
|---|---|
| `/` | Login |
| `/dashboard` | Overview |
| `/dashboard/cameras/live` | Live Zones (multi-feed + viewer modal) |
| `/dashboard/alerts` | Alert Centre (`?focus=<alertId>`) |
| `/dashboard/tickets` | Maintenance Tickets (`?focus=<ticketId>`) |
| `/dashboard/assets` | Asset Health + wear log |
| `/dashboard/analytics` | Analytics & Reports + CSV |
| `/dashboard/cameras` | Camera controls |
| `/dashboard/health` | Edge & IoT Health |
| `/dashboard/sandbox` | Model Sandbox |
| `/dashboard/settings` | Settings (`?tab=general\|detection\|privacy\|simulation\|retention`) |

**Folder structure (relevant parts).**

```
app/                     routes above
components/anomaly/      zone-feed (SVG scene + anonymous boxes), camera-viewer, alert-snapshot,
                         privacy-shield, simulate-menu, asset-ticker
components/providers/    anomaly-provider (the store), auth-provider, theme-provider
components/layout/       app-shell, header, sidebar, nav-links, mode-toggle
components/settings/     retention-settings (only survivor of the original settings tabs)
components/ui/           43 shadcn components (24 unused, see §6)
lib/anomaly/             taxonomy, simulator, scenes, seed, api, infrastructure, csv
lib/types.ts             domain types
config/                  auth.config.json (used), general.config.json (orphaned)
```

**Data flow.**

```
seed.ts ──buildSeedState()──▶ AnomalyProvider (React state, mirrored to localStorage "anomalyguard-state")
                                   ▲            │
simulator.ts ──buildAlert()──▶ ingestAlert() ──┤──▶ applyWear() → assets + wear log
api.ts (poll, only if NEXT_PUBLIC_ANOMALYGUARD_API set) ──┘
                                                │
                     useAnomaly() ◀─────────────┘  consumed by every page / component
3-second tick: crowd-count drift → auto crowd_density alerts; optional auto-simulate interval
```

---

## 3. Feature inventory

| Feature (from brief) | Status | Evidence |
|---|---|---|
| Removal of face recognition, enrolment, attendance, "Authorized Entry", person tracking | **Complete** | Grep for `secureview\|intruder\|attendance\|enrol\|authorized entry\|andhra\|github` returns only intentional pitch copy (`app/dashboard/page.tsx:77-78`, `settings/page.tsx:235`, `README.md:5,11,49`). |
| Rebrand to AnomalyGuard, SDP Township · City of Elmina | **Complete** | `app/layout.tsx`, `components/layout/header.tsx` Brand, `lib/anomaly/seed.ts` TOWNSHIP |
| Live camera grid / multi-feed | **Complete** | `app/dashboard/cameras/live/page.tsx`; verified at runtime |
| System health → edge / IoT / infra | **Complete** (mock) | `app/dashboard/health/page.tsx`, `lib/anomaly/infrastructure.ts` |
| Video upload sandbox | **Partial** | Upload, timeline and push-to-alerts work. Mock inference fabricates detections unrelated to the clip, and the blur claim is false on real footage (F-02). |
| Notification framework → operational alerts | **Complete** | Header bell + toasts (`anomaly-provider.tsx:162-168`) |
| 1. Detection classes (6) | **Complete** | `lib/anomaly/taxonomy.ts:16-71`; all six simulated at runtime |
| 2. Privacy Shield badge/toggle + blur patches + anonymous labels | **Partial** | Badge, confirm dialog (header path), audit and blur patches all work. Gaps: F-02, F-03, F-04, F-06. |
| 3. Alerts: severities, dispatch, resolved history + re-open, spawn ticket | **Complete, with sync bugs** | Verified at runtime; see F-07 |
| 4. Tickets: open / in-progress / resolved, contractors, live status, reassign | **Complete, with sync bugs** | Verified at runtime; see F-07 |
| 5. Predictive maintenance: ticker + wear log + lifespan impact | **Partial** | Works, but wear can be charged to the wrong asset (F-08). The model is linear and illustrative. |
| 6. Analytics by class/camera, avg confidence, CSV export | **Complete** | Three CSVs captured at runtime (56/22/7 lines), no personal data |
| 7. Camera controls: online/offline, filters, thresholds, intervals | **Partial** | Toggles and filters work. Thresholds have little effect and the interval has none in simulation mode (F-14). |
| 8. Simulation | **Complete** | Header/overview/live menus, auto-simulate, auto crowd alerts. Noisy (F-11), duplicates (F-10). |
| 9. Branding as a real Sime Darby property | **Complete** | "SDP Township · City of Elmina" throughout |
| README rewritten | **Complete, minor drift** | Payload and endpoints match `api.ts`; privacy claims overstate (§5) |

---

## 4. Findings

Sorted by severity. Effort: **S** < 1h, **M** 1–4h, **L** > 4h.
"Verified" means reproduced at runtime; "Code" means found by reading only.

### Critical

| ID | Area | File:line | Description | How to reproduce | Suggested fix | Effort |
|---|---|---|---|---|---|---|
| F-01 | Auth / security | `components/providers/auth-provider.tsx:4`, `config/auth.config.json`, `components/auth/auth-guard.tsx:16-38` | **Plaintext credentials ship to the browser and auth is client-side only.** `auth.config.json` (password `admin`) is imported into a client component, and the string `password:"admin"` is present in `out/_next/static/chunks/app/page-*.js`, `app/layout-*.js` and `app/dashboard/layout-*.js`. Route protection is a `useEffect` redirect keyed on a localStorage object (`anomalyguard-user`) that anyone can set. With `output: 'export'` there is no server to enforce anything. (Verified: I logged in during testing by writing that key directly.) | Open DevTools → `localStorage.setItem('anomalyguard-user','{"id":"1","name":"x","username":"x","role":"admin"}')` → reload `/dashboard`. Or search the built JS for `password`. | For the hackathon: state clearly that it is a demo login, and don't deploy publicly with the dashboard reachable. Post-hackathon: real auth (FastAPI + OIDC/session cookie) and drop the static export or put it behind an authenticating proxy. At minimum, remove the password from the bundle (hash or env-gated demo mode). | S (demo) / L (real) |
| F-02 | Privacy | `app/dashboard/sandbox/page.tsx:109`, `:57-80`, `:145-178` | **Sandbox shows "Faces anonymised" over raw, unblurred uploaded footage.** Mock inference ignores the video content. It fabricates boxes such as "Fallen Posture (Face Blurred)" and "Pedestrian (Face Blurred)", and draws blur patches at the simulator's random positions. Real faces in the clip are **never** blurred, while the header says "Faces are blurred in the preview". | Verified: generated a 2.2 s webm with no people (a yellow circle), uploaded it and ran analysis. It produced 6 detections incl. "Fallen Posture (Face Blurred)", 11 boxes and 9 blur patches at unrelated positions, plus a "Faces anonymised" badge on the raw video. | Before the hackathon: change the copy to "Simulated detections (no model attached). Footage is not processed", hide the "Faces anonymised" badge when no backend is attached, and blur the whole video (CSS `filter: blur()`) in mock mode so real faces are never shown. Post: real edge-side face blurring. | S |

### High

| ID | Area | File:line | Description | How to reproduce | Suggested fix | Effort |
|---|---|---|---|---|---|---|
| F-03 | Privacy (design claim) | `components/anomaly/zone-feed.tsx:142-157` (Head), `components/anomaly/alert-snapshot.tsx:13-22`, `components/anomaly/camera-viewer.tsx:55`, `app/dashboard/alerts/page.tsx:327`, `app/dashboard/settings/page.tsx:238`, `README.md:52` | **The Privacy Shield toggle contradicts the "blurred at the edge before storage" claim.** Turning the shield off re-renders live feeds *and stored alert snapshots* with visible faces. If blurring really happened on the edge before storage, there would be nothing to un-blur. A sharp judge can ask "so you do keep raw faces?" | Verified: toggle the shield off → open any alert's Frame → faces render un-mosaiced. | Pick one story. **(a)** Edge blurring is irreversible: the toggle only changes overlay labels and the snapshot is always blurred. **(b)** Raw frames are retained under strict access: then say so and drop "before storage" from the copy and README. (a) is the stronger PDPA story. | S |
| F-04 | Privacy / audit | `app/dashboard/settings/page.tsx:231` | **The Settings switch disables the shield without confirmation.** The header path shows an AlertDialog (`privacy-shield.tsx:71-91`), but the Settings → Privacy & PDPA switch calls `setPrivacyShield` directly. It is still audited. | Verified: clicking the Settings switch set `privacyShield=false` with no dialog; the header path showed the dialog. | Reuse the same confirm dialog, or route both through one component. | S |
| F-05 | Backend seam / robustness | `lib/anomaly/api.ts:31-48`, `:53`; `components/providers/anomaly-provider.tsx:52,156-160` | **Unvalidated edge payloads can crash the whole dashboard and bypass anonymisation.** `res.json()` is trusted as-is. An unknown `class_name` makes `DETECTION_CLASSES[cls]` undefined, so `meta.assetType` throws *inside a setState updater* and React unmounts the app. A missing `boxes` or `xyxy` also throws. `b.label` is passed through verbatim (`api.ts:40`), so a backend label like a name would be displayed. `face_blurred: false` is ignored and the UI still claims anonymisation. | Code (no backend available). Point `NEXT_PUBLIC_ANOMALYGUARD_API` at a stub returning `[{"camera_id":"CAM-01","class_name":"fire",...}]`. | Validate with zod (already a dependency). Drop or quarantine unknown classes. Map labels through an allowlist derived from `kind` + class. Reject or blur-flag detections with `face_blurred !== true`. | M |
| F-06 | Privacy / audit | `components/providers/anomaly-provider.tsx:378-394`; `app/dashboard/page.tsx:205`; `app/dashboard/settings/page.tsx:298` | **The "PDPA audit trail" is not an audit trail.** It lives only in browser localStorage, records no actor, and **Reset demo data wipes it silently, with no confirmation and no entry logged**. The UI repeatedly says "recorded in the PDPA audit trail". | Verified: toggle shield off/on (3 entries) → Reset demo data → the audit is back to 1 seed entry, with no dialog. | For the demo: log a "Demo data reset" audit entry and require confirmation for reset. Post-hackathon: server-side append-only log with operator ID. Soften the UI copy until then. | S / L |

### Medium

| ID | Area | File:line | Description | How to reproduce | Suggested fix | Effort |
|---|---|---|---|---|---|---|
| F-07 | State sync | `anomaly-provider.tsx:318-319` (reopenAlert), `:321-354` (setTicketStatus), `:355-368` (reassignTicket), `:298-304` (dispatchAlert) | **Alerts and tickets drift out of sync.** (1) Re-opening a resolved ticket leaves its alert *resolved*. (2) Reassigning a ticket doesn't update `alert.dispatchedTo`. (3) Re-opening an alert resets it to "active / Awaiting action" while `dispatchedTo` is still set and the ticket stays as-is. (4) Dispatching from an alert doesn't update its ticket's contractor. | Verified: TCK-1020 reassigned PipeFix→FixIt left the alert at `pipefix`; ticket re-open gave `{ticket:"open", alert:"resolved"}`; alert re-open gave `{alert:"active", dispatchedTo:"pipefix"}`. | Centralise the transitions: one `transition(alertId/ticketId, event)` reducer that updates both sides. | M |
| F-08 | Predictive maintenance | `anomaly-provider.tsx:54-56` | **Wear is charged to the wrong asset via the fallback.** If no asset of the right type is linked to the alerting camera, the code falls back to the *first asset of that type anywhere*. E.g. `lamp_off` on CAM-04 (Bin Bay has no lamp asset) degrades AST-L01 *Central Park* lamp, and `pipe_leak` on CAM-01/03/05 degrades AST-P01. Seeded history uses strict matching (`seed.ts:213-215`), so live behaviour differs from seed. | Code. Simulate Lamp Off on Block C Bin Bay → Asset Health → AST-L01 loses 8%. | Remove the fallback (log "no linked asset") or add the missing assets in `seed.ts`. | S |
| F-09 | Dependencies | `package.json` (`next 13.5.1`) | **33 npm advisories (2 critical, 24 high, 7 moderate).** `next` itself has a critical SSRF in Server Actions, which is not exploitable here (no server in a static export) but should not ship. Most others are dev-tooling or come from unused deps (F-17). | `npm audit --omit=dev` | Bump to `next@13.5.11` (same minor; also likely fixes the SWC minifier issue, see F-23), remove unused deps, then `npm audit fix`. Retest the build. | S–M |
| F-10 | Simulation | `components/providers/anomaly-provider.tsx:171-195`, `lib/anomaly/simulator.ts:174-183` | **Duplicate open alerts for the same camera + class.** Only crowd density checks for an existing open alert. | Verified: after simulating all six classes, open alerts included `CAM-04/bin_overflow ×2` and `CAM-05/ramp_obstructed ×2`. Each duplicate also double-charges asset wear. | In `ingestAlert`, if an open alert with the same camera + class exists, append a history entry ("re-detected") instead of creating a new one. | S |
| F-11 | Simulation / demo | `anomaly-provider.tsx:206` | **Crowd count is biased upward, so recurring auto crowd alerts and toasts.** `Math.round((Math.random() - 0.45) * 2)` has a positive mean, so counts creep to the cap (14) and stay above the threshold (9), re-alerting after every resolve. | Verified: 4 automatic crowd alerts on 4 cameras within ~10 minutes of idle use, each with a toast. | Use a mean-reverting walk toward a per-zone baseline, e.g. `drift = round((baseline - count) * 0.2 + (random()-0.5)*2)`. | S |
| F-12 | State race | `anomaly-provider.tsx:204-209` | **Lost update in the 3-second tick.** The tick builds `cameras` from the `stateRef` snapshot and then `setState(s => ({...s, cameras}))`, replacing whatever cameras are in `s`. A camera toggle or slider change committed between the snapshot and the updater is overwritten. | Code; not reproduced (the window is milliseconds). | Compute the drift inside the functional updater: `setState(s => ({...s, cameras: s.cameras.map(drift)}))`. | S |
| F-13 | Deploy | `next.config.js` (`output: 'export'`, no `trailingSlash`) | **Deep links and page refreshes 404 on plain static hosts.** | Verified with `python -m http.server` on `out/`: `/` 200, `/dashboard/alerts` **404**, `/dashboard/alerts.html` 200, `/dashboard` → 301 into a directory. | Set `trailingSlash: true` (emits `dashboard/alerts/index.html`), or deploy to Vercel/Netlify, which handle `.html` rewrites. | S |
| F-14 | Camera controls | `anomaly-provider.tsx:154`, `:185-190`; `lib/anomaly/simulator.ts:144-145`; `inferenceIntervalSec` only read in `cameras/page.tsx:130,181` and `camera-viewer.tsx:121` | **Thresholds and inference interval do almost nothing in demo mode.** Confidence gating only applies to `source === 'edge'`. In simulation the threshold just raises the generated confidence floor. `inferenceIntervalSec` is stored and displayed but never used. | Code. Raise a camera's threshold to 0.95 and simulate: the alert still fires (at 0.95). | Apply the gate to simulated alerts too (and drop any below it with a "suppressed by threshold" toast), or label these controls "applied on the edge node". Use the interval to scale that camera's simulation rate. | S |
| F-15 | Privacy (retention) | `components/settings/retention-settings.tsx:64`, `app/dashboard/settings/page.tsx:33-39`; claim at `app/dashboard/alerts/page.tsx:327` | **The retention policy is a no-op.** The form only shows a toast and nothing expires. Alerts (with frames) are kept up to the 400 cap regardless. The UI claims frames are "retained only as long as the clip-retention policy allows". | Code / verified: saving retention only toasts. | Persist retention days in settings, purge alerts and wear older than N days on load and on each tick, or remove the claim. | M |
| F-16 | Backend seam | `anomaly-provider.tsx:235-247`; `app/dashboard/sandbox/page.tsx:66`; `README.md` "Connecting the FastAPI…" | **Polling and sandbox contract weaknesses.** `since` uses the browser clock (skew loses or duplicates detections), there is no in-flight guard (slow responses overlap), no `AbortController` on unmount, and detections for unknown cameras are silently dropped. The sandbox maps the *absolute* timestamp to clip time (`ts/1000 % duration`), so markers land randomly. The README payload has no frame offset. `NEXT_PUBLIC_*` is inlined at build time, so changing the API needs a rebuild, and FastAPI must enable CORS. | Code. | Use a server-issued cursor, add an `inFlight` flag + `AbortController`, add `frame_time_s` to the sandbox payload and README, and document the CORS/rebuild needs. | M |
| F-17 | Dependencies | `package.json` | **Unused dependencies, several with advisories:** `axios`, `hls.js`, `simple-peer`, `socket.io-client` (→ `ws`, `engine.io-client`, `socket.io-parser` advisories), `@next/swc-wasm-nodejs` (a StackBlitz/bolt template artefact), and `@radix-ui/react-progress` (no longer imported since `progress.tsx` was rewritten). | Import count = 0 for each (grep across `app components lib hooks`). | `npm uninstall` them. | S |
| F-18 | Persistence | `anomaly-provider.tsx:37-48` | **No schema validation on load.** Only `version` is checked. Partial or corrupt state with the right version (or a future field added without bumping `STATE_VERSION`) crashes consumers. Settings persist, so changes to `DEFAULT_SETTINGS` never reach a browser that has rehearsed before. | Code. `localStorage.setItem('anomalyguard-state','{"version":1}')` → reload → crash. | zod-parse the state, fall back to the seed on failure, and deep-merge settings with defaults. | S |
| F-19 | Demo UX | `app/dashboard/page.tsx:205`, `settings/page.tsx:298` | **Reset demo data has no confirmation.** It's one mis-click from wiping a curated demo state (and the audit log, F-06). | Verified. | Confirm dialog. | S |

### Low

| ID | Area | File:line | Description | Suggested fix | Effort |
|---|---|---|---|---|---|
| F-20 | Accessibility | `components/layout/header.tsx:68,100`, avatar button `header.tsx` dropdown trigger, `components/anomaly/simulate-menu.tsx:35` (size="icon"), feed buttons `cameras/live/page.tsx:62`, `dashboard/page.tsx:118` | Icon-only buttons have no `aria-label` (only `mode-toggle` has `sr-only`). The mobile menu, bell, avatar and per-camera simulate buttons are unnamed for screen readers. | Add `aria-label`s. | S |
| F-21 | Accessibility | `app/dashboard/page.tsx:134`, `components/layout/header.tsx:134` | Severity shown by **colour dot only** in the overview "Open anomalies" list and the bell popover (the Alerts page itself uses text badges). | Add the severity word or an icon. | S |
| F-22 | UI copy | `app/dashboard/cameras/page.tsx:123` | Camera badges show raw ids ("Warning: crowd_density") instead of labels (verified in a screenshot). | Use `DETECTION_CLASSES[x].label`. | S |
| F-23 | Build | `components/ui/progress.tsx` (rewritten), `next 13.5.1` | Progress was rewritten without Radix to dodge an SWC minifier bug. Every *imported* Radix package (dialog, alert-dialog, dropdown, popover, select, switch, slider, tabs, toggle-group, checkbox, toast, avatar, sheet) built and was exercised at runtime without issue. The 24 unused UI components were not compiled, so they are untested; importing one later could hit the same bug. | Upgrade Next (F-09), then keep or revert the rewrite. | S |
| F-24 | Dead code | `components/ui/*` (24 files never imported: accordion, alert, aspect-ratio, breadcrumb, calendar, carousel, chart, collapsible, command, context-menu, drawer, hover-card, input-otp, menubar, navigation-menu, pagination, radio-group, resizable, scroll-area, separator, sonner, table, textarea, tooltip); `config/general.config.json`; root `styles.css`; `components/auth/login-form.tsx:28-40` (reads the obsolete `generalSettings` key); `components/auth/auth-guard.tsx:7` (`/login` route doesn't exist) | Orphans from the template. They are harmless at runtime because they aren't bundled. | Delete them, or leave the shadcn primitives in place. | S |
| F-25 | Settings | `app/dashboard/settings/page.tsx:97,117`; 6× `toLocaleString('en-MY', …)` | The **timezone setting is never applied.** Times use the viewer's browser timezone. | Pass `timeZone: settings.timezone` to formatters. | S |
| F-26 | Sandbox | `app/dashboard/sandbox/page.tsx:52`, `:41` | The object URL is never revoked (memory leak on repeated uploads). The 4-second "active" window is longer than short clips, so all detections stack up (verified on a 2.2 s clip: 12 boxes at once). | `URL.revokeObjectURL` on replace/unmount; window = `min(4, duration/10)`. | S |
| F-27 | Data consistency | `anomaly-provider.tsx:186-190`; `lib/anomaly/simulator.ts:163` | The simulated confidence bump updates `alert.confidence` but not the first history entry or the box confidences, so the timeline can show a different confidence than the alert. It only occurs when the class threshold is above the generated value. | Bump before building history, or rebuild the entry. | S |
| F-28 | Data consistency | `lib/anomaly/simulator.ts:148` | Crowd alert message count = `boxes.length + camera.crowdCount`, which doesn't match the badge (incident boxes only). | Use one count. | S |
| F-29 | CSV | `lib/anomaly/csv.ts:5-8`; `app/dashboard/analytics/page.tsx:119` | No CSV formula-injection guard (the free-text "Township" setting flows into the summary). Every alert row asserts "faces anonymised at edge" even for simulated or sandbox rows. | Prefix `=+-@` cells with `'`; set the privacy column from `source`. | S |
| F-30 | Growth | `anomaly-provider.tsx:12,159`; wear and audit arrays | Alerts are capped at 400 (oldest dropped, which can orphan `ticket.alertId` and `wear.alertId` links). `wear` and `audit` grow without bound. The state is ~78 KB after this session, so not urgent. | Cap or prune together; keep the links consistent. | S |
| F-31 | ID race | `anomaly-provider.tsx:264` | Ticket ID is `TCK-${1000 + tickets.length}` from the ref snapshot, so two calls before a re-render would collide. Not reproducible by normal clicking; IDs were unique in testing. | Use `uid('TCK')` or a counter in state. | S |
| F-32 | Build config | `next.config.js` (`eslint.ignoreDuringBuilds: true`) | Lint is skipped during `next build` ("Skipping linting"). `next lint` passes cleanly today, but regressions won't block builds. `typescript.ignoreBuildErrors` is *not* set (good). | Remove the flag or add `next lint` to CI. | S |
| F-33 | Visual | `components/anomaly/zone-feed.tsx` overlay labels | With a crowd-density alert open, 6–9 anonymous labels overlap and become unreadable on small tiles (seen on the Main Gate tile). The deprecated `eslint@8.49` and Recharts `defaultProps` dev warnings are cosmetic. | Show labels only for the incident's lead box on small tiles. | S |

---

## 5. Privacy & PDPA review

| Claim (where) | Verified in code? | Notes |
|---|---|---|
| No facial recognition, enrolment, face templates, attendance (`settings/page.tsx:235`, README) | **Yes** | Original modules removed. No face-embedding, matching or enrolment code remains (grep clean). |
| Detection labels are anonymous (`taxonomy`, `simulator`, `displayLabel` `zone-feed.tsx:317-320`) | **Yes for simulated data; No for backend data** | Every overlay label goes through `displayLabel`, but backend labels are passed through verbatim (F-05). |
| Blur patches render when the shield is on | **Yes (scenes)** | Every pedestrian head in `ZoneScene` gets the mosaic + blur filter (`zone-feed.tsx:142-157`); seen in screenshots. |
| Blur on uploaded footage (sandbox) | **No** | F-02: patches are at fabricated positions; real faces are visible. |
| "Faces are blurred on the edge node before frames are stored or transmitted" (`settings/page.tsx:238`, `camera-viewer.tsx:55`, README) | **Contradicted** | F-03: turning the shield off reveals faces in *stored* snapshots. |
| Turning the shield off is confirmed | **Partly** | Header: yes. Settings: no (F-04). |
| Turning the shield off is audited | **Yes, but weakly** | Logged on both paths, but localStorage-only, no actor, wiped by reset (F-06). |
| CSV exports contain no personal data | **Yes** | Captured all three exports at runtime. Columns are IDs, classes, cameras, zones, contractors (businesses) and timestamps. The privacy column over-claims for simulated rows (F-29). |
| `track_id` never persisted | **Yes** | Declared in `EdgeDetection` (`api.ts:28`) but never copied by `detectionToAlert`; absent from `Alert`. |
| Sandbox doesn't leak uploaded video | **Yes** | `analyseClip` returns early without a backend (`api.ts:58`). Runtime instrumentation recorded **zero** network requests during upload + analysis; the video is a local `blob:` URL. |
| Plates masked | **Yes (illustrative)** | Masked rectangle drawn on SVG cars; label "Plate Masked". |
| Retention policy limits how long frames are kept (`alerts/page.tsx:327`) | **No** | F-15. |
| Crowd density is a head-count only, no cross-frame tracking | **Yes** | Ambient boxes are regenerated per tick from a seeded walk; no IDs persist. |
| Operator identity | n/a | The session stores the *operator* name ("Township Ops") in localStorage. That's operator data, not resident data, which is fine. |

**Gaps to close before pitching privacy:** F-02, F-03, F-04, F-06 (all small copy or logic changes). The real PDPA story (edge-side irreversible blurring, server audit, retention purge) is post-hackathon work, and the README should say "designed for" rather than "does" until then.

---

## 6. Code quality

- **Type safety:** `strict: true`. There are no `any`s in app code. Non-null assertions: `components/anomaly/camera-viewer.tsx:27` (camera lookup, which is safe because cameras are never deleted), `lib/anomaly/seed.ts:233-234` (static seed, safe), and `app/dashboard/sandbox/page.tsx:167-170` (guarded by `.filter(b => b.faceRegion)`, safe). `JSON.parse(...) as AnomalyState` (`anomaly-provider.tsx:41`) is an unchecked cast (F-18), and API JSON is unchecked (F-05).
- **Duplication:** the alert/ticket transition logic is spread across five actions (F-07). Small `Kpi`/`Tile`/`Stat` card components are re-declared in four pages (overview, assets, analytics, live) and could be shared. The confirm-dialog logic for the shield exists only in the header component (F-04).
- **Dead code:** see F-24 and F-17.
- **Effects:** two effects suppress `react-hooks/exhaustive-deps` (`anomaly-provider.tsx:221,249`) on `state === null`. This is intentional (run once state loads) and correct, because both read the latest state via `stateRef`. Every interval is cleared on unmount (`:220,:229,:248`). No stale closure was found beyond F-12.
- **SSR/hydration:** the provider renders a loading screen until the `useEffect` load (`:128-130`), so there is no hydration mismatch. Runtime console showed no hydration warnings.
- **Removed files** (moved, not deleted, during the refactor) are in `C:\Users\User\AppData\Local\Temp\claude\C--one-drive-personal-OneDrive-Documents-A-AI-main-A-AI-main\515ad432-eb85-4a97-a02a-f681fe3f4538\scratchpad\removed\`:
  - `app/dashboard/ai-assistant/`, `app/dashboard/notifications/`
  - `components/ai-assistant/ai-assistant.tsx`, `components/notifications/notification-item.tsx`, `components/streaming/video-player.tsx`
  - `components/settings/user-tab/` (enrolment), `components/settings/rules-tab/` (attendance / "Authorized Entry"), `components/settings/camera-tab/`, `components/settings/advanced-settings.tsx` (face recognition toggle), `components/settings/general-settings.tsx`
  - `lib/services/{userService,rulesService,cameraService,aiAssistantService}.ts`, `lib/data/{cameras,health}.ts`, `lib/hooks/use-notifications.ts`, `hooks/use-general-settings.ts`
  - Full pre-refactor copy: `...\scratchpad\original-backup\`
  - ⚠ Both are in a **temp** directory and may be cleaned by the OS. Copy them out if you want to keep them.
- **No version control:** the project folder is not a git repository, so nothing above is tracked.

---

## 7. Dependency review

`npm audit --omit=dev`: **33 vulnerabilities, 2 critical, 24 high, 7 moderate.**

| Package | Severity | Direct? | Relevance |
|---|---|---|---|
| `next@13.5.1` | critical (Server Actions SSRF) + others | yes | Not exploitable in a static export, but upgrade to 13.5.11 |
| `form-data` | critical | via axios | axios is unused, so remove it |
| `axios` | high | yes | Unused, remove |
| `socket.io-parser`, `ws`, `engine.io-client` | high/mod | via socket.io-client | Unused, remove |
| `postcss`, `tailwindcss`, `glob`, `braces`, `micromatch`, `cross-spawn`, `nanoid`, `browserslist`, … | high | build-time | Dev-tool exposure only; `npm audit fix` |
| `zod` (nested under next) | moderate | transitive | Fixed by the Next upgrade |

**Unused:** `axios`, `hls.js`, `simple-peer`, `socket.io-client`, `@next/swc-wasm-nodejs`, `@radix-ui/react-progress`, plus the Radix packages behind the 24 unused UI components (accordion, aspect-ratio, collapsible, context-menu, hover-card, menubar, navigation-menu, radio-group, scroll-area, separator, tooltip), and `cmdk`, `vaul`, `input-otp`, `embla-carousel-react`, `react-day-picker`, `react-resizable-panels`, `sonner`.
**Outdated / deprecated:** `eslint@8.49` (EOL warning on install), `next@13.5.1` (13.5.x patch line; 14/15 available).
**Environment:** no `engines` field. Verified working on **Node 26.8.1 / npm 11.19.0**. Next 13.5 officially needs Node ≥ 16.14. There is no `.env` file. `.gitignore` already excludes `.env*.local`, `/out`, `/.next`.

**Clean install:** `npm ci` (550 packages, 1m17s) + `next build` (36 s) succeeded in an isolated copy, with identical route sizes.

---

## 8. Demo readiness

**What could go wrong live:**

| Risk | Likelihood | Mitigation |
|---|---|---|
| Stale localStorage from rehearsal: shield left **off**, odd thresholds, dozens of crowd alerts, auto-simulate on | High | Click **Reset demo data** right before presenting (note: this also resets the audit, F-06). |
| A judge uploads real footage in the Sandbox and sees un-blurred faces under "Faces anonymised" | Medium | Fix F-02 first, or don't let judges upload. Use a pre-chosen clip without people. |
| Toast storm from automatic crowd alerts (F-11) while you're talking | High after ~5 min | Raise the crowd threshold to 14 in Settings → Detection, or fix F-11. |
| Duplicate alerts from repeated simulation (F-10) look buggy | Medium | Simulate each class once, or fix F-10. |
| Judge asks "if blur happens on the edge, how can you turn it off?" (F-03) | Medium | Fix F-03 or prepare the answer. |
| Dead venue network | Low | Verified: no external runtime URLs. Fonts are self-hosted (`out/_next/static/media/*.woff2`); no images are fetched. Works offline. |
| Blocked autoplay | None | No autoplay media. Feeds are SVG; the sandbox video uses user-initiated controls. |
| 20× crew speed (`tickets/page.tsx:19`) | Low | Crews arrive in ~1.5–2 min real time. Good for a demo, but say "time-compressed". "Re-open → Start work" restarts the ETA. |
| Deploying `out/` to a static host and refreshing a sub-page → 404 (F-13) | Medium if hosted | Present from `npm run dev`/`next start`-equivalent or Vercel, or set `trailingSlash: true`. |
| Login fumble | Low | Credentials are shown on the login card ("Demo login: admin / admin"). |
| First load blank for ~1 s ("Loading AnomalyGuard…") in dev while pages compile | Medium in dev | Pre-visit every page once before the pitch, or use the production build. |

**Pre-demo checklist**

- [ ] `npm run build` passes; serve with Vercel/Netlify, or run `npm run dev` and pre-warm every route.
- [ ] Log in, then **Reset demo data**.
- [ ] Header badge reads "PDPA Privacy Shield Active".
- [ ] Settings → Detection: crowd warning threshold ≥ 12 (until F-11 is fixed).
- [ ] Auto-simulate **off** (turn it on deliberately at the end).
- [ ] Sandbox: a clip with no identifiable people is ready.
- [ ] Dark mode chosen, browser zoom 100%, window ≥ 1280 px wide.
- [ ] Close DevTools (the Recharts warnings are harmless but noisy).

---

## 9. Recommended fix plan

**Fix before the hackathon (≈ half a day total, all S unless noted)**
1. F-02 Sandbox privacy copy and badge, plus blur-whole-video in mock mode
2. F-03 Make the shield toggle consistent with "blurred at the edge" (snapshots always blurred)
3. F-04 Confirmation on the Settings shield switch
4. F-06 + F-19 Reset confirmation, and log reset into the audit
5. F-11 Mean-reverting crowd drift
6. F-10 De-duplicate open alerts per camera + class
7. F-07 Alert ↔ ticket sync (M)
8. F-08 Remove the wrong-asset fallback
9. F-01 (demo scope) Add a "demo login, not for public deployment" note in the README; don't publish the build publicly
10. F-22, F-21 Small copy/label polish

**Nice to have**
- F-14 thresholds/interval honoured in simulation; F-15 retention purge; F-18 state validation; F-12 tick race; F-13 `trailingSlash`; F-17 + F-09 remove unused deps and upgrade Next 13.5.11; F-20 aria labels; F-25 timezone; F-26 sandbox fixes; F-27/F-28/F-29 data consistency; F-33 label clutter.

**Post-hackathon**
- F-01 real authentication and server-side authorisation
- F-05 + F-16 hardened FastAPI contract (zod validation, cursors, CORS, abort), real edge-side face blurring
- F-06 server-side append-only audit log with operator identity
- F-24 template clean-up; `git init` and CI with lint + typecheck + build; F-32
- Upgrade path to Next 14/15 (removes the 13.5 SWC workaround)

---

## 10. What could not be verified

| Item | Why |
|---|---|
| **Mobile width / sidebar Sheet** | The browser window resize request had no effect (viewport stayed 1920 px), so the mobile layout was reviewed from code only. The Sheet nav is wired (`header.tsx:66-80`). The 380 px bell popover may overflow 360 px phones (`header.tsx:112`). |
| **Keyboard-only navigation / screen readers** | Partially exercised. Radix menus and selects were operated via keyboard events, and feeds are real `<button>`s. No full tab-order or screen reader pass was done. |
| **Real FastAPI + YOLOv8 backend** | None exists. F-05 and F-16 are from code reading only. |
| **Sandbox with real footage of people** | A synthetic webm (no people) was generated in-browser and used. The conclusion (F-02) doesn't depend on content, since mock inference ignores the video. |
| **Lost-update race (F-12) and ID race (F-31)** | Timing windows are milliseconds; identified by reading only. |
| **Browsers other than Chrome; light-mode visual polish** | Only Chrome was tested. Light mode was seen in several screenshots and looked correct; dark mode was checked earlier. |
| **Actual file downloads of CSVs** | Downloads were intercepted in-page to avoid writing files. Content was verified, but the saved file wasn't opened in Excel. The UTF-8 BOM is present in code (`csv.ts:17`). |
| **Production static export behind a real CDN host** | Only tested with `python -m http.server` (F-13). |
| **Node versions other than 26.8.1** | Only one Node version is installed. |
