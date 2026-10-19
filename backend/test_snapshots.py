"""Checks evidence snapshots against real clips. Not part of the service.

    .venv\\Scripts\\python test_snapshots.py samples\\few_walking.ogv samples\\closeup_interview.webm ...

For every clip it:
  1. calls POST /api/v1/sandbox/analyse in-process (with a crowd threshold of 1, so every clip with a
     person opens an alert) and checks each returned snapshot;
  2. snapshots one frame per second directly, to cover far more frames than the alerts alone.

A snapshot passes when a deliberately sensitive YuNet (score 0.3, upscaled) finds no face in it, while the
same check on the original frame is the positive control showing faces were there to find. It also tests
fail-closed behaviour and asset cropping, and writes the anonymised snapshots (never originals) to
samples/snapshot_check/ for visual inspection.
"""
from __future__ import annotations

import base64
import os
import statistics
import sys
import time

os.environ["AG_CROWD_THRESHOLD"] = "1"

import cv2  # noqa: E402
import numpy as np  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "samples", "snapshot_check", time.strftime("%Y%m%d-%H%M%S"))
SENSITIVE = 0.25  # more sensitive than the service's own FACE_SCORE, so the check is not circular
checker = cv2.FaceDetectorYN.create(main.YUNET_MODEL, "", (320, 320), SENSITIVE, 0.3, 5000)


COVERED = 0.6  # a candidate face counts as blurred when at least this share of it lies in a blurred region


def face_candidates(img: np.ndarray) -> list[tuple[float, float, float, float, float]]:
    """(x1, y1, x2, y2, score) of everything a deliberately sensitive YuNet calls a face."""
    scale = max(1.0, min(3.0, 1280 / max(img.shape[:2])))
    big = cv2.resize(img, None, fx=scale, fy=scale) if scale > 1 else img
    checker.setInputSize((big.shape[1], big.shape[0]))
    _, f = checker.detect(big)
    return [] if f is None else [(x[0] / scale, x[1] / scale, (x[0] + x[2]) / scale, (x[1] + x[3]) / scale, round(float(x[-1]), 2))
                                 for x in f]


def blurred_mask(frame: np.ndarray) -> np.ndarray:
    """The regions evidence_snapshot blurs in this frame, recomputed the same way (both models are deterministic)."""
    mask = np.zeros(frame.shape[:2], bool)
    people = main.detect_people(frame, main.BLUR_PERSON_CONF)
    for x1, y1, x2, y2 in [main.head_region(*p[:4]) for p in people] + main.detect_faces(frame):
        mask[max(0, y1):max(0, y2), max(0, x1):max(0, x2)] = True
    return mask


def uncovered_faces(img: np.ndarray, mask: np.ndarray) -> list[tuple]:
    """Face candidates in a snapshot that lie mostly outside every blurred region: a face the pipeline missed.
    Blurred heads still look like heads to a sensitive detector, so hits inside blurred regions are expected."""
    k = mask.shape[1] / img.shape[1]  # snapshots may be downscaled
    leaks = []
    for x1, y1, x2, y2, score in face_candidates(img):
        box = mask[max(0, int(y1 * k)):max(0, int(y2 * k)), max(0, int(x1 * k)):max(0, int(x2 * k))]
        if box.size and box.mean() < COVERED:
            leaks.append((round(x1 * k), round(y1 * k), round(x2 * k), round(y2 * k), score, round(float(box.mean()), 2)))
    return leaks


def review_tile(img: np.ndarray, leak: tuple, frame_w: int, caption: str) -> np.ndarray:
    """A crop of the snapshot around an uncovered candidate, with context, for a human to judge."""
    k = img.shape[1] / frame_w
    x1, y1, x2, y2 = (round(v * k) for v in leak[:4])
    pad = max(x2 - x1, y2 - y1)
    tile = img[max(0, y1 - pad):y2 + pad, max(0, x1 - pad):x2 + pad].copy()
    cv2.rectangle(tile, (min(pad, x1), min(pad, y1)), (min(pad, x1) + x2 - x1, min(pad, y1) + y2 - y1), (0, 255, 255), 1)
    tile = cv2.resize(tile, (240, 240), interpolation=cv2.INTER_NEAREST)
    cv2.putText(tile, caption, (4, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)
    return tile


def decode(snapshot: dict) -> np.ndarray:
    return cv2.imdecode(np.frombuffer(base64.b64decode(snapshot["jpeg_b64"]), np.uint8), cv2.IMREAD_COLOR)


def check_clip(client: TestClient, path: str) -> dict:
    name = os.path.splitext(os.path.basename(path))[0]
    leaks, masks, tiles = [], {}, []

    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    step, idx, frames, original_faces, direct, width = max(1, round(fps)), 0, 0, 0, [], 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if idx % step == 0:
            frames += 1
            width = frame.shape[1]
            original_faces += len(face_candidates(frame))
            masks[idx] = blurred_mask(frame)
            snap = main.evidence_snapshot(frame, "crowd_density", [])
            if snap is None:
                leaks.append(("direct", idx / fps, "snapshot failed"))
            else:
                direct.append(snap["timings_ms"])
                img = decode(snap)
                if frames % 5 == 1:
                    cv2.imwrite(os.path.join(OUT, f"{name}_t{idx / fps:05.1f}s.jpg"), img)
                for leak in uncovered_faces(img, masks[idx]):
                    leaks.append(("direct", round(idx / fps, 1), leak))
                    tiles.append(review_tile(img, leak, masks[idx].shape[1], f"{idx / fps:.0f}s {leak[4]}"))
        idx += 1
    cap.release()

    with open(path, "rb") as f:
        res = client.post("/api/v1/sandbox/analyse", files={"file": (os.path.basename(path), f)},
                          data={"classes": "crowd_density,person_fallen", "conf": "0.5"})
    res.raise_for_status()
    dets = res.json()
    timings = []
    for i, d in enumerate(dets):
        if "snapshot" not in d:
            continue
        img = decode(d["snapshot"])
        timings.append(d["snapshot"]["timings_ms"]["total"])
        cv2.imwrite(os.path.join(OUT, f"{name}_alert{i}_{d['class_name']}.jpg"), img)
        # /analyse samples the same frames (one per second), so the alert frame's mask is already known.
        seconds = (np.datetime64(d["timestamp"].rstrip("Z")) - np.datetime64("1970-01-01")) / np.timedelta64(1, "ms") / 1000
        mask = masks.get(round(seconds * fps))
        if mask is None:
            leaks.append(("alert", d["timestamp"], "no matching frame to verify against"))
            continue
        for leak in uncovered_faces(img, mask):
            leaks.append(("alert", d["timestamp"], leak))
    if tiles:
        rows = [np.hstack(tiles[k:k + 6] + [np.zeros_like(tiles[0])] * (6 - len(tiles[k:k + 6]))) for k in range(0, len(tiles), 6)]
        cv2.imwrite(os.path.join(OUT, f"{name}_uncovered.jpg"), np.vstack(rows))
    return {"name": name, "w": width, "alerts": len(dets), "alert_snaps": len(timings),
            "frames": frames, "original_faces": original_faces, "direct": direct, "leaks": leaks}


def check_fail_closed() -> list[str]:
    frame = np.full((360, 640, 3), 128, np.uint8)
    problems = []
    detector, main.face_detector = main.face_detector, None
    if main.evidence_snapshot(frame, "crowd_density", []) is not None:
        problems.append("snapshot produced without YuNet")
    main.face_detector = detector
    encode, main.cv2.imencode = main.cv2.imencode, lambda *a, **k: (False, None)
    if main.evidence_snapshot(frame, "crowd_density", []) is not None:
        problems.append("snapshot produced when JPEG encoding failed")
    main.cv2.imencode = encode
    if main.evidence_snapshot(None, "crowd_density", []) is not None:  # type: ignore[arg-type]
        problems.append("snapshot produced from an invalid frame")
    d = main.detection("crowd_density", 0.9, [], 0.0, None)  # type: ignore[arg-type]
    if "snapshot" in d or d["class_name"] != "crowd_density":
        problems.append("detection without a snapshot did not fall back to metadata only")
    return problems


def check_asset_crop() -> list[str]:
    frame = np.full((720, 1280, 3), 90, np.uint8)
    lamp = {"xyxy": [0.70, 0.10, 0.76, 0.40], "kind": "object", "label": "Street Lamp Off", "confidence": 0.9}
    problems = []
    snap = main.evidence_snapshot(frame, "lamp_off", [lamp])
    if not snap or snap["crop"] == [0, 0, 1, 1]:
        problems.append("lamp_off snapshot was not cropped")
    elif not (snap["crop"][0] <= 0.70 and snap["crop"][2] >= 0.76 and snap["crop"][1] <= 0.10 and snap["crop"][3] >= 0.40):
        problems.append(f"lamp_off crop {snap['crop']} does not contain the lamp")
    full = main.evidence_snapshot(frame, "crowd_density", [lamp])
    if not full or full["crop"] != [0, 0, 1, 1]:
        problems.append("crowd_density snapshot was cropped")
    return problems


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    client = TestClient(main.app)
    failed = False
    all_totals = []
    for clip in sys.argv[1:]:
        r = check_clip(client, clip)
        totals = [t["total"] for t in r["direct"]]
        all_totals += totals
        print(f"\n{r['name']} ({r['w']} px wide): {r['alerts']} alerts via /analyse, {r['alert_snaps']} with snapshots; "
              f"{r['frames']} frames snapshotted directly")
        print(f"  positive control: sensitive YuNet finds {r['original_faces']} faces in the ORIGINAL frames")
        if totals:
            part = lambda k: statistics.mean(t[k] for t in r["direct"])  # noqa: E731
            print(f"  blur time per snapshot: mean {statistics.mean(totals):.0f} ms, median {statistics.median(totals):.0f} ms, "
                  f"max {max(totals):.0f} ms (people {part('people'):.0f}, faces {part('faces'):.0f}, "
                  f"blur {part('blur'):.1f}, encode {part('encode'):.1f})")
        print(f"  faces visible in snapshots: {len(r['leaks'])}")
        for leak in r["leaks"][:10]:
            print(f"    LEAK {leak}")
        failed |= bool(r["leaks"])
    for label, problems in (("fail closed", check_fail_closed()), ("asset crop", check_asset_crop())):
        print(f"\n{label}: {'ok' if not problems else problems}")
        failed |= bool(problems)
    if all_totals:
        print(f"\nall clips: {len(all_totals)} snapshots, mean {statistics.mean(all_totals):.0f} ms, max {max(all_totals):.0f} ms")
    print(f"\nanonymised snapshots for review: {OUT}")
    sys.exit(1 if failed else 0)
