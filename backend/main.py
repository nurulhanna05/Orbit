"""Orbit edge service: a minimal real YOLOv8 backend for the dashboard.

Implements the contract in lib/anomaly/api.ts (EdgeDetection). Only two classes are real here:
crowd_density (person count) and person_fallen (a rough box-shape heuristic). When a detection opens,
that single frame becomes an evidence snapshot: faces are blurred in memory and only the anonymised
JPEG is returned. Unblurred frames are never written to disk or returned.

Run:  .venv\\Scripts\\uvicorn main:app --port 8000
"""

from __future__ import annotations

import base64
import os
import tempfile
import time
from datetime import datetime, timezone

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

# ---- Tunables -------------------------------------------------------------------------------
CROWD_THRESHOLD = int(os.environ.get("AG_CROWD_THRESHOLD", 8))  # people in one sampled frame that raise crowd_density
FALL_ASPECT_RATIO = 1.3      # box width / height above this looks like a person lying down
FALL_MIN_FRAMES = 2          # consecutive sampled frames with a wide box before person_fallen fires
SAMPLE_EVERY_S = 1.0         # analyse about one frame per second of clip
HEAD_FRACTION = 0.25         # top share of each person box treated as the face region and blurred
FACE_SCORE = 0.35            # YuNet face score above which a region is blurred (low = blur more)
FACE_PAD = 0.35              # grow each YuNet box by this share on every side before blurring
FACE_MAX_SIDE = 1280         # YuNet runs on a copy scaled so its longest side is about this...
FACE_MAX_UPSCALE = 3.0       # ...upscaling small clips (at most 3x) so tiny faces are still found
FACE_EDGE_PAD = 0.15         # YuNet also sees a mirrored border of this share of the frame, for faces cut off at an edge
BLUR_PERSON_CONF = 0.15      # person confidence used for blurring: over-blurring beats missing a face
PIXEL_BLOCKS = 6             # a blurred region keeps at most this many blocks across its short side
SNAPSHOT_MAX_SIDE = 960      # snapshots are downscaled (after blurring) so their longest side is at most this
SNAPSHOT_JPEG_QUALITY = 80
ASSET_CROP_PAD = 0.6         # asset snapshots keep this share of the asset box as context on every side...
ASSET_CROP_MIN = 0.3         # ...and are never narrower or shorter than this share of the frame
YUNET_MODEL = os.path.join(os.path.dirname(__file__), "models", "face_detection_yunet_2023mar.onnx")
DEFAULT_CAMERA = "CAM-01"    # sandbox detections are attributed here; must be CAM-01..CAM-08
MAX_UPLOAD_MB = 200
MAX_PHOTO_MB = 15            # after-fix photos (POST /api/v1/evidence/anonymise)
PERSON = 0                   # COCO class id

# Only these two classes are produced by real inference; the dashboard simulates the rest.
REAL_CLASSES = {"person_fallen", "crowd_density"}
# Snapshots of these are cropped to the asset. This service does not emit them yet; the dashboard simulates them.
ASSET_CLASSES = {"lamp_off", "pipe_leak", "bin_overflow"}
ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:3123"]

app = FastAPI(title="Orbit edge service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = YOLO(os.path.join(os.path.dirname(__file__), "yolov8n.pt"))

# YuNet is used only to find face regions to blur. Its landmarks and scores are discarded straight away;
# no face crop, embedding or identity is ever computed, stored or returned.
face_detector = None
if os.path.exists(YUNET_MODEL):
    face_detector = cv2.FaceDetectorYN.create(YUNET_MODEL, "", (320, 320), FACE_SCORE, 0.3, 5000)
else:
    print(f"[warn] {YUNET_MODEL} missing: evidence snapshots are disabled (see backend/README.md)")


# ---- Helpers --------------------------------------------------------------------------------
def clip_timestamp(offset_s: float) -> str:
    """The sandbox maps timestamp % clip length onto the timeline, so encode the clip offset."""
    return datetime.fromtimestamp(offset_s, timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def detect_people(frame: np.ndarray, conf: float) -> list[tuple[float, float, float, float, float]]:
    result = model.predict(frame, conf=conf, classes=[PERSON], verbose=False)[0]
    return [(*xyxy, c) for xyxy, c in zip(result.boxes.xyxy.tolist(), result.boxes.conf.tolist())]


def head_region(x1: float, y1: float, x2: float, y2: float) -> tuple[int, int, int, int]:
    return int(x1), int(y1), int(x2), int(y1 + (y2 - y1) * HEAD_FRACTION)


def detect_faces(frame: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Face rectangles (x1, y1, x2, y2) from YuNet, padded. Only boxes leave this function."""
    if face_detector is None:
        return []
    h, w = frame.shape[:2]
    scale = min(FACE_MAX_UPSCALE, FACE_MAX_SIDE / max(h, w))
    scaled = cv2.resize(frame, (round(w * scale), round(h * scale))) if abs(scale - 1) > 0.05 else frame
    # A head cut off by the frame edge is easily missed; a mirrored border gives YuNet the rest of the shape.
    pad = round(max(scaled.shape[:2]) * FACE_EDGE_PAD)
    padded = cv2.copyMakeBorder(scaled, pad, pad, pad, pad, cv2.BORDER_REFLECT)
    face_detector.setInputSize((padded.shape[1], padded.shape[0]))
    _, faces = face_detector.detect(padded)
    boxes = []
    for f in faces if faces is not None else []:
        # Landmarks (f[4:14]) and score are ignored. Boxes wholly inside the border are reflections.
        x, y = (float(f[0]) - pad) / scale, (float(f[1]) - pad) / scale
        fw, fh = float(f[2]) / scale, float(f[3]) / scale
        if x + fw <= 0 or y + fh <= 0 or x >= w or y >= h:
            continue
        px, py = fw * FACE_PAD, fh * FACE_PAD
        boxes.append((int(x - px), int(y - py), int(x + fw + px), int(y + fh + py)))
    return boxes


def apply_blur(frame: np.ndarray, regions) -> None:
    """Pixelate then smooth each region in place: a few coarse blocks per face, so features are
    unrecoverable, at a cost that does not grow with region size."""
    h, w = frame.shape[:2]
    for rx1, ry1, rx2, ry2 in regions:
        rx1, ry1, rx2, ry2 = max(0, rx1), max(0, ry1), min(w, rx2), min(h, ry2)
        rw, rh = rx2 - rx1, ry2 - ry1
        if rw < 2 or rh < 2:
            continue
        block = max(2, min(rw, rh) // PIXEL_BLOCKS)
        tiny = cv2.resize(frame[ry1:ry2, rx1:rx2], (max(1, rw // block), max(1, rh // block)), interpolation=cv2.INTER_AREA)
        frame[ry1:ry2, rx1:rx2] = cv2.resize(tiny, (rw, rh), interpolation=cv2.INTER_LINEAR)


def asset_crop(class_name: str, boxes: list[dict], w: int, h: int) -> tuple[int, int, int, int] | None:
    """Pixel crop around the asset boxes of an asset alert, or None to keep the whole frame."""
    assets = [b["xyxy"] for b in boxes if b.get("kind") != "pedestrian"]
    if class_name not in ASSET_CLASSES or not assets:
        return None
    x1, y1 = min(b[0] for b in assets), min(b[1] for b in assets)
    x2, y2 = max(b[2] for b in assets), max(b[3] for b in assets)
    half_w = max((x2 - x1) * (0.5 + ASSET_CROP_PAD), ASSET_CROP_MIN / 2)
    half_h = max((y2 - y1) * (0.5 + ASSET_CROP_PAD), ASSET_CROP_MIN / 2)
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    crop = (max(0, int((cx - half_w) * w)), max(0, int((cy - half_h) * h)),
            min(w, int((cx + half_w) * w)), min(h, int((cy + half_h) * h)))
    return crop if crop[2] - crop[0] >= 2 and crop[3] - crop[1] >= 2 else None


def evidence_snapshot(frame: np.ndarray, class_name: str, boxes: list[dict]) -> dict | None:
    """Anonymised JPEG of the frame where an alert opened, or None.

    Fails closed: on any error, or when the YuNet face detector is unavailable, no image is produced and
    the caller sends metadata only. Everything happens on an in-memory copy; nothing is written to disk."""
    try:
        if face_detector is None:
            raise RuntimeError("YuNet face detector unavailable")
        t0 = time.perf_counter()
        img = frame.copy()
        h, w = img.shape[:2]
        people = detect_people(img, BLUR_PERSON_CONF)
        t1 = time.perf_counter()
        faces = detect_faces(img)
        t2 = time.perf_counter()
        regions = [head_region(x1, y1, x2, y2) for x1, y1, x2, y2, _ in people] + faces
        apply_blur(img, regions)  # blur the full frame before cropping, so a face cut by the crop is still found
        t3 = time.perf_counter()
        crop = asset_crop(class_name, boxes, w, h)
        if crop:
            img = img[crop[1]:crop[3], crop[0]:crop[2]]
        scale = min(1.0, SNAPSHOT_MAX_SIDE / max(img.shape[:2]))
        if scale < 1.0:
            img = cv2.resize(img, (round(img.shape[1] * scale), round(img.shape[0] * scale)), interpolation=cv2.INTER_AREA)
        ok, jpeg = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, SNAPSHOT_JPEG_QUALITY])
        if not ok:
            raise RuntimeError("JPEG encoding failed")
        t4 = time.perf_counter()
        ms = lambda a, b: round((b - a) * 1000, 1)  # noqa: E731
        timings = {"people": ms(t0, t1), "faces": ms(t1, t2), "blur": ms(t2, t3), "encode": ms(t3, t4), "total": ms(t0, t4)}
        print(f"[snapshot] {class_name}: {len(people)} person bands + {len(faces)} faces blurred"
              f"{', cropped to asset' if crop else ''}, {timings['total']} ms (people {timings['people']}, "
              f"faces {timings['faces']}, blur {timings['blur']}, encode {timings['encode']})")
        return {
            "jpeg_b64": base64.b64encode(jpeg.tobytes()).decode("ascii"),
            "width": img.shape[1],
            "height": img.shape[0],
            # Normalised crop of the original frame, so boxes can be mapped onto the snapshot.
            "crop": [round(crop[0] / w, 4), round(crop[1] / h, 4), round(crop[2] / w, 4), round(crop[3] / h, 4)]
            if crop else [0, 0, 1, 1],
            "regions_blurred": len(regions),
            "timings_ms": timings,
        }
    except Exception as error:  # noqa: BLE001 - any failure means no image leaves this service
        print(f"[snapshot] {class_name}: failed closed, metadata only ({type(error).__name__}: {error})")
        return None


def to_box(person, w: int, h: int, fallen: bool) -> dict:
    x1, y1, x2, y2, c = person
    hx1, hy1, hx2, hy2 = head_region(x1, y1, x2, y2)
    return {
        "xyxy": [round(x1 / w, 4), round(y1 / h, 4), round(x2 / w, 4), round(y2 / h, 4)],
        "label": "Fallen Posture" if fallen else "Pedestrian",
        "kind": "pedestrian",
        "confidence": round(c, 2),
        # Centre and radius of the head band (blurred in the snapshot), normalised to the frame.
        "face_xy_r": [round((hx1 + hx2) / 2 / w, 4), round((hy1 + hy2) / 2 / h, 4), round((hx2 - hx1) / 2 / w, 4)],
    }


def detection(class_name: str, confidence: float, boxes: list[dict], offset_s: float, frame: np.ndarray) -> dict:
    """A newly opened detection. Only these get an evidence snapshot; repeat frames never do."""
    d = {
        "camera_id": DEFAULT_CAMERA,
        "class_name": class_name,
        "confidence": round(confidence, 2),
        "timestamp": clip_timestamp(offset_s),
        "boxes": boxes,
        "face_blurred": True,  # any image in this payload is face-blurred; otherwise there is no image
    }
    snapshot = evidence_snapshot(frame, class_name, boxes)
    if snapshot is not None:
        d["snapshot"] = snapshot
    return d


def is_wide(person) -> bool:
    x1, y1, x2, y2, _ = person
    return (x2 - x1) > FALL_ASPECT_RATIO * max(1.0, y2 - y1)


async def save_upload(file: UploadFile) -> str:
    """Uploads go to a temp file (OpenCV needs a path); callers delete it in a finally block."""
    data = await file.read()
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"Clip larger than {MAX_UPLOAD_MB} MB")
    suffix = os.path.splitext(file.filename or "")[1] or ".mp4"
    fd, path = tempfile.mkstemp(suffix=suffix, prefix="ag-upload-")
    with os.fdopen(fd, "wb") as f:
        f.write(data)
    return path


def open_clip(path: str) -> tuple[cv2.VideoCapture, float]:
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise HTTPException(400, "Could not decode the video")
    fps = cap.get(cv2.CAP_PROP_FPS)
    return cap, fps if fps and fps > 0 else 25.0


def parse_classes(classes: str) -> set[str]:
    wanted = {c.strip() for c in classes.split(",") if c.strip()}
    return (wanted or REAL_CLASSES) & REAL_CLASSES


# ---- Endpoints ------------------------------------------------------------------------------
@app.post("/api/v1/sandbox/analyse")
async def analyse(file: UploadFile = File(...), classes: str = Form(""), conf: float = Form(0.5)):
    wanted = parse_classes(classes)
    conf = min(max(conf, 0.05), 0.95)
    path = await save_upload(file)
    cap = None
    try:
        cap, fps = open_clip(path)
        step = max(1, round(fps * SAMPLE_EVERY_S))
        results, frame_idx = [], 0
        fall_streak, crowd_active = 0, False
        started, sampled = time.perf_counter(), 0

        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if frame_idx % step == 0:
                sampled += 1
                offset = frame_idx / fps
                h, w = frame.shape[:2]
                people = detect_people(frame, conf)

                wide = [p for p in people if is_wide(p)]
                fall_streak = fall_streak + 1 if wide else 0
                # Fire once when a streak reaches the minimum, not on every following frame.
                if "person_fallen" in wanted and fall_streak == FALL_MIN_FRAMES:
                    results.append(detection("person_fallen", max(p[4] for p in wide),
                                             [to_box(p, w, h, True) for p in wide], offset, frame))

                crowded = len(people) >= CROWD_THRESHOLD
                if "crowd_density" in wanted and crowded and not crowd_active:
                    results.append(detection("crowd_density", sum(p[4] for p in people) / len(people),
                                             [to_box(p, w, h, is_wide(p)) for p in people], offset, frame))
                crowd_active = crowded
            frame_idx += 1

        elapsed = time.perf_counter() - started
        snaps = [r["snapshot"]["timings_ms"]["total"] for r in results if "snapshot" in r]
        print(f"[analyse] {frame_idx} frames, {sampled} sampled in {elapsed:.1f}s "
              f"({sampled / max(elapsed, 1e-6):.1f} sampled fps), {len(results)} detections, {len(snaps)} snapshots"
              + (f" (mean {sum(snaps) / len(snaps):.0f} ms)" if snaps else ""))
        return results
    finally:
        if cap is not None:
            cap.release()
        os.remove(path)


@app.post("/api/v1/evidence/anonymise")
async def anonymise(file: UploadFile = File(...)):
    """After-fix photo of a resolved ticket, anonymised exactly like an alert's snapshot.

    The upload is decoded in memory and never written to disk. Fails closed: if the face blur cannot run,
    the response is 422 and no image is returned."""
    data = await file.read()
    if len(data) > MAX_PHOTO_MB * 1024 * 1024:
        raise HTTPException(413, f"Photo larger than {MAX_PHOTO_MB} MB")
    frame = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    del data
    if frame is None:
        raise HTTPException(400, "Could not decode the image")
    snapshot = evidence_snapshot(frame, "after_fix", [])
    if snapshot is None:
        raise HTTPException(422, "The photo could not be anonymised, so it was discarded")
    return snapshot


@app.get("/api/v1/detections")
def detections(since: str = ""):
    # The live camera grid stays simulated in the dashboard; no camera streams are connected yet.
    return []
