# Gesture — ASL Live Translator

Real-time ASL-to-text (and optional speech) translation, built for the
hackathon PRD. Runs entirely in the browser: webcam → MediaPipe hand/pose
landmarks → sign recognition → smoothed transcript → optional ElevenLabs
speech.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000, click **Start Camera**, allow webcam access, and
sign. Requires a webcam and a browser with WebGPU/WebGL support (Chrome/Edge
recommended — MediaPipe uses GPU delegation).

## What's real vs. demo in this build

This ships a genuinely working end-to-end pipeline, with one deliberate
simplification called out in the PRD itself ("if not feasible, implement a
constrained demo vocabulary with a clear architecture that can be
expanded"):

| Piece | Status |
|---|---|
| Webcam / screen capture | Real (`getUserMedia` / `getDisplayMedia`) |
| Hand + pose landmark detection | Real — `@mediapipe/tasks-vision`, runs on-device |
| Skeleton wireframe overlay, FPS, confidence readout | Real |
| Sign recognition | **Demo vocabulary**, geometric/rule-based (see below) |
| Temporal smoothing / stability voting | Real |
| Transcript assembly, copy/insert/clear | Real |
| Chat-insert textbox | Real (demo textarea; wire to any input field the same way) |
| ElevenLabs speech output | Real (bring your own API key) |
| Overlay mode | Real — draggable, resizable floating caption window |
| Screen capture / "translate someone else signing" mode | Real capture pipeline, same demo recognizer |

**Why the recognizer is rule-based, not a trained model:** real ASL
recognition needs a temporal model trained on a large dataset (WLASL,
How2Sign, etc.) — sign meaning depends on movement trajectories and
handshape transitions that per-frame geometry can't capture, and training or
hosting such a model was out of scope for this build. What's here instead is
`src/lib/vision/recognizer.ts`: a small, honest, rule-based classifier that
recognizes a handful of signs (HELLO, YES, NO, THANK YOU, I LOVE YOU, STOP,
PLEASE, HELP) plus a handful of static fingerspelling letters, purely so the
rest of the pipeline has something real to run end-to-end for a demo.

**To swap in a real model:** implement the `RecognizerEngine` interface
(one function: `classify(window: VisionFrame[]) => RecognitionCandidate |
null`) with a call to a hosted WLASL/How2Sign model, and drop it into
`useVisionEngine.ts` in place of `demoRecognizer`. Nothing else in the app —
buffering, smoothing, transcript, speech, UI — needs to change.

## Architecture

```
src/
  app/                 Next.js App Router pages, layout, global styles
  components/          CameraView, Transcript, Settings, Overlay, Header
  hooks/
    useVisionEngine.ts  Owns the capture + detect + recognize + commit loop
  lib/
    vision/
      mediapipe.ts      Only file that touches @mediapipe/tasks-vision
      buffer.ts         Rolling frame buffer + temporal stability voter
      recognizer.ts     Demo recognition engine (swappable, see above)
    services/
      speech.ts               ElevenLabs TTS wrapper
      transcriptCleanup.ts    Word -> sentence assembly
  store/
    useAppStore.ts      Zustand store: camera state, live readout, settings, transcript
  types/                Shared types binding the pipeline together
```

Vision/recognition logic is intentionally kept out of React components —
`useVisionEngine` runs its own `requestAnimationFrame` loop and only pushes
results into the Zustand store; components just render state.

## Settings

- **Confidence threshold** — minimum recognizer confidence to consider a candidate.
- **Frames to confirm a sign** — how many consecutive matching frames before a word commits (prevents "HELLO HELLO HELLO" flicker).
- **Voice output** — requires your own ElevenLabs API key, kept in memory only, sent directly to ElevenLabs from the browser.
- **Overlay mode** — a small draggable floating window showing only the live caption, meant to sit on top of a meeting window.
- **Webcam / Screen** — switch input source; screen mode is meant for translating another participant's signing during a shared meeting window.

## Known limitations

- The demo recognizer is geometry-based and single-hand; it will misfire on
  signs outside its small vocabulary and won't distinguish subtleties real
  ASL relies on (non-manual markers, two-handed signs, precise trajectories).
- Fingerspelling covers a small static-letter subset (A, B, D, I, L, O, Y).
- Overlay mode is a floating in-app window, not a true always-on-top
  OS-level overlay or a Zoom/Teams plugin (that needs a desktop capture API
  and native app, per the PRD's "Future Features").
- ElevenLabs calls are made directly from the browser with a user-supplied
  key; for production this should be proxied through a backend so the key
  isn't client-exposed.

## Deployment

Static-friendly Next.js app; deploys to Netlify as described in the PRD
(`npm run build`, publish `.next` with the Next.js Netlify plugin, or
`next export`-style static hosting if you remove server-only features).
