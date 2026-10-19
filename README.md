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

The dashboard runs fully on its own. To try the real YOLOv8 model in the Model Sandbox, see [Running with the YOLOv8 backend](#running-with-the-yolov8-backend).

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

## Running with the YOLOv8 backend

The optional backend in [`backend/`](backend/README.md) runs a real Ultralytics YOLOv8 model on clips uploaded to the Model Sandbox. One-time setup (venv, dependencies, the YuNet face model) is in [backend/README.md](backend/README.md).

1. Add this line to `.env.local` (once):

   ```
   NEXT_PUBLIC_ANOMALYGUARD_API=http://localhost:8000
   ```

2. Start both servers, each in its own terminal, and keep both running:

   ```
   cd backend
   .venv\Scripts\uvicorn main:app --port 8000
   ```
   ```
   npm run dev
   ```

3. Open `http://localhost:3000/dashboard/sandbox`, choose a clip, tick *Person Fallen* and/or *Crowd Density*, and click *Run analysis*.

The backend only accepts requests from `http://localhost:3000` and `http://localhost:3123` (CORS), so open the dashboard on one of those, not `127.0.0.1`.

### What runs where

The backend runs two pre-trained models, **YOLOv8n** and **YuNet**, on clips uploaded to the Sandbox. Only `person_fallen` and `crowd_density` come from them. The live camera grid and the other four classes are simulated. Models, thresholds, measured speed and limits are documented in [Models, training data and test clips](#models-training-data-and-test-clips).

### Testing with few people

With fewer than 8 people in frame, a clip gives *No anomalies above the threshold*. That is expected, not an error. To see detections and snapshots on any clip with a person in it, lower the crowd threshold before starting the backend:

```
set AG_CROWD_THRESHOLD=1
.venv\Scripts\uvicorn main:app --port 8000
```

To check snapshots for visible faces and measure blur time per snapshot, see [How to reproduce our tests](#how-to-reproduce-our-tests).

### Troubleshooting

| Message in the Sandbox | Cause and fix |
|---|---|
| *The detection service at http://localhost:8000 did not respond. Is the backend running?* | The backend is not running, or crashed. Start it (step 2) and try again. |
| *Could not decode the video* | OpenCV could not read the file. Convert it to H.264 `.mp4` and try again. |
| *Clip larger than 200 MB* | Trim or compress the clip. |
| *Simulated detections · clip not analysed* | `NEXT_PUBLIC_ANOMALYGUARD_API` is not set. Add it to `.env.local` and restart `npm run dev`. |
| A detection with *no snapshot (metadata only)* | Anonymisation failed or `models/face_detection_yunet_2023mar.onnx` is missing. By design, no image is kept. |

### API contract

Set `NEXT_PUBLIC_ANOMALYGUARD_API=http://localhost:8000` and the dashboard will:

- poll `GET /api/v1/detections?since=<iso>` every 5s and ingest each result as an alert, gated by the camera and class confidence thresholds (the included backend returns `[]` here)
- send sandbox clips to `POST /api/v1/sandbox/analyse` (multipart: `file`, `classes`, `conf`); each newly opened detection carries an anonymised snapshot

The backend runs on CPU. In our tests, anonymising one snapshot took 0.47 s on average (at most 0.71 s), on top of about one sampled frame of analysis per second of video. See [Measured performance](#measured-performance).

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

## Models, training data and test clips

AnomalyGuard trains nothing. It runs two pre-trained models exactly as published, and no custom dataset was collected or labelled. Both run locally inside the backend (`backend/main.py`), on CPU. The dashboard itself runs no model.

### YOLOv8n: person detector

| | |
|---|---|
| **File** | `backend/yolov8n.pt`, 6,549,796 bytes (about 6.5 MB). Git-ignored. |
| **Version** | YOLOv8 *nano*, object detection, 80 COCO classes. Tested with the `ultralytics` Python package 8.4.182 (`requirements.txt` allows `>=8.3,<9`). |
| **Download** | Fetched automatically by `ultralytics` on first start, from the [Ultralytics assets release](https://github.com/ultralytics/assets/releases/download/v8.4.0/yolov8n.pt). Docs: [docs.ultralytics.com/models/yolov8](https://docs.ultralytics.com/models/yolov8/). |
| **Used for** | Finding people, and nothing else (COCO class `person`, id 0). The person boxes feed the two rules below and the head-band blur in snapshots. |
| **Called from** | `detect_people()` in `backend/main.py`. It is called by `analyse()` once per sampled frame, and again by `evidence_snapshot()` when a snapshot is made. |
| **Input** | One BGR video frame (a NumPy array) of any size. Ultralytics resizes it internally; the code sets no `imgsz`, so the library default applies. |
| **Output** | Person boxes in pixels `(x1, y1, x2, y2)` with a confidence each. All other classes are filtered out by `classes=[PERSON]`. |
| **Trained on** | [COCO 2017](https://cocodataset.org), 80 everyday object classes. COCO has its own [terms of use](https://cocodataset.org/#termsofuse). |
| **Licence** | **AGPL-3.0** ([Ultralytics licensing](https://www.ultralytics.com/license), [licence text](https://github.com/ultralytics/ultralytics/blob/main/LICENSE)). See [Licences](#licences-what-they-mean-if-this-is-ever-sold-or-closed-source). |

### YuNet: face locator for blurring

| | |
|---|---|
| **File** | `backend/models/face_detection_yunet_2023mar.onnx`, 232,589 bytes (about 230 KB). Git-ignored. |
| **Version** | YuNet, March 2023 release, ONNX format. Run through OpenCV's `cv2.FaceDetectorYN` ([docs](https://docs.opencv.org/4.x/df/d20/classcv_1_1FaceDetectorYN.html)). Tested with OpenCV 5.0.0 (`requirements.txt` allows `opencv-python>=4.9`). |
| **Download** | Manually, once: [face_detection_yunet_2023mar.onnx](https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx) from [OpenCV Zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet). The command is in [backend/README.md](backend/README.md). |
| **Used for** | Only finding *where* faces are, so those areas can be blurred in evidence snapshots. It plays no part in analysis or alerts. If the file is missing, no snapshots are made at all (metadata only). |
| **Called from** | `detect_faces()` in `backend/main.py`, called only by `evidence_snapshot()`. The test script `backend/test_snapshots.py` also runs a second, more sensitive YuNet as a checker. |
| **Input** | The snapshot frame, scaled so its longest side is about 1280 px (small clips are upscaled at most 3×), with a mirrored border so heads cut off at the frame edge are still found. |
| **Output** | Per face: a box, 5 landmarks and a score. The code keeps **only the box**, padded by 35% on each side. Landmarks and scores are discarded immediately. |
| **Trained on** | [WIDER FACE](http://shuoyang1213.me/WIDERFACE/), a public face detection benchmark. |
| **Licence** | **MIT** ([licence file](https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/LICENSE)). |

### Thresholds and constants

All values are in the *Tunables* block at the top of `backend/main.py` unless noted. After changing one, restart the backend.

| Name | Default | What it does | Where to change it |
|---|---|---|---|
| `conf` | 0.6 from the Sandbox (0.5 if not sent) | Minimum YOLOv8 person confidence during analysis. Clamped to 0.05–0.95. | Sandbox *Confidence threshold* slider (0.3–0.95) |
| `CROWD_THRESHOLD` | 8 | People in one sampled frame that raise `crowd_density` | Environment variable `AG_CROWD_THRESHOLD`, or `main.py` |
| `FALL_ASPECT_RATIO` | 1.3 | A person box wider than 1.3 × its height counts as "lying down" | `main.py` |
| `FALL_MIN_FRAMES` | 2 | Sampled frames in a row with a wide box before `person_fallen` fires | `main.py` |
| `SAMPLE_EVERY_S` | 1.0 | Analyse about one frame per second of video | `main.py` |
| `BLUR_PERSON_CONF` | 0.15 | YOLOv8 person confidence used when blurring a snapshot. Deliberately low: over-blurring beats missing a face. | `main.py` |
| `HEAD_FRACTION` | 0.25 | The top 25% of every person box is blurred | `main.py` |
| `FACE_SCORE` | 0.35 | YuNet score above which a face is blurred (lower = blur more) | `main.py` |
| `FACE_PAD` | 0.35 | Each YuNet box grows by 35% on every side before blurring | `main.py` |
| `FACE_MAX_SIDE` / `FACE_MAX_UPSCALE` | 1280 px / 3× | Size YuNet works at, so small faces are still found | `main.py` |
| `FACE_EDGE_PAD` | 0.15 | Mirrored border added around the frame for YuNet | `main.py` |
| YuNet NMS / top-k | 0.3 / 5000 | Overlap threshold and maximum number of faces, passed to `cv2.FaceDetectorYN.create` | `main.py` |
| `PIXEL_BLOCKS` | 6 | A blurred region keeps at most 6 blocks across its short side | `main.py` |
| `SNAPSHOT_MAX_SIDE` / `SNAPSHOT_JPEG_QUALITY` | 960 px / 80 | Snapshot size and JPEG quality, applied after blurring | `main.py` |
| `ASSET_CROP_PAD` / `ASSET_CROP_MIN` | 0.6 / 0.3 | Crop around the asset for lamp, pipe and bin snapshots | `main.py` |
| `SENSITIVE` / `COVERED` | 0.25 / 0.6 | Test only: the checker's YuNet score, and the share of a face that must lie in a blurred area | `backend/test_snapshots.py` |

### Not machine learning

`person_fallen` and `crowd_density` are **hand-written rules on top of YOLOv8 output**, not trained models. YOLOv8 only says "there is a person here". The rules then do this:

- **`crowd_density`:** count the person boxes in one sampled frame. At `CROWD_THRESHOLD` or more, an alert opens once. It can open again only after the count drops below the threshold.
- **`person_fallen`:** check whether any person box is wider than `FALL_ASPECT_RATIO` × its height (`is_wide()`), and fire when that has been true for `FALL_MIN_FRAMES` sampled frames in a row.

Nothing was trained on falls or crowds, and neither rule has been evaluated on real incidents.

### The six alert classes

The live camera grid is simulated for every class: `GET /api/v1/detections` returns `[]`, and the dashboard generates incidents with `randomIncident()` in `lib/anomaly/simulator.ts`. Only the Sandbox, with the backend running, produces real detections.

| Class | Real or simulated | Method | What would make it real (or better) |
|---|---|---|---|
| `person_fallen` | **Real** (Sandbox only) | Rule on YOLOv8n person boxes (box shape) | A pose model such as `yolov8n-pose`, tested on real fall footage |
| `crowd_density` | **Real** (Sandbox only) | Rule on the YOLOv8n person count | Per-zone thresholds, and counting over an area rather than per frame |
| `ramp_obstructed` | Simulated | Simulation | A ramp area drawn per camera, plus a rule that fires when YOLOv8 finds an object (for example a COCO car, motorcycle or bicycle) inside it for some time |
| `lamp_off` | Simulated | Simulation | An OpenCV brightness check of the lamp area after dark. No model needed. |
| `bin_overflow` | Simulated | Simulation | A custom-trained model on labelled photos of full and overflowing bins |
| `pipe_leak` | Simulated | Simulation | A custom-trained model on labelled footage of leaks and water pooling |

The snapshot code already crops asset classes (`lamp_off`, `pipe_leak`, `bin_overflow`) to the asset area (`asset_crop()`). Because the backend never emits those classes, the crop is tested only on a synthetic frame in `test_snapshots.py`.

### How a detection becomes an alert

```
 1. Sandbox upload         analyseClip()  in lib/anomaly/api.ts
        │                  POST /api/v1/sandbox/analyse. The clip is written to a temp file
        │                  (OpenCV needs a path) and deleted when analysis ends.
        ▼
 2. Clip frame             analyse()  in backend/main.py
        │                  About one frame per second (SAMPLE_EVERY_S).
        ▼
 3. YOLOv8n                detect_people(frame, conf) → person boxes
        ▼
 4. Rules                  crowd: count ≥ CROWD_THRESHOLD
        │                  fall:  is_wide() for FALL_MIN_FRAMES frames in a row
        │                  Only a NEW alert continues; repeat frames are ignored.
        ▼
 5. Snapshot frame         detection() → evidence_snapshot(), on an in-memory copy
        ▼
 6. YOLOv8n + YuNet blur   detect_people(img, 0.15) → top 25% of each box (head_region)
        │                  detect_faces(img)        → padded face boxes
        │                  apply_blur(both sets)    → pixelated
        │                  asset_crop() for lamp/pipe/bin, then downscale to ≤ 960 px
        ▼
 7. JPEG returned          Base64 JPEG in the optional "snapshot" field, with timings.
        │                  On any error, or without YuNet: no image, metadata only.
        ▼
 8. Sandbox                Boxes drawn over the original clip (shown, never stored);
        │                  anonymised thumbnails at each detection marker.
        ▼
 9. Push to alerts         ingestAlert() → the alert shows at once, snapshot "processing"
        │                  attachSnapshot() → putSnapshot() into the browser's IndexedDB
        │                  (anomalyguard-snapshots), then "ready" or "unavailable"
        ▼
10. Retention and audit    purgeExpiredSnapshots() on load and every 60 s deletes a snapshot
                           30 days after capture or 7 days after the alert is resolved,
                           whichever comes first (snapshotExpiry()). Views and exports are
                           logged with the operator's name (logSnapshotAccess()).
```

### Measured performance

> These are **small tests on one laptop with four public clips**, run during development. They are **not formal evaluations**, and they say nothing about accuracy on township cameras.

Test machine: Intel Core i5-1235U laptop, 24 GB RAM, Windows 11, CPU only (PyTorch 2.14.1 CPU build), Python 3.11.9, `ultralytics` 8.4.182, OpenCV 5.0.0.

**CPU inference speed per frame** (median of 10 sampled frames per clip):

| Clip | Frame size | YOLOv8n (`detect_people`) | YuNet (`detect_faces`, upscaled and padded) |
|---|---|---|---|
| `few_walking.ogv` | 320 × 240 | 54 ms | 153 ms |
| `few_dogwalker.webm` | 1920 × 1080 | 77 ms | 384 ms |
| `closeup_interview.webm` | 854 × 480 | 87 ms | 359 ms |
| `vtest_30s.mp4` | 768 × 576 | 109 ms | 488 ms |

**Blur time per snapshot** (the whole `evidence_snapshot()`: both models, blur and JPEG encoding; one snapshot per second of each clip):

| Clip | Snapshots | Mean | Median | Max |
|---|---|---|---|---|
| `few_walking.ogv` | 14 | 336 ms | 334 ms | 363 ms |
| `few_dogwalker.webm` | 10 | 537 ms | 543 ms | 577 ms |
| `closeup_interview.webm` | 36 | 501 ms | 503 ms | 560 ms |
| `vtest_30s.mp4` | 30 | 464 ms | 554 ms | 714 ms |
| **All** | **90** | **467 ms** | | **714 ms** |

YuNet takes most of that time. The pixelation itself takes 0.3–3 ms.

**People-count spot check.** People were counted by eye in 6 frames and compared with YOLOv8n at confidence 0.5:

| Frame | Counted by eye | YOLOv8n found |
|---|---|---|
| `vtest_30s.mp4` at 2 s | 5 | 4 |
| `vtest_30s.mp4` at 12 s | 8 | 7 |
| `vtest_30s.mp4` at 22 s | 7 | 7 |
| `few_dogwalker.webm` at 3 s | about 11 | 8 |
| `few_walking.ogv` at 3 s | about 12, most only partly in frame | 2 |
| `few_walking.ogv` at 10 s | about 4, all only partly in frame | 0 |

YOLOv8n counted well when people were whole and separate (the CCTV-style clip). It missed people who were partly hidden, overlapping, cut off by the frame edge or seen from directly above. Crowd counts are therefore likely to be **undercounts**, so `crowd_density` may fire late.

**Face-visibility test** (`backend/test_snapshots.py`: 90 snapshots across the four clips, plus the 10 snapshots returned with alerts):

- A more sensitive YuNet (score 0.25) looked for faces in every snapshot. To show there were faces to find, it first found 396 face candidates in the *original* frames.
- In the snapshots it flagged 26 candidates lying mostly outside the blurred areas: 9, 13, 0 and 4 for the four clips, in table order. Each was checked by eye:
  - 24 were dogs, torsos, bags or heads that were already pixelated.
  - 2 (both in `vtest_30s.mp4` at 8 s) point to one distant person, partly hidden by a lamp post and a sign, whom neither model detected. Their head, about 12 px tall and seen from behind, was **left unblurred**. No face is visible, but it shows that an undetected person is not blurred.
- Earlier during development, the same test found an unblurred face cut off at the bottom edge of a frame. That was fixed by giving YuNet the mirrored border and lowering `FACE_SCORE` from 0.5 to 0.35.
- The fail-closed and asset-crop checks passed.

### Known limitations

- **`person_fallen` is untested on real falls.** It is a box-shape rule, and in testing a close-up of a face (a box wider than it is tall) triggered it.
- **Undetected people stay unblurred.** Blurring only covers people or faces that one of the two models finds. Someone heavily hidden, very small or seen from an odd angle can be missed (see the 8 s case above). Blurring is a strong best effort, not a guarantee.
- **Crowd counts undercount** partly visible and overlapping people (see the spot check).
- **No township footage.** Neither model has seen the township's cameras, so accuracy on real camera angles is unknown.
- **Night and rain are unmeasured.** All test clips are daytime and dry.
- **Burned-in text is not blurred.** Captions or name tags in the video stay readable in snapshots.
- **Four classes are simulated** (see the table above), and the live camera grid is simulated for all six.
- **CPU only.** The timings above are from one laptop; nothing was tuned for speed.

### Licences: what they mean if this is ever sold or closed-source

- **YOLOv8 (AGPL-3.0):** if you distribute software that includes it, **or let people use it over a network** (for example a hosted dashboard for a township), you must make the full source code of the whole application available under AGPL-3.0. To sell AnomalyGuard or keep its code private, you would need a paid [Ultralytics Enterprise licence](https://www.ultralytics.com/license), or a replacement person detector under a permissive licence.
- **YuNet (MIT):** can be used in commercial and closed-source software. You only need to keep its copyright and licence notice.
- **Training data:** COCO and WIDER FACE have their own terms. Check them before any commercial use.

This is a plain-English summary for planning, **not legal advice**.

### Privacy notes for the models

Both models run locally inside the backend, and no frame is sent to an outside service. Neither model does recognition: YOLOv8n only finds people, and YuNet is used only to find regions to blur. YuNet's landmarks and scores are thrown away straight after detection, and no face crops, face embeddings or identity data are computed or stored. Detections carry anonymous labels (`Pedestrian`, `Fallen Posture`) and no tracking IDs. The only image that leaves the backend is the anonymised snapshot. This is privacy-by-design, aligned with PDPA principles; see [Privacy by design](#privacy-by-design).

### How to reproduce our tests

1. Set up the backend (see [backend/README.md](backend/README.md)).
2. Download the clips in the table below into `backend/samples/`. For `vtest_30s.mp4`, keep the first 30 seconds of `vtest.avi`.
3. Run:

   ```
   cd backend
   .venv\Scripts\python test_snapshots.py samples\few_walking.ogv samples\few_dogwalker.webm samples\closeup_interview.webm samples\vtest_30s.mp4
   ```

4. Per clip, the script prints the blur time per snapshot and any face candidates outside the blurred areas, then the fail-closed and asset-crop results. It writes the anonymised snapshots (never the originals) and crops of every flagged candidate (`*_uncovered.jpg`) to `backend/samples/snapshot_check/<date-time>/`. **Look at each flagged crop yourself.** A blurred head still looks like a head to a detector, so a flag is a prompt to look, not proof of a leak.

The script sets the crowd threshold to 1, so every clip with a person opens an alert. The CPU-speed and people-count figures above came from a separate one-off measurement, not from `test_snapshots.py`.

| File | What it tests | Source |
|---|---|---|
| `few_walking.ogv` | Few people, low resolution (320 px), top-down view, heads cut off at the frame edge | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Hesitant-avoidance-while-walking-an-error-of-social-behavior-generated-by-mutual-interaction-Video1.ogv) |
| `few_dogwalker.webm` | Few people, high resolution (1920 px), small background figures | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Pro_dog_walker_-_Tokyo_-_2024_Nov_1.webm) |
| `closeup_interview.webm` | One large close-up face | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Elsie_Kanza_Director,_Head_of_Africa_on_Grow_Africa.webm) |
| `vtest_30s.mp4` | Distant people, CCTV-style angle (first 30 s of `vtest.avi`) | [OpenCV samples](https://github.com/opencv/opencv/blob/4.x/samples/data/vtest.avi) |

The clips are git-ignored. Each Wikimedia file has its own licence on its file page; check it before showing a clip publicly.

### Roadmap: possible model upgrades (NOT implemented)

None of these exist in the code yet.

- [`yolov8n-pose`](https://docs.ultralytics.com/tasks/pose/) for `person_fallen`: use body keypoints instead of box shape, then test on real fall footage.
- A ramp-area rule for `ramp_obstructed`: draw the ramp area per camera and alert when an object stays inside it.
- An OpenCV brightness check for `lamp_off`.
- Custom-trained models for `bin_overflow` and `pipe_leak`, using labelled footage from township cameras.
- Testing both models on township footage, at night and in rain, before any pilot.
- If licensing matters, a permissively licensed person detector in place of YOLOv8.

## Tech stack

Next.js 13 (App Router), TypeScript, Tailwind CSS, shadcn/ui (Radix), Recharts, date-fns, Framer Motion.

Optional backend: Python, FastAPI, Ultralytics YOLOv8 (`yolov8n`), OpenCV (YuNet face detector, used only to find regions to blur).

## Credits

AnomalyGuard was repurposed from [rudra-sah00/A-AI](https://github.com/rudra-sah00/A-AI) (MIT License). The original copyright notice is kept in [LICENSE](LICENSE).
