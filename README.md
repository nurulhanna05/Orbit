# AnomalyGuard

**A privacy-first smart township and infrastructure platform.** Built for the Sime Darby hackathon (Track: People). Demo township: *SDP Township · City of Elmina*.

> We looked at existing open-source security platforms and found they violate privacy and cause PDPA friction. We repurposed the infrastructure into a privacy-first asset telemetry tool.

AnomalyGuard gives township operators situational awareness and predictive maintenance for community spaces: jogging tracks, playgrounds, bin bays, main gates, car parks and corridors. It detects **object states, environmental hazards and anonymous behaviour, never identities**.

## The problem

- AI "surveillance" is oversaturated, clashes with Malaysia's **PDPA 2010**, and makes residents feel watched.
- Townships manage infrastructure reactively: a leaking pipe or dead street lamp is fixed only after someone complains.

## What it does

| Capability | Where |
|---|---|
| Multi-feed live view of township zones with anonymous bounding boxes | `Live Zones` |
| Camera viewer modal with face blur-patch simulation | click any feed |
| **PDPA Privacy Shield**: global badge/toggle, audited when disabled | header, `Settings → Privacy & PDPA` |
| Alerts with Critical / Warning / Info severity, dispatch, resolved history with re-open | `Alerts` |
| Maintenance tickets linked to detections, routed to contractors, reassignable, live crew status | `Maintenance Tickets` |
| Predictive maintenance: asset health ticker and wear log showing lifespan impact | `Asset Health` |
| Analytics by class and camera, average confidence, CSV export for municipal audit | `Analytics & Reports` |
| Camera online/offline toggles, warning/critical filters, confidence thresholds and inference intervals | `Cameras` |
| Edge node, IoT sensor and service uptime | `Edge & IoT Health` |
| Upload pre-recorded footage and test the model | `Model Sandbox` |
| Simulated incidents so the demo runs end to end with no backend | `Simulate incident` (header) |

### Detection classes

| Class | Default severity | Asset impact |
|---|---|---|
| `person_fallen` (posture-based) | Critical | – |
| `ramp_obstructed` (vehicle on OKU ramp) | Warning | OKU ramp |
| `pipe_leak` | Critical | Water pipe −12% health, −9 months |
| `bin_overflow` | Warning | Refuse bin −3%, −1 month |
| `lamp_off` | Warning | Street lamp −8%, −6 months |
| `crowd_density` (anonymous head-count) | Info / Warning | – |

Labels are always anonymous, for example `Pedestrian (Face Blurred) · 0.94` or `Vehicle on Ramp (Plate Masked) · 0.88`.

### Contractors

CleanCo (bins), PipeFix (plumbing), FixIt Works (civil and accessibility), Electra Lighting (lighting), and the in-house Township Response Team (falls and crowding).

## Privacy by design

- No facial recognition, enrolment photos, face templates, attendance or person re-identification. These modules were **removed** from the original codebase.
- Faces are blurred and plates masked **on the edge node** before any frame is stored. Stored alert snapshots are always anonymised and cannot be un-blurred.
- The Privacy Shield controls the *live* view only. Turning it off (for example, to verify a fall) requires confirmation and a reason, is never recorded, and is written to the audit trail with the operator's name.
- Crowd density is a head-count only; individuals are never tracked across frames or cameras.
- *Reset demo data* asks for confirmation and keeps the audit trail; the reset itself is logged.
- The Model Sandbox has no model attached in demo mode: detections are simulated, uploaded footage is blurred as a whole frame and never leaves the browser.
- CSV exports contain detection metadata only.
- In this demo the audit trail lives in the browser (`localStorage`). A production deployment would write it to an append-only server log.

## Running it

```bash
npm install
npm run dev
# open http://localhost:3000 and log in with admin / admin (stored as a salted SHA-256 hash in config/auth.config.json)
```

`npm run build` produces a static export (`output: 'export'`).

### Demo script (about 3 minutes)

1. **Overview**: point at the Privacy Shield banner and the asset health ticker.
2. **Simulate incident → Person Fallen**: a critical toast fires and the feed shows a fallen posture with the face blurred.
3. Click the feed: the viewer shows blur patches on every face. Toggle the shield in the header to show the confirm dialog (with a logged reason) and the audit entry. Open an alert's frame: it stays blurred, because stored frames were anonymised at the edge.
4. **Simulate → Pipe Leak**, then open **Alerts**: dispatch PipeFix and choose *Raise ticket*.
5. **Maintenance Tickets**: *Start work*, watch the crew go *En route → On site*, try reassigning, then *Mark resolved*. The linked alert closes and the asset gets a partial repair.
6. **Asset Health**: show the lifespan hit and repair in the wear log.
7. **Analytics**: export the audit summary CSV.
8. Turn on *Auto-generate incidents* on the Overview to keep the dashboard alive while you talk.

All state lives in `localStorage` (`anomalyguard-state`). Use *Reset demo data* to start over; the audit trail is kept.

## Security model

This is a **static export with no server**, so the login is demo-grade: it keeps casual visitors out but cannot stop someone who edits browser storage. Do not put real camera feeds behind it.

- Passwords are stored only as salted SHA-256 hashes (`sha256("anomalyguard:" + password)`), never in plain text.
- Sessions expire after 12 hours and are checked against the configured account on load.
- For any public deployment, replace the demo account at build time. This also hides the `admin / admin` hint:

```bash
NEXT_PUBLIC_ANOMALYGUARD_LOGIN_USER=ops NEXT_PUBLIC_ANOMALYGUARD_LOGIN_SHA256=$(node -e "console.log(require('crypto').createHash('sha256').update('anomalyguard:' + process.argv[1]).digest('hex'))" 'a-long-passphrase') npm run build
```

Production needs real authentication on the FastAPI service (session cookie or OIDC), with the dashboard served behind it.

## Architecture

```
app/dashboard/            Next.js App Router pages (all client-rendered, statically exported)
components/anomaly/       Zone feed renderer, camera viewer, privacy shield, simulate menu, ticker
components/providers/
  anomaly-provider.tsx    Single client store: cameras, alerts, tickets, assets, wear log, settings
lib/anomaly/
  taxonomy.ts             Detection classes, severities, zones, colours
  simulator.ts            Incident generator and anonymous bounding boxes
  scenes.ts               Per-zone layout shared by the renderer and simulator
  seed.ts                 Cameras, contractors, assets and a week of seeded history
  api.ts                  FastAPI + YOLOv8 integration seam
  infrastructure.ts       Edge node / IoT sensor telemetry mocks
  csv.ts                  Audit exports
```

### Connecting the FastAPI + YOLOv8 backend

Set `NEXT_PUBLIC_ANOMALYGUARD_API=http://localhost:8000` and the dashboard will:

- poll `GET /api/v1/detections?since=<iso>` every 5s and ingest each result as an alert (gated by the camera and class confidence thresholds)
- send sandbox clips to `POST /api/v1/sandbox/analyse` (multipart: `file`, `classes`, `conf`)

Expected detection payload (see `EdgeDetection` in `lib/anomaly/api.ts`):

```json
{
  "camera_id": "CAM-02",
  "class_name": "pipe_leak",
  "confidence": 0.91,
  "timestamp": "2026-10-18T14:03:22Z",
  "face_blurred": true,
  "boxes": [
    { "xyxy": [0.08, 0.72, 0.30, 0.88], "label": "Water Pooling / Leak", "kind": "hazard", "confidence": 0.91 }
  ]
}
```

`xyxy` and `face_xy_r` are normalised 0..1. `track_id`, if sent, must be an ephemeral per-session integer, never a person identifier.

## Tech stack

Next.js 13 (App Router), TypeScript, Tailwind CSS, shadcn/ui (Radix), Recharts, date-fns, Framer Motion.

## Credits

AnomalyGuard was repurposed from [rudra-sah00/A-AI](https://github.com/rudra-sah00/A-AI) (MIT License). The original copyright notice is kept in [LICENSE](LICENSE).
