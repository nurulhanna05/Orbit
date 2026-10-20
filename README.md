# Orbit

**A privacy-first smart township and infrastructure platform.** Built for the Sime Darby hackathon (Track: People). Demo township: *SDP Township · City of Elmina*.

Orbit gives township operators situational awareness and predictive maintenance for community spaces: jogging tracks, playgrounds, bin bays, main gates, car parks and corridors. It detects **object states, environmental hazards and anonymous behaviour, never identities**.

This README covers setting the project up. Everything else (features, privacy design, architecture, the API, the models and their measured performance) is in **[docs/DOCUMENTATION.md](docs/DOCUMENTATION.md)**.

## What you need

| | Version | Needed for |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18 or later | The dashboard (always) |
| [Python](https://www.python.org/downloads/) | 3.10 or later (3.11 recommended) | The optional YOLOv8 backend for the Model Sandbox and after-fix photos |
| [Git](https://git-scm.com/) | any | Cloning the repository |

The commands below are for Windows (Command Prompt or PowerShell). On macOS or Linux, use `.venv/bin/` instead of `.venv\Scripts\`.

## 1. Run the dashboard

The dashboard runs fully on its own, with simulated cameras and incidents.

```
git clone <repository url> orbit
cd orbit
npm install
npm run dev
```

Open http://localhost:3000 and log in with **admin / admin**.

The first page load in development takes about 10 seconds while Next.js compiles it; later pages are faster. Data is kept in your browser, so nothing else needs setting up. *Reset demo data* (on the Overview page, or under Settings) starts over.

## 2. Optional: run the YOLOv8 backend

The backend runs a real YOLOv8 model on clips uploaded to the **Model Sandbox**, and anonymises **after-fix photos** when resolving tickets. Without it, the Sandbox shows simulated detections and after-fix photos use a simulated scene.

**One-time setup**, from the project folder:

```
cd backend
py -3.11 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
mkdir models
curl -L -o models\face_detection_yunet_2023mar.onnx https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
```

The face model file is required: without it, no evidence images are produced at all. The YOLOv8 weights (`yolov8n.pt`, about 6 MB) download automatically on first start.

**Point the dashboard at the backend.** Create a file called `.env.local` in the project folder (not in `backend/`) containing:

```
NEXT_PUBLIC_ANOMALYGUARD_API=http://localhost:8000
```

**Start both servers**, each in its own terminal, and keep both running:

```
cd backend
.venv\Scripts\uvicorn main:app --port 8000
```

```
npm run dev
```

If `npm run dev` was already running, restart it after creating `.env.local`.

Open the dashboard at **http://localhost:3000**, not `127.0.0.1`: the backend only accepts requests from `localhost:3000` and `localhost:3123`.

**Check it works:** open *Model Sandbox*, choose a video clip, tick *Person Fallen* and/or *Crowd Density*, and click *Run analysis*. A crowd alert needs at least 8 people in frame. To test with a clip of only a few people, start the backend with a lower threshold:

```
set AG_CROWD_THRESHOLD=1
.venv\Scripts\uvicorn main:app --port 8000
```

(In PowerShell, use `$env:AG_CROWD_THRESHOLD=1` instead of `set`.)

## Common problems

| Problem | Fix |
|---|---|
| Sandbox says the detection service at `http://localhost:8000` did not respond | The backend is not running. Start it (step 2) and keep its terminal open. |
| Sandbox shows *Simulated detections · clip not analysed* | `.env.local` is missing or in the wrong folder. Create it in the project folder and restart `npm run dev`. |
| *No anomalies above the threshold* | Normal for clips with fewer than 8 people. Lower `AG_CROWD_THRESHOLD` as above. |
| Detections have *no snapshot (metadata only)* | `backend/models/face_detection_yunet_2023mar.onnx` is missing. Download it (step 2). |
| *Could not decode the video* | Convert the clip to H.264 `.mp4`. |
| `py` is not recognised | Python is not installed or not on PATH. Install it from python.org with *Add to PATH* ticked, or use `python -m venv .venv`. |
| Port 3000 is already in use | Next.js picks the next free port. Use `localhost:3000` for the backend to accept requests, so stop the other process first. |

More causes and fixes are in [docs/DOCUMENTATION.md → Troubleshooting](docs/DOCUMENTATION.md#troubleshooting).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` | Static production build, written to `out/` |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `backend\.venv\Scripts\python backend\test_snapshots.py <clips>` | Checks backend evidence images for visible faces (see [How to reproduce our tests](docs/DOCUMENTATION.md#how-to-reproduce-our-tests)) |

## Before deploying anywhere public

The login is demo-grade: the site is a static export with no server, so it cannot stop someone who edits browser storage. Do not put real camera feeds behind it, and replace the `admin / admin` account at build time:

```bash
NEXT_PUBLIC_ANOMALYGUARD_LOGIN_USER=ops NEXT_PUBLIC_ANOMALYGUARD_LOGIN_SHA256=$(node -e "console.log(require('crypto').createHash('sha256').update('anomalyguard:' + process.argv[1]).digest('hex'))" 'a-long-passphrase') npm run build
```

See [Security model](docs/DOCUMENTATION.md#security-model).

## Further reading

- [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md): features, privacy design, evidence storage and reports, demo script, architecture, API contract, models and performance
- [backend/README.md](backend/README.md): the edge service in detail
- [docs/DESIGN.md](docs/DESIGN.md): colours, typography, motion and accessibility

## Credits

Built by **SheCodes** for the Sime Darby Property Hackathon 2026:

- Nurul Hanna binti Abdul Halim ([@nurulhanna25072005-bot](https://github.com/nurulhanna25072005-bot))
- Nur Hannah binti Muhammad Yuri ([@hana-yur](https://github.com/hana-yur))
- Rasya Aleeya binti Mohd Shakri ([@rasyashakri05](https://github.com/rasyashakri05))
- Siti Najah Nurdini binti Mohd Amran ([@nurdini1645](https://github.com/nurdini1645))

Orbit (formerly AnomalyGuard) was repurposed from [rudra-sah00/A-AI](https://github.com/rudra-sah00/A-AI) (MIT License). The original copyright notice is kept in [LICENSE](LICENSE).
