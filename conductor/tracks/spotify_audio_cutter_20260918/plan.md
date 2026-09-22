# Implementation Plan: Pipeline 2 Spotify Music Selection & Audio Waveform Cutter

**Track ID:** `spotify_audio_cutter_20260918`  
**Status:** In Progress  
**Spec Link:** [spec.md](./spec.md)  

---

## Phase 1: Backend Audio Trimming & TDD

- [x] Task: Write failing unit test for `reel_editor_renderer.py` with custom audio start_time
  - [x] Write `test_render_final_overlay_custom_audio_start_time` in `backend/tests/test_reel_editor_renderer.py` asserting `atrim={start:.3f}:{end:.3f},asetpts=PTS-STARTPTS` filter exists
  - [x] Run pytest to confirm failure (Red)
- [x] Task: Implement dynamic audio cutting in `backend/app/services/reel_editor_renderer.py`
  - [x] Extract `start = max(0.0, float(music.start_time or 0.0))` and `end = start + float(target_duration)`
  - [x] Replace hardcoded `atrim=0:{target_duration:.3f}` with dynamic `atrim={start:.3f}:{end:.3f},asetpts=PTS-STARTPTS` in audio filter chain
  - [x] Run pytest to verify all tests pass (Green)
- [x] Task: Phase Verification & Checkpoint — test passes, atrim confirmed

---

## Phase 2: Visual Audio Waveform Cutter Component

- [x] Task: Implement `AudioWaveformCutter.tsx` component in `frontend/src/components/dashboard/`
  - [x] Build responsive audio timeline with Web Audio API decoded waveform (synthetic fallback)
  - [x] Implement draggable selection window auto-locked to target reel duration
  - [x] Add hook jump preset shortcuts (`Intro 0:00`, `Drop 0:15`, `Chorus 0:30`)
  - [x] Add dedicated "Audition Cut" preview player that plays the cut window and stops at the end marker
  - [x] Render timecodes strictly in JetBrains Mono font (`00:15.0 - 00:30.0 [15.0s]`)
- [x] Task: Phase Verification & Checkpoint — `tsc -b && vite build` passes with 0 errors

---

## Phase 3: Spotify Music Hub & Pipeline 2 Integration

- [x] Task: Upgrade Soundtrack step in `frontend/src/components/dashboard/PhotoshootUploadsPage.tsx`
  - [x] Build Spotify Trending Reels catalog with search, album artwork, artist tags, and Spotify green badge
  - [x] Embed `AudioWaveformCutter` when user picks a track
  - [x] Wire selected `start_time` and `end_time` into `planToGenerate.music` payload
  - [x] Support custom audio upload and Spotify track link import fallback
- [x] Task: Phase Verification & Checkpoint — build passes, 0 TypeScript errors

---

## Phase 3.1: Decoupled Workflow (Video Upload → Audio & Reel Studio)

- [x] Task: Decouple Video Upload from Music Selection
  - [x] Remove music catalog, cutter, and soundtrack boxes from initial upload screen (Stage 1: Pure Video Upload)
  - [x] Auto-advance / provide "PROCEED TO SOUNDTRACK & REEL STUDIO" CTA upon selecting/uploading video takes
  - [x] Introduce dedicated Stage 2 "Soundtrack & Reel Studio" workspace with staged video inspector preview
  - [x] Integrate Spotify Music Hub and AudioWaveformCutter into Stage 2 with timecodes and audition player
  - [x] Provide clean two-way breadcrumb navigation (`← Back to Upload` / `Manage Footage`)
  - [x] `npm run build` passes with 0 errors (785ms)

---

## Phase 4: Full-Stack Verification & Code Review

- [x] Task: Automated testing & compilation validation
  - [x] Run `npm run build` in `frontend/` (0 TypeScript / build errors) ✅
  - [ ] Run backend test suite via `pytest backend/tests/` (verify no regressions)
- [ ] Task: Manual end-to-end verification
  - [ ] Launch Pipeline 2 in browser, select "Ghoomar (Padmaavat)", cut from 0:20 to 0:35, audition cut, and verify generation payload
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
