# Orbit edge service (FastAPI + YOLOv8)

A minimal real backend for the dashboard's Model Sandbox. It implements the contract in
`lib/anomaly/api.ts` (`EdgeDetection`).

| Endpoint | What it does |
|---|---|
| `POST /api/v1/sandbox/analyse` | Multipart `file`, `classes`, `conf`. Samples about one frame per second with `yolov8n` and returns anonymous detections. Each newly opened detection carries an anonymised evidence snapshot. |
| `POST /api/v1/evidence/anonymise` | Multipart `file` (an after-fix photo, at most 15 MB). Decoded in memory and blurred by the same fail-closed pipeline as evidence snapshots; returns the snapshot JSON, or `422` with no image if anonymisation fails. |
| `GET /api/v1/detections?since=` | Returns `[]`. The live camera grid stays simulated. |

## What is real

- **`crowd_density`:** fires when a sampled frame has at least `CROWD_THRESHOLD` people (default 8, or set `AG_CROWD_THRESHOLD`).
- **`person_fallen`:** a rough heuristic. It fires when a person box is more than 1.3× wider than tall for 2 sampled frames in a row. It has not been tested on real falls.
- **Evidence snapshots.** A detection fires once when its condition starts, not on every following frame, and only that firing gets a snapshot. The frame is copied in memory and every face region is blurred (pixelated). Each region is the union of:
  - every OpenCV **YuNet** face box, padded by 35%. YuNet runs on a copy upscaled for small clips, with a mirrored border so heads cut off at the frame edge are still found. It is used only to *find* regions to blur: landmarks and scores are discarded, and nothing is recognised, stored or returned;
  - the top 25% of every YOLOv8 person box, at a low person threshold (0.15), because over-blurring beats missing a face.

  Snapshots for asset classes (`lamp_off`, `pipe_leak`, `bin_overflow`) are cropped to the asset area, after blurring the full frame. The image is downscaled to at most 960 px and returned as a base64 JPEG in the optional `snapshot` field, with per-stage timings in `timings_ms`.

All other classes (`ramp_obstructed`, `pipe_leak`, `bin_overflow`, `lamp_off`) are never emitted; the dashboard simulates them. The asset crop is therefore exercised only by `test_snapshots.py` for now.

## Setup (Windows, Python 3.10+)

```
cd backend
py -3.11 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
mkdir models
curl -L -o models\face_detection_yunet_2023mar.onnx https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
.venv\Scripts\uvicorn main:app --port 8000
```

`yolov8n.pt` (about 6 MB) downloads automatically on first start. Model weights, the venv and `samples/` are
git-ignored. **If the YuNet file is missing, no snapshots are produced at all** (metadata only), and the service logs a warning.

Then set `NEXT_PUBLIC_ANOMALYGUARD_API=http://localhost:8000` in the project's `.env.local` and restart `npm run dev`.

## Privacy rules

- Snapshots fail closed: on any error during detection, blurring or encoding, or without YuNet, the detection is returned with metadata only and no image.
- Unblurred frames are never written to disk or returned. Blurring happens on an in-memory copy before encoding.
- The uploaded clip itself must be written to a temp file because OpenCV decodes from a path. It is deleted in a `finally` block as soon as analysis ends. This is the one place raw footage touches disk.
- No track IDs and no identity fields. Labels are anonymous (`Pedestrian`, `Fallen Posture`).

## Testing

```
.venv\Scripts\python test_snapshots.py samples\few_walking.ogv samples\closeup_interview.webm samples\vtest_30s.mp4
```

For each clip, the script calls `/analyse` with a crowd threshold of 1, so every clip with a person opens an alert. It also snapshots one frame per second directly. A deliberately more sensitive YuNet (score 0.25, versus the service's 0.35) then looks for faces in each snapshot. Candidates that lie mostly outside the regions the service blurred are reported, and crops of them are written to `samples/snapshot_check/<run>/` for a human to judge. A blurred head still looks like a head to a detector, so a reported candidate is a prompt to look, not proof of a leak. The script also checks fail-closed behaviour and asset cropping, and reports blur time per snapshot.

## Limits

- A person that neither YOLOv8 nor YuNet detects (heavily occluded, very small, or out of frame) is not blurred. This is a strong best effort, not a guarantee.
- CPU only. In testing, one snapshot took 0.2–0.7 s to anonymise (mean about 0.5 s). Face detection on the upscaled, padded frame is most of that.
