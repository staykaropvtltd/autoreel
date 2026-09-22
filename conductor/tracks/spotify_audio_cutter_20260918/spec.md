# Track Specification: Pipeline 2 Spotify Music Selection & Audio Waveform Cutter

**Track ID:** `spotify_audio_cutter_20260918`  
**Type:** Feature  
**Status:** Draft  
**Created:** 2026-09-18  

---

## 1. Overview & Goals

In **Pipeline 2 (Photoshoot Uploads)**, users upload raw video takes and photos of ethnic Indian garments, and the engine automatically generates rhythm-synced 9:16 vertical commercial reels. 

This track enhances the music selection step by introducing:
1. **Spotify Trending Reels Music Hub**: A curated, searchable catalog of trending Indian ethnic fashion, Bollywood wedding hits, festive beats, and regional classical fusion tracks with rich metadata (track title, artist, album artwork, duration, tempo/mood tags) and Spotify branding. Includes custom audio upload and Spotify track link import.
2. **Interactive Audio Waveform Cutter / Trimmer**: An intuitive visual audio trimmer that renders the track's waveform, provides an auto-locked sliding window matching the target reel duration (e.g., 15s, 30s, or 45s), lets creators scrub to the exact hook or musical drop, and features an "Audition Cut" preview player.
3. **Backend FFmpeg Audio Trim Precision**: Updates the backend FFmpeg rendering pipeline (`reel_editor_renderer.py`) so that `music.start_time` and `music.end_time` are strictly honored via `atrim={start}:{end},asetpts=PTS-STARTPTS`, ensuring the rendered video reel starts exactly at the selected audio hook.

---

## 2. User Stories & Core User Flow

### User Story
> *"As a boutique owner or social media manager, I want to choose a trending soundtrack for my photoshoot reel from a Spotify-style catalog, visually pick the exact 15-second chorus or beat drop, and have that cut music seamlessly synchronized into the final generated reel so my Instagram reel catches maximum viewer retention."*

### Step-by-Step User Flow
1. **Upload & Analyze**: User uploads photoshoot videos/images in Pipeline 2 and runs AI analysis.
2. **Explore Spotify Soundtracks**:
   - In Step 2 ("Select Soundtrack"), user switches to the Spotify Music Hub.
   - User searches or filters trending ethnic tracks (e.g., "Ghoomar - Padmaavat", "Kalyani Classical Fusion", "Festive Silk Sitar").
   - Each track displays Spotify album artwork, title, artist, duration, and a quick play/preview button.
3. **Trim & Cut Audio Hook**:
   - Selecting a track opens the **Interactive Waveform Cutter**.
   - The cutter displays a visual audio waveform with a highlighted cut selection window.
   - The window is auto-locked to the chosen target reel duration (e.g., 15.0s).
   - User drags the selection slider across the song to isolate the peak hook (e.g., `00:20.0` to `00:35.0`).
   - High-precision timecodes are displayed in **JetBrains Mono** (`00:20.0 - 00:35.0`).
   - User clicks **"Audition Cut"** to listen exclusively to the selected snippet.
4. **Generate Reel**:
   - User clicks **"Generate Commercial Reel"**.
   - Frontend sends `music.start_time: 20.0` and `music.end_time: 35.0` in the generation plan.
   - Backend FFmpeg trims the audio track from second 20.0 to 35.0 with smooth fade-in/fade-out, rendering the final 9:16 vertical video with the exact cut audio hook.
5. **Preview & Download**:
   - User previews the generated video in the 9:16 mobile player and downloads the broadcast-ready MP4.

---

## 3. Functional Requirements

### 3.1 Spotify Music Catalog & Search
- **Curated Catalog**: Pre-populated library of royalty-cleared ethnic wear & trending Bollywood reel tracks:
  - *Ghoomar (Padmaavat)* - Royal Rajasthani Folk / Dholak (128 kbps)
  - *Kalyani Fusion* - Carnatic Violin & Contemporary Beat
  - *Festive Silk* - Sitar Melodic Celebration
  - *Graceful Heritage* - Shehnai & Ambient Flute
  - *Traditional Elegance* - Tabla & Santoor Classical
- **Spotify Aesthetics**: Spotify green accents (`#1DB954`), dark editorial background (`#121212`, `#181818`), album art thumbnails, artist attribution, and badge ("Powered by Spotify Soundtracks").
- **Live Search & Filter**: Real-time filtering by track name, artist, mood (Festive, Royal, Ambient, High Energy).
- **Import & Custom Upload**: Support for uploading a custom audio file (`.mp3`, `.wav`, `.m4a`) or entering a Spotify link / custom track title.

### 3.2 Interactive Audio Waveform Cutter
- **Visual Waveform Representation**: Renders audio waveform bars with visual amplitude variations.
- **Auto-Locked Duration Window**: When the user selects a target reel duration (e.g. 15s, 30s), the cutter window locks its width to that duration, allowing the user to slide the window along the timeline to find the best musical phrase.
- **Draggable Timeline Scrubber**: Drag handle or scrub bar with start and end markers.
- **Timecode Readouts**: Start time, end time, and duration formatted in monospace **JetBrains Mono** (e.g., `00:15.5 / 00:30.5 [15.0s]`).
- **Hook Preset Buttons**: 1-click jump buttons:
  - `Intro (0:00)`
  - `Drop / Hook (0:15)`
  - `Chorus (0:30)`
- **Audition Player**: Dedicated playback button that starts from `start_time` and halts precisely at `end_time`.

### 3.3 Backend FFmpeg Audio Trimming
- In `backend/app/services/reel_editor_renderer.py`, update `render_final_overlay`:
  - Calculate `start_time = max(0.0, float(music.start_time or 0.0))`.
  - Calculate `end_time = start_time + float(target_duration)`.
  - Update FFmpeg filter from hardcoded `atrim=0:{target_duration:.3f}` to:
    ```
    atrim={start_time:.3f}:{end_time:.3f},asetpts=PTS-STARTPTS,afade=t=in:ss=0:d=0.5,afade=t=out:st={target_duration - 0.75:.3f}:d=0.75
    ```
  - Ensure zero audio-video drift and clean fade-in/fade-out transitions.

---

## 4. Non-Functional & Design Requirements

- **Typography Compliance**:
  - Headings / Labels: Space Grotesk or Sora.
  - Body copy & track descriptions: Inter or IBM Plex Sans.
  - Timecodes, durations, and audio metrics: JetBrains Mono.
- **Performance**:
  - Waveform scrubber must run smoothly at 60 FPS without DOM lag during drag.
  - In-browser audio audition must immediately seek to `start_time` without delay.
- **Reliability & Fallbacks**:
  - If a track cannot be decoded or loaded, fallback cleanly to default audio preview with manual time inputs.
  - If `music.start_time` exceeds track duration, clamp safely to `0.0`.

---

## 5. Acceptance Criteria

1. [ ] User can browse and search curated Spotify-styled tracks in Pipeline 2.
2. [ ] Selecting a track displays the interactive Audio Waveform Cutter with clear timecodes in JetBrains Mono.
3. [ ] User can slide the selection window across the song to choose any start time (e.g., 0:20).
4. [ ] "Audition Cut" button plays only the trimmed segment and stops at the end marker.
5. [ ] Target reel duration changes (15s vs 30s) automatically adjust the cutter window width.
6. [ ] Generating a reel sends `start_time` and `end_time` to the backend.
7. [ ] Backend FFmpeg renders the video with the exact audio cut starting at `start_time`.
8. [ ] `npm run build` passes with 0 TypeScript/lint errors.
9. [ ] Backend unit test validates FFmpeg `atrim` parameters with arbitrary `start_time`.

---

## 6. Out of Scope
- Full OAuth 2.0 user login to personal Spotify accounts (public preview & curated hub meets all boutique workflow requirements without requiring end users to have Spotify Developer accounts).
- Real-time frequency-spectrum stem separation (vocal removal).
