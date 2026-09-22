# Spec: Dual Reel Creation Pipelines

## 1. Overview & Objectives
Kaladhar Studio supports two distinct reel creation workflows tailored to ethnic fashion boutique creators:
- **Pipeline 1 (Manual Reel Editor Workspace)**: Located in the **Reel Library** section. Allows boutique directors to craft reels manually using photoshoot images/photos with fine-grained control over filmstrip slide sequencing, durations (0.5s–6.0s), motion effects (Ken Burns zoom/pan), transitions, typography overlays with Indian Rupee (₹) pricing, audio synchronization, real-time 60fps 9:16 canvas previewing, and direct export to the Reel Library.
- **Pipeline 2 (Photoshoot Uploads Generator)**: Located in the **Photoshoot Uploads** section. Leverages the existing FastAPI backend pipeline (`/api/videos/upload`, `/api/music`, `/api/analysis`, `/api/reels/generate`) to accept raw photoshoot videos and photos, collection details, and music selection, execute automated 9:16 vertical curation, and provide a direct path to download the reel or open it in the Reel Editor for manual refinement.

---

## 2. Functional Requirements

### Pipeline 1: Manual Reel Editor Workspace
1. **Entry Points**:
   - Primary launcher button in the Reel Library when 0 reels exist ("Launch Image Reel Editor").
   - Header button in the Reel Library when reels exist ("+ Manual Reel Editor").
   - Click to edit any existing reel or draft project.
2. **Slide Filmstrip & Media Management**:
   - Multi-file image dropzone (.jpg, .png, .webp).
   - Reorder slides (drag & drop or sequence shift arrows).
   - Per-slide duration selector (presets: 1.0s, 1.5s, 2.0s, 3.0s; decimal precision slider: 0.5s–6.0s).
   - Per-slide motion: Static, Ken Burns Zoom In, Ken Burns Zoom Out, Pan Left, Pan Right.
   - Transitions: Cut, Crossfade / Dissolve, Slide.
   - Fit mode: Smart 9:16 vertical cover vs. contain with blurred backdrop.
3. **Interactive 9:16 Canvas Player**:
   - 1080×1920 aspect-locked vertical preview.
   - 60 FPS animation loop with timecode (`00:00.0 / 00:15.0` in JetBrains Mono).
   - Interactive scrub bar with real-time frame scrubbing.
   - Play, pause, restart, loop toggle, and frame-step controls.
4. **Commercial Typography & Overlays**:
   - Space Grotesk / Sora font hierarchy for product headlines.
   - JetBrains Mono for prices in Rupees (₹) with custom luxury badge styles (Gold Zari, Obsidian Glass, Minimalist Pill).
   - Boutique brand name & logo watermark.
   - Optional branded end-card slide.
5. **Audio Studio**:
   - Ingests audio from `/api/music` with preview playback.
   - Custom audio upload support (.mp3, .wav).
   - Volume control slider & audio start offset.
6. **Export & Library Integration**:
   - Client-side MediaRecorder canvas stream export (high-resolution 9:16 vertical video).
   - Auto-registers generated reel into `localStorage` `kaladhar_reels_{userId}`.
   - Seamless return to Reel Library with instant in-card video playback and MP4 download.

### Pipeline 2: Photoshoot Uploads Generator
1. **Intact Backend Alignment**:
   - Does NOT touch or modify existing backend video processing algorithms.
   - Directly connects to `/api/videos/upload`, `/api/music`, `/api/analysis`, and `/api/reels/generate`.
2. **4-Step User Path**:
   - **Step 1: Upload Media**: Accept raw videos (.mp4, .mov) and photos (.jpg, .png).
   - **Step 2: Collection Metadata**: Title, Category (Sarees, Lehengas, Kurtis, Bridal), Price in ₹.
   - **Step 3: Soundtrack Selection**: Browse and audition tracks from `/api/music`.
   - **Step 4: Generate & Monitor**: Step-by-step progress telemetry (Ingesting -> Analyzing -> Planning -> Rendering).
3. **Dual Handoff**:
   - 9:16 in-player preview upon completion.
   - "Download MP4" action.
   - "Open in Reel Editor" action (hands off the generated reel into Pipeline 1 workspace).

---

## 3. Typography & Aesthetic Directives
- Display Titles & Headings: `Space Grotesk`, `Sora`
- Body Text & Controls: `Inter`, `IBM Plex Sans`
- Timecodes, Durations, Framerates & Prices: `JetBrains Mono`
- Dark luxury studio palette: obsidian `#09090b` / `#0d0d10`, elevated `#141419`, saffron accent `#ff681b`.
