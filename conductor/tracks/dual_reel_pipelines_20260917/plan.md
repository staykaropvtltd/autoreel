# Plan: Dual Reel Creation Pipelines

This plan outlines the atomic execution steps for implementing both pipelines.

---

## Phase 1: Pipeline 1 — Professional Manual Reel Editor Workspace
- [x] Task 1.1: Create `ReelImageEditorWorkspace.tsx` component with:
  - Top studio bar with project title, category, status badge, timecode readout (`00:00.0 / 00:15.0`), and actions.
  - Left slide filmstrip manager with dropzone, slide reordering, duration presets/slider, motion selector, and fit mode.
  - Center 9:16 interactive canvas renderer with 60 FPS requestAnimationFrame loop, live Ken Burns zoom/pan, transitions, real-time overlays, and interactive scrubber.
  - Right inspector tabs (Timing & Motion, Typography & Overlays, Audio & Soundtrack).
  - Client-side MediaRecorder 9:16 vertical MP4/WebM video export engine and `localStorage` persistence.
- [x] Task 1.2: Add styles in `ReelImageEditorWorkspace.css` for the editing workstation, filmstrip, timeline scrubber, and canvas frame.
- [x] Task 1.3: Integrate `ReelImageEditorWorkspace` into `DashboardScreen.tsx`:
  - Add workspace toggle state (`isEditingManualReel`, `manualEditorProject`).
  - Add "MANUAL EDITOR (IMAGES)" entry in the launcher panel and "+ MANUAL REEL EDITOR" in the library header.
  - Wire save/close handler to register the project in `projects` state.

## Phase 2: Pipeline 2 — Photoshoot Uploads Generator (Aligned to Existing Backend)
- [x] Task 2.1: Upgrade `PhotoshootUploadsPage` in `DashboardScreen.tsx`:
  - Multi-asset uploader supporting both raw videos (.mp4, .mov) and photoshoot photos (.jpg, .png).
  - Collection/product metadata form (Title, Category, Price in ₹, Fabric/Story).
  - Music track browser fetching tracks from `/api/music` with audio preview player (`/api/music/{id}/preview`).
  - Generation pipeline integration calling existing endpoints (`uploadVideos`, `startAnalysis`, `getAnalysis`, `planReel`, `generateReel`).
  - Live 4-stage progress telemetry.
  - Result view with 9:16 vertical video player, "Download Reel" button, and "Open in Reel Editor" button.
- [x] Task 2.2: Verify seamless handoff from Pipeline 2 to Pipeline 1 (opening generated reel in the Manual Reel Editor).

## Phase 3: Verification & Polish
- [x] Task 3.1: Verify typography adherence (Space Grotesk / Sora, Inter / IBM Plex Sans, JetBrains Mono).
- [x] Task 3.2: Run `npm run build` (`tsc -b && vite build`) to ensure 0 errors.
- [x] Task 3.3: Verify both Vite and FastAPI servers are operating cleanly.
- [x] Task 3.4: Update Conductor tracks registry and walkthrough artifact.
