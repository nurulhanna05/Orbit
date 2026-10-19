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
| Camera viewer modal (transient live view for authorised operators) | click any feed |
| **Anonymised evidence snapshots**: one face-blurred frame per new alert, with retention and an audit trail of views and exports | `Alerts → Snapshot`, header status |
| **Privacy & Compliance** page: what is stored, retention, who can view, signage, roadmap | `Settings → Privacy & Compliance`, `Settings → Retention` |
| Alerts with Critical / Warning / Info severity, dispatch, resolved history with re-open | `Alerts` |
| Maintenance tickets linked to detections, routed to contractors, reassignable, live crew status | `Maintenance Tickets` |
| Predictive maintenance: asset health ticker and wear log showing lifespan impact | `Asset Health` |
| Analytics by class and camera, average confidence, CSV export for municipal audit | `Analytics & Reports` |
| Camera online/offline toggles, warning/critical filters, confidence thresholds and inference intervals | `Cameras` |
| Edge node, IoT sensor and service uptime | `Edge & IoT Health` |
| Upload pre-recorded footage and test a real YOLOv8 model (with the optional backend) | `Model Sandbox` |
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

With the backend connected, `person_fallen` and `crowd_density` come from a real YOLOv8 model in the Model Sandbox. The other four classes are always simulated. The live camera grid is simulated in both modes.

Labels are always anonymous, for example `Pedestrian · 0.94` or `Vehicle on Ramp (Plate Masked) · 0.88`. Snapshot labels read `Pedestrian (Face Blurred)`.

### Contractors

CleanCo (bins), PipeFix (plumbing), FixIt Works (civil and accessibility), Electra Lighting (lighting), and the in-house Township Response Team (falls and crowding).

## Privacy by design

AnomalyGuard is built privacy-by-design and aligned with PDPA principles. It is not certified as compliant with anything, and the *Privacy & Compliance* page says so: it describes design choices, not legal advice.

- No facial recognition, enrolment photos, face templates, attendance or person re-identification. These modules were **removed** from the original codebase.
- **Live view is transient and for authorised operators only.** It is shown as is and is not recorded.
- **Evidence snapshots are always anonymised.** When a *new* alert opens (not on repeat detections), the edge node takes that single frame, blurs faces in memory and returns it as a JPEG in an optional `snapshot` field. Asset alerts (lamp, pipe, bin) are cropped to the asset area. Unblurred frames are never written to disk. Anonymisation **fails closed**: on any error, or if the face detector is missing, only metadata is returned.
- Faces are found by OpenCV YuNet (used only to locate regions to blur; nothing is recognised, stored or returned), unioned with the top 25% of every YOLOv8 person box. A person neither model detects is not blurred, so this is a strong best effort, not a guarantee that no face is ever present.
- The dashboard shows an alert immediately and attaches its snapshot when it arrives (*processing* until then). Snapshots are stored in the browser's IndexedDB, never in `localStorage` state.
- **Retention:** snapshots are deleted automatically after 30 days, or 7 days after the alert is resolved, whichever is sooner (configurable under `Settings → Retention`). Deletions are logged.
- **Audit trail:** snapshot views and exports, retention changes, deletions and demo resets are logged with the operator's name. *Reset demo data* asks for confirmation and keeps the trail.
- **Model Sandbox:** the uploaded clip plays as is, with boxes and labels overlaid. In demo mode it never leaves the browser. In backend mode the local edge service analyses it from a temp file it deletes straight afterwards, and returns only anonymised snapshots, shown at each detection marker.
- Crowd density is a head-count only; individuals are never tracked across frames or cameras.
- CSV exports contain detection metadata only.
- In this demo the audit trail lives in the browser (`localStorage`). A production deployment would write it to an append-only server log.

## Running it

```bash
npm install
npm run dev
# open http://localhost:3000 and log in with admin / admin (stored as a salted SHA-256 hash in config/auth.config.json)
```

`npm run build` produces a static export (`output: 'export'`).

The dashboard runs fully on its own. To try the real model in the Model Sandbox, start the optional backend (setup in [backend/README.md](backend/README.md)) and add this line to `.env.local`, then restart `npm run dev`:

```
NEXT_PUBLIC_ANOMALYGUARD_API=http://localhost:8000
```

### Demo script (about 3 minutes)

1. **Overview**: point at the privacy status ("Evidence snapshots are always anonymised.") and the asset health ticker.
2. **Simulate incident → Person Fallen**: a critical toast fires and the feed shows a fallen posture.
3. Click the feed: the live view is transient and not recorded. Open the alert's frame: the stored evidence is anonymised. With the backend running, push a Sandbox detection to show the *processing* state, the face-blurred snapshot, and the view and export entries in `Settings → Privacy & Compliance`.
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
components/anomaly/       Zone feed renderer, camera viewer, privacy status, alert snapshot, simulate menu, ticker
components/providers/
  anomaly-provider.tsx    Single client store: cameras, alerts, tickets, assets, wear log, settings
lib/anomaly/
  taxonomy.ts             Detection classes, severities, zones, colours
  simulator.ts            Incident generator and anonymous bounding boxes
  scenes.ts               Per-zone layout shared by the renderer and simulator
  seed.ts                 Cameras, contractors, assets and a week of seeded history
  api.ts                  FastAPI + YOLOv8 integration seam
  snapshot-store.ts       IndexedDB store for anonymised snapshots, retention expiry
  infrastructure.ts       Edge node / IoT sensor telemetry mocks
  csv.ts                  Audit exports
backend/                  Optional FastAPI + YOLOv8 edge service (see backend/README.md)
  main.py                 Sandbox analysis with anonymised evidence snapshots, detections endpoint
  test_snapshots.py       Checks snapshots against real clips for visible faces, fail-closed and asset crops
  requirements.txt        Python dependencies (venv, weights and samples are git-ignored)
```

### Connecting the FastAPI + YOLOv8 backend

A working implementation lives in [`backend/`](backend/README.md). Set `NEXT_PUBLIC_ANOMALYGUARD_API=http://localhost:8000` and the dashboard will:

- poll `GET /api/v1/detections?since=<iso>` every 5s and ingest each result as an alert, gated by the camera and class confidence thresholds (the included backend returns `[]` here)
- send sandbox clips to `POST /api/v1/sandbox/analyse` (multipart: `file`, `classes`, `conf`); each newly opened detection carries an anonymised snapshot

The backend runs on CPU. Anonymising one snapshot took about 0.2–0.7 s in testing (mean 0.5 s across four clips), on top of about one sampled frame of analysis per second of video.

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
  ],
  "snapshot": {
    "jpeg_b64": "/9j/4AAQ…",
    "width": 768, "height": 432,
    "crop": [0.0, 0.5, 0.45, 1.0],
    "regions_blurred": 3,
    "timings_ms": { "people": 60, "faces": 410, "blur": 0.5, "encode": 3, "total": 474 }
  }
}
```

`xyxy`, `face_xy_r` and `crop` are normalised 0..1. `snapshot` is optional: it is present only on a newly opened detection whose frame was anonymised successfully. `track_id`, if sent, must be an ephemeral per-session integer, never a person identifier.

## Tech stack

Next.js 13 (App Router), TypeScript, Tailwind CSS, shadcn/ui (Radix), Recharts, date-fns, Framer Motion.

Optional backend: Python, FastAPI, Ultralytics YOLOv8 (`yolov8n`), OpenCV (YuNet face detector, used only to find regions to blur).

## Credits

AnomalyGuard was repurposed from [rudra-sah00/A-AI](https://github.com/rudra-sah00/A-AI) (MIT License). The original copyright notice is kept in [LICENSE](LICENSE).
