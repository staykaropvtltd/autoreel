# Kaladhar Auto-Reel

## AI-Assisted Product Video Automation Platform

> From raw product footage to a publish-ready 9:16 social media Reel in minutes.

---

## 🚀 Quick Start Guide

You can run this project locally immediately after cloning or extracting the downloaded zip. **No `.env` file or external API keys are required to run the core app!** Default settings and offline demo authentication work out of the box.

### Prerequisites
- **[Node.js](https://nodejs.org/)** (v18 or higher)
- **[Python](https://www.python.org/)** (v3.10 or higher)
- **[FFmpeg](https://ffmpeg.org/download.html)** installed and added to your system `PATH` (required for video processing)

---

### Step 1: Start Backend (FastAPI)
Open a terminal in the project folder:
```bash
cd backend
python -m venv .venv

# On Windows (PowerShell):
.\.venv\Scripts\activate

# On macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Backend API will start at `http://127.0.0.1:8000`.

---

### Step 2: Start Frontend (React + Vite)
Open a **second terminal** in the project folder:
```bash
cd frontend
npm install
npm run dev
```
Frontend will start at `http://localhost:5173`. Open this URL in your browser!

---

### 💡 Environment Variables (`.env`)
- **Backend**: Pre-configured with sensible defaults (`BACKEND_PORT=8000`, `FRONTEND_URL=http://localhost:5173`). No `.env` is needed to run.
- **Frontend**: Real Google OAuth is optional (`VITE_GOOGLE_CLIENT_ID`). If no `.env` is provided, clicking "Continue with Google" or entering any email/password logs in via **Local Demo Mode** seamlessly.
- If you wish to customize ports or configure Google Cloud OAuth, simply copy `.env.example` to `.env` in the respective folders.

---

## 1. Project Overview

Kaladhar Auto-Reel is an AI-assisted video automation platform designed for Kaladhar Heirlooms.

Kaladhar regularly conducts product shoots for:

- Sarees
- Fabrics
- Dress materials
- Ready-made garments
- Other Indian ethnic wear

The current workflow requires the video/content team to manually review raw footage, identify good clips, remove unwanted footage, trim and sequence clips, convert content to 9:16, apply branding, add product information, captions, transitions, audio, and finally render the video.

This creates a significant time-to-publish bottleneck.

For unique and fast-selling products, the product may sell out before the marketing content is ready.

### Our solution

Kaladhar Auto-Reel automates the repetitive parts of the video production workflow.

The system accepts raw product video clips and supporting product information and automatically produces a complete, publish-ready vertical 9:16 video suitable for:

- Instagram Reels
- Facebook Reels
- Instagram Stories
- YouTube Shorts
- Other mobile-first short-form platforms

The system combines:

- Computer Vision
- Video analysis
- AI-assisted content generation
- Automated clip selection
- Subject-aware reframing
- Template-based composition
- FFmpeg video processing

The primary objective is:

> Reduce the time between product shoot completion and publish-ready social media content.

---

# 2. Problem Statement

## Official Business Problem

Kaladhar Business creates a large volume of product video content through regular photo and video shoots.

The current video production workflow involves:

1. Reviewing raw footage
2. Identifying the best clips
3. Removing unwanted footage
4. Removing duplicate footage
5. Trimming clips
6. Arranging clips
7. Adding transitions
8. Applying brand templates
9. Adding product information
10. Adding text and captions
11. Adjusting the video format
12. Preparing the final media file

This manual workflow creates a major bottleneck.

In some cases, by the time the content is edited and ready to publish, the featured product may already be sold out.

Therefore, the business needs a fast automated or AI-assisted workflow that converts raw footage into final publish-ready content.

---

# 3. Core Objective

The core objective of Kaladhar Auto-Reel is:

> Automatically transform raw product video footage into high-quality, publish-ready 9:16 social media content with minimal manual editing.

The system must prioritize:

1. Speed
2. Automation
3. Publish readiness
4. Visual quality
5. Brand consistency
6. Human creative control

---

# 4. Primary Evaluation Criterion

The most important evaluation criterion is:

## SPEED

The system should significantly reduce the time required to convert raw footage into usable social-media content.

The project should therefore measure:

- Total processing time
- Number of input clips
- Number of selected clips
- Number of rejected clips
- Final video duration
- Output resolution
- Output format

Example:

    Raw footage
        |
        v
    Upload
        |
        v
    Automated processing
        |
        v
    Final 9:16 Reel
        |
        v
    Ready to publish

The exact processing time must be measured from the actual implementation.

Do not fabricate performance numbers.

---

# 5. Secondary Evaluation Criterion

The second priority is:

## CONTENT QUALITY

The final video should:

- Use good-quality footage
- Avoid blurry footage
- Avoid unnecessary duplicate shots
- Keep the model/product visible
- Preserve important visual information
- Use appropriate sequencing
- Maintain brand consistency
- Have readable text
- Have appropriate transitions
- Have appropriate audio
- Be correctly formatted for vertical social media

The goal is not cinematic perfection.

The goal is:

> Fast + good quality + brand consistent + publish ready.

---

# 6. Product Vision

## Product Name

Kaladhar Auto-Reel

## Tagline

From raw shoot to ready-to-publish Reel in minutes.

## Alternative Tagline

Shoot once. Automate the edit. Publish faster.

---

# 7. Target Users

### Primary User

Kaladhar Video / Content Team

Responsibilities:

- Upload raw footage
- Enter product information
- Select a visual style
- Generate the Reel
- Review the result
- Make small adjustments
- Export the final video

### Secondary User

Kaladhar Social Media Team

Responsibilities:

- Receive the final publish-ready video
- Preview the video
- Download the video
- Publish to social media

### Optional User

Marketing / Creative Team

Responsibilities:

- Review generated content
- Change template
- Change captions
- Change CTA
- Change selected clips
- Change audio
- Regenerate the video

---

# 8. End-to-End Workflow

The complete intended workflow is:

    USER
      |
      v
    Upload raw video clips
      |
      v
    Enter product information
      |
      v
    Select template/style
      |
      v
    Start generation
      |
      v
    Video preprocessing
      |
      v
    Scene detection
      |
      v
    Video quality analysis
      |
      v
    Subject detection
      |
      v
    Duplicate detection
      |
      v
    Clip scoring
      |
      v
    Best clip selection
      |
      v
    Unwanted clip removal
      |
      v
    Smart 9:16 reframing
      |
      v
    Clip trimming
      |
      v
    Clip sequencing
      |
      v
    Caption/product text generation
      |
      v
    Brand template application
      |
      v
    Logo/text overlays
      |
      v
    Audio/music
      |
      v
    Transitions
      |
      v
    FFmpeg rendering
      |
      v
    Output validation
      |
      v
    Final 9:16 MP4
      |
      v
    Preview
      |
      v
    Human review/edit
      |
      v
    Download
      |
      v
    READY TO PUBLISH

---

# 9. Input

The system accepts multiple raw video clips.

Example:

    clip_01.mp4
    clip_02.mp4
    clip_03.mp4
    clip_04.mp4
    clip_05.mp4

The user also provides product information.

Example:

    Product Name:
    Banarasi Silk Saree

    Category:
    Saree

    Price:
    ₹18,500

    Description:
    Handwoven Banarasi silk saree

    CTA:
    Shop Now

Optional:

    Collection:
    Festive Collection

    Offer:
    10% OFF

---

# 10. Brand Assets

The system should support:

- Kaladhar logo
- Brand name
- Brand colors
- Brand typography
- Brand templates

For the hackathon, brand assets may be stored locally.

Example:

    assets/
        logo/
            kaladhar_logo.png

        music/
            elegant.mp3
            festive.mp3
            traditional.mp3

        templates/
            elegant.json
            minimal.json
            festive.json

---

# 11. Output Requirements

The final output must be:

### Aspect Ratio

9:16

### Recommended Resolution

1080 x 1920

### Video Format

MP4

### Video Codec

H.264

### Audio Codec

AAC when audio is included

### Target Platforms

- Instagram Reels
- Facebook Reels
- Instagram Stories
- YouTube Shorts
- Similar vertical short-form platforms

The output must be directly playable and suitable for social media publishing.

---

# 12. Example Business Scenario

Suppose Kaladhar shoots a new Banarasi silk saree.

Raw footage:

    clip_01.mp4 -> Full model shot
    clip_02.mp4 -> Saree close-up
    clip_03.mp4 -> Walking shot
    clip_04.mp4 -> Blurry footage
    clip_05.mp4 -> Border close-up
    clip_06.mp4 -> Full product shot
    clip_07.mp4 -> Duplicate of clip_06

The system analyzes the footage.

Example result:

    clip_01 -> 89
    clip_02 -> 92
    clip_03 -> 86
    clip_04 -> 31
    clip_05 -> 90
    clip_06 -> 95
    clip_07 -> Duplicate

The system rejects:

    clip_04
    clip_07

The system selects:

    clip_06
    clip_01
    clip_02
    clip_05
    clip_03

The final sequence may be:

    0-3 sec
    Hero product shot

    3-6 sec
    Model shot

    6-9 sec
    Fabric close-up

    9-12 sec
    Border/detail shot

    12-15 sec
    Product + CTA

The system adds:

    KALADHAR

    Banarasi Silk Saree

    ₹18,500

    SHOP NOW

Then renders:

    kaladhar_banarasi_silk_reel.mp4

    Resolution: 1080x1920
    Aspect Ratio: 9:16
    Format: MP4

---

# 13. Functional Requirements

## FR-01: Video Upload

The user must be able to upload multiple raw video clips.

Requirements:

- Drag and drop support preferred
- Multiple file selection
- Display uploaded files
- Display file names
- Display upload status
- Validate supported formats

Supported formats may include:

- MP4
- MOV
- AVI
- WebM

The system should normalize incompatible formats before processing when necessary.

---

## FR-02: Product Information

The user must be able to enter:

- Product name
- Category
- Price
- Description
- CTA

Optional:

- Collection
- Offer
- Additional product details

---

## FR-03: Video Preprocessing

For each video:

- Read metadata
- Determine duration
- Determine resolution
- Determine FPS
- Extract frames
- Normalize input if required

---

## FR-04: Scene Detection

The system should identify meaningful scene/shot boundaries.

Possible implementation:

- PySceneDetect
- Frame difference
- Histogram comparison

The implementation should remain lightweight enough for hackathon execution.

---

## FR-05: Video Quality Analysis

The system should evaluate footage using measurable properties.

Possible metrics:

### Sharpness

Use Laplacian variance.

Low sharpness indicates possible blur.

### Brightness

Detect very dark footage.

### Contrast

Identify poor visual quality.

### Stability

Where practical, detect excessive camera movement.

### Subject Visibility

Determine whether the primary subject is visible.

---

## FR-06: Clip Scoring

Each clip/segment should receive a score.

Example scoring model:

    Final Score =
        25% Sharpness
      + 15% Brightness
      + 15% Stability
      + 25% Subject Visibility
      + 10% Composition
      + 10% Duration Suitability

The exact weights may be adjusted during implementation.

The scoring system must be deterministic and explainable.

---

## FR-07: Bad Clip Removal

Automatically identify and reject:

- Very blurry clips
- Extremely dark clips
- Very short useless clips
- Low-quality footage
- Empty frames
- Unusable footage

The system should provide a reason where possible.

Example:

    clip_04.mp4
    Status: Rejected
    Score: 31
    Reason: Low sharpness

---

## FR-08: Duplicate Detection

The system should identify highly similar/duplicate footage.

Possible approaches:

- Perceptual hashing
- Frame similarity
- Image embeddings

For the hackathon, a lightweight deterministic approach is preferred.

When duplicates exist, keep the higher-quality clip.

---

## FR-09: Best Clip Selection

After analysis:

    RAW CLIPS
       |
       v
    QUALITY ANALYSIS
       |
       v
    BAD CLIP REMOVAL
       |
       v
    DUPLICATE REMOVAL
       |
       v
    RANKING
       |
       v
    BEST CLIPS

The system should select enough clips to create a coherent short-form video.

---

## FR-10: Smart 9:16 Reframing

This is a critical requirement.

Source footage may be:

    1920 x 1080
    16:9

The output must be:

    1080 x 1920
    9:16

The system must not simply center-crop all videos.

The system should attempt to keep:

- Model
- Product
- Important visual details
- Face
- Saree/fabric
- Main subject

visible.

Possible implementation:

- Person detection
- Subject detection
- Bounding boxes
- Dynamic crop positioning
- OpenCV
- MediaPipe
- Lightweight YOLO

---

## FR-11: Clip Trimming

The system should remove unnecessary portions from selected clips.

Example:

    Original:
    15 seconds

    Useful:
    4-11 seconds

    Output:
    7 seconds

The trimming logic should be automated where practical.

---

## FR-12: Clip Sequencing

The system should automatically create a reasonable sequence.

Preferred structure:

    HOOK
      |
      v
    PRODUCT
      |
      v
    DETAIL
      |
      v
    PRODUCT
      |
      v
    CTA

Example:

    Hero shot
       ->
    Model shot
       ->
    Fabric close-up
       ->
    Border/detail
       ->
    Final product shot
       ->
    CTA

---

## FR-13: Brand Template

The system must apply a consistent visual identity.

Initial templates:

1. Elegant
2. Minimal
3. Festive

Each template may define:

- Logo position
- Product text position
- Price position
- CTA position
- Font
- Text animation
- Background treatment
- Color usage

Keep the template system simple and configurable.

---

## FR-14: Product Information Overlay

The system should automatically display relevant information.

Example:

    KALADHAR

    Banarasi Silk Saree

    ₹18,500

    SHOP NOW

Text must remain inside the safe area and must not be cropped.

---

## FR-15: AI Caption Generation

An LLM may be used to generate short marketing copy.

Input:

    Product:
    Banarasi Silk Saree

    Category:
    Traditional Saree

    Style:
    Festive

Possible output:

    "Timeless elegance, woven for every celebration."

The generated copy should be:

- Short
- Brand appropriate
- Marketing focused
- Non-spammy
- Suitable for overlay in a short video

The application should not depend entirely on AI availability.

A deterministic fallback caption must exist.

---

## FR-16: Audio

The system should support optional music.

Initial options:

- Elegant
- Festive
- Traditional
- None

For the hackathon, use local royalty-cleared/demo audio assets.

Do not implement AI music generation unless all core functionality is already complete.

---

## FR-17: Transitions

The system may automatically apply simple transitions:

- Cut
- Fade
- Crossfade

Avoid excessive visual effects.

The result should look premium and suitable for an ethnic-wear brand.

---

## FR-18: Final Rendering

FFmpeg should be responsible for final video composition/rendering.

The final video should contain:

- Selected clips
- 9:16 framing
- Product text
- Branding
- Captions
- Transitions
- Audio when selected

---

## FR-19: Output Validation

Before marking a video as ready:

Check:

- File exists
- File is playable
- MP4
- H.264
- 1080x1920
- 9:16
- Duration > 0
- Audio exists when selected
- FFmpeg completed successfully
- Text is present
- Output file is accessible

Only after successful validation should the UI show:

    READY TO PUBLISH

---

## FR-20: Human Override

The system must allow basic human intervention.

The user should be able to:

- Remove a selected clip
- Add another clip
- Change template
- Change caption
- Change CTA
- Change music
- Regenerate

A full timeline editor is NOT required for the hackathon.

---

# 14. AI vs Automation Strategy

The system should NOT attempt to use AI for every operation.

Use AI/CV for tasks requiring intelligence.

Use deterministic processing for tasks where reliability is more important.

### AI / Computer Vision

    Video analysis
    Clip quality analysis
    Subject detection
    Smart reframing
    Caption generation
    Clip ranking

### Deterministic Automation

    Trimming
    Cropping
    Scaling
    Concatenation
    Text overlay
    Logo overlay
    Audio
    Transitions
    Rendering
    Validation

This approach is intentionally chosen for reliability and speed.

---

# 15. Technology Stack

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Axios
- React Router
- Lucide React

Optional:

- React Dropzone

---

## Backend

- Python
- FastAPI
- Pydantic

---

## Computer Vision

- OpenCV
- PySceneDetect
- MediaPipe or lightweight YOLO

Use the simplest reliable approach.

---

## Video Processing

- FFmpeg

FFmpeg is the primary video composition and rendering engine.

---

## AI

Use a configurable LLM provider for:

- Marketing copy
- Captions
- Optional content suggestions

The system must have fallback text if the AI provider is unavailable.

---

## Database

SQLite

Used only for:

- Job metadata
- Product information
- Processing status
- Output metadata

Do not introduce PostgreSQL unless required.

---

## Storage

Local filesystem for the hackathon.

Structure:

    storage/
        uploads/
        temp/
        outputs/

Do not introduce cloud storage unless the core system is already complete.

---

## Background Processing

FastAPI BackgroundTasks for the hackathon.

Do not introduce Celery/Redis unless required by an actual performance problem.

---

# 16. Architecture

    ┌─────────────────────────────┐
    │        React Frontend       │
    │     TypeScript + Tailwind   │
    └──────────────┬──────────────┘
                   │
                 REST
                   │
                   ▼
    ┌─────────────────────────────┐
    │        FastAPI Backend      │
    └──────────────┬──────────────┘
                   │
                   ▼
    ┌─────────────────────────────┐
    │     Video Processing        │
    │         Pipeline            │
    └──────────────┬──────────────┘
                   │
       ┌───────────┼───────────┐
       │           │           │
       ▼           ▼           ▼
    OpenCV     Scene Detect   Subject Detect
       │           │           │
       └───────────┼───────────┘
                   ▼
             Clip Scoring
                   │
                   ▼
          Best Clip Selection
                   │
                   ▼
          Smart 9:16 Reframing
                   │
                   ▼
           Template Engine
                   │
             ┌─────┴─────┐
             ▼           ▼
            LLM       Brand Assets
             │           │
             └─────┬─────┘
                   ▼
              FFmpeg
                   │
                   ▼
             Final MP4
                   │
                   ▼
              Validation
                   │
                   ▼
                Preview
                   │
                   ▼
               Download

---

# 17. Backend Project Structure

Recommended structure:

    backend/
    │
    ├── app/
    │   ├── main.py
    │   │
    │   ├── api/
    │   │   ├── routes_upload.py
    │   │   ├── routes_jobs.py
    │   │   └── routes_generate.py
    │   │
    │   ├── services/
    │   │   ├── video_analyzer.py
    │   │   ├── scene_detector.py
    │   │   ├── clip_selector.py
    │   │   ├── quality_scorer.py
    │   │   ├── duplicate_detector.py
    │   │   ├── subject_detector.py
    │   │   ├── reframer.py
    │   │   ├── caption_generator.py
    │   │   ├── template_engine.py
    │   │   ├── video_composer.py
    │   │   ├── ffmpeg_service.py
    │   │   ├── validator.py
    │   │   └── pipeline.py
    │   │
    │   ├── models/
    │   │   └── job.py
    │   │
    │   ├── schemas/
    │   │   ├── job.py
    │   │   └── product.py
    │   │
    │   └── core/
    │       ├── config.py
    │       └── logging.py
    │
    ├── templates/
    │   ├── elegant.json
    │   ├── minimal.json
    │   └── festive.json
    │
    ├── assets/
    │   ├── logo/
    │   └── music/
    │
    ├── storage/
    │   ├── uploads/
    │   ├── temp/
    │   └── outputs/
    │
    ├── tests/
    │
    ├── requirements.txt
    └── README.md

---

# 18. Frontend Project Structure

    frontend/
    │
    ├── src/
    │   ├── components/
    │   │   ├── VideoUploader.tsx
    │   │   ├── ProductForm.tsx
    │   │   ├── ProcessingProgress.tsx
    │   │   ├── ClipList.tsx
    │   │   ├── TemplateSelector.tsx
    │   │   ├── VideoPreview.tsx
    │   │   └── ExportPanel.tsx
    │   │
    │   ├── pages/
    │   │   ├── Dashboard.tsx
    │   │   ├── CreateReel.tsx
    │   │   └── Result.tsx
    │   │
    │   ├── services/
    │   │   └── api.ts
    │   │
    │   ├── types/
    │   │   └── index.ts
    │   │
    │   ├── App.tsx
    │   └── main.tsx
    │
    ├── package.json
    └── vite.config.ts

---

# 19. API Design

## Upload

    POST /api/upload

Input:

    multipart/form-data

Response:

    {
      "job_id": "KR1024",
      "files": [
        "clip01.mp4",
        "clip02.mp4"
      ]
    }

---

## Start Generation

    POST /api/jobs/{job_id}/generate

Example request:

    {
      "product_name": "Banarasi Silk Saree",
      "category": "Saree",
      "price": "₹18,500",
      "description": "Handwoven Banarasi silk saree",
      "cta": "Shop Now",
      "template": "elegant",
      "music": "traditional"
    }

---

## Job Status

    GET /api/jobs/{job_id}

Example:

    {
      "job_id": "KR1024",
      "status": "processing",
      "stage": "rendering",
      "progress": 82
    }

---

## Result

    GET /api/jobs/{job_id}/result

Example:

    {
      "status": "completed",
      "video_url": "/outputs/KR1024.mp4",
      "duration": 15.2,
      "resolution": "1080x1920",
      "processing_time": 138
    }

---

# 20. Processing Pipeline

The central pipeline should be implemented as one orchestrated workflow.

Recommended order:

    1. Validate input
    2. Extract video metadata
    3. Detect scenes
    4. Extract representative frames
    5. Analyze quality
    6. Detect subjects
    7. Detect duplicates
    8. Score clips
    9. Remove poor clips
    10. Select best clips
    11. Trim clips
    12. Reframe to 9:16
    13. Sequence clips
    14. Generate marketing copy
    15. Apply template
    16. Add logo
    17. Add product information
    18. Add transitions
    19. Add audio
    20. Render using FFmpeg
    21. Validate output
    22. Store final video
    23. Return result

---

# 21. Job Statuses

The backend should track processing stages.

Possible states:

    UPLOADING
    PREPROCESSING
    ANALYZING
    SELECTING_CLIPS
    REFRAMING
    COMPOSING
    RENDERING
    VALIDATING
    COMPLETED
    FAILED

The frontend should display these stages to the user.

---

# 22. UI Requirements

## Dashboard

Show:

- Project name
- Create Reel button
- Recent jobs
- Processing status
- Completed videos

---

## Create Reel

Show:

- Video upload
- Uploaded clip list
- Product information
- Template selector
- Music selector
- Generate button

---

## Processing

Show:

- Current stage
- Progress
- Completed steps
- Current processing time

Example:

    ✓ Uploaded footage
    ✓ Analyzed 8 clips
    ✓ Removed 2 poor clips
    ✓ Selected 5 best shots
    ✓ Reframed to 9:16
    ✓ Applied branding
    ✓ Added product information
    ● Rendering final video...

---

## Result

Show:

- Video preview
- Resolution
- Aspect ratio
- Duration
- Processing time
- Quality information
- Edit button
- Download button

---

# 23. Human Override UI

The user should be able to modify:

    Selected Clips
    Template
    Caption
    CTA
    Music

Example:

    Selected Clips

    ✓ clip_06
    ✓ clip_01
    ✓ clip_02
    ✓ clip_05

    Template:
    Elegant

    Caption:
    Timeless elegance, woven for every celebration.

    CTA:
    Shop Now

    Music:
    Elegant

    [ Regenerate ]

A complete timeline editor is NOT required.

---

# 24. Error Handling

The system must handle:

- Unsupported video format
- Missing FFmpeg
- Corrupted video
- No usable clips
- AI API failure
- Rendering failure
- Invalid product information
- Output validation failure

If AI generation fails, use a deterministic fallback caption.

If subject detection fails, use center-crop fallback.

If advanced analysis fails, continue with simpler processing whenever possible.

The system should prefer graceful degradation over complete failure.

---

# 25. Performance Principles

The application must prioritize speed.

Avoid:

- Unnecessary AI calls
- Large models when smaller models are sufficient
- Repeated video decoding
- Reprocessing the same clips unnecessarily
- Excessive frame extraction
- Complex infrastructure

Prefer:

- Lightweight analysis
- Representative frame sampling
- Caching
- Parallel processing where safe
- FFmpeg for efficient video operations
- Local processing for the hackathon

---

# 26. Hackathon Scope

This project is being developed for a 12-hour hackathon.

Therefore:

## Must Have

- Multiple video upload
- Video analysis
- Quality scoring
- Best clip selection
- Bad clip removal
- Duplicate detection
- Smart 9:16 conversion
- Clip sequencing
- Brand template
- Product information
- Caption/text
- Audio
- Transitions
- FFmpeg rendering
- Final MP4
- Preview
- Download
- Processing status
- Human override

## Should Have

- AI-generated marketing copy
- Multiple templates
- Quality score
- Processing-time metrics

## Nice to Have

- Advanced scene understanding
- Advanced automatic music selection
- Multiple export presets
- Advanced timeline editing
- Cloud storage
- Social-media publishing
- Analytics

If time becomes limited, all NICE TO HAVE features must be dropped before sacrificing the core pipeline.

---

# 27. Development Priority

The development priority is:

    Priority 1
    RAW VIDEO -> FINAL 9:16 VIDEO

    Priority 2
    AUTOMATIC CLIP SELECTION

    Priority 3
    SMART 9:16 REFRAMING

    Priority 4
    BRANDING + PRODUCT INFORMATION

    Priority 5
    AI COPY GENERATION

    Priority 6
    HUMAN OVERRIDE

    Priority 7
    POLISH / ADVANCED FEATURES

The complete end-to-end pipeline is more important than a beautiful UI.

---

# 28. Development Strategy

The project should be developed phase-by-phase.

Do not attempt to implement everything simultaneously.

Each phase must produce a working result.

### Phase 1

Project foundation and environment.

### Phase 2

Raw video processing.

### Phase 3

Video analysis and clip scoring.

### Phase 4

Best clip selection and duplicate removal.

### Phase 5

9:16 smart reframing.

### Phase 6

Automated video composition.

### Phase 7

AI content generation and branding.

### Phase 8

FastAPI integration.

### Phase 9

React frontend.

### Phase 10

Human override and polish.

### Phase 11

Testing and performance measurement.

### Phase 12

Final demo preparation.

---

# 29. Development Rules

1. Do not over-engineer the system.
2. Do not introduce unnecessary microservices.
3. Do not introduce Kubernetes.
4. Do not introduce Redis unless required.
5. Do not introduce Celery unless required.
6. Do not introduce cloud infrastructure unless required.
7. Do not build a full video editor.
8. Do not train custom AI models.
9. Prefer existing lightweight models and libraries.
10. Prefer deterministic processing where possible.
11. Keep the system locally runnable.
12. Keep configuration in environment variables.
13. Never hard-code API keys.
14. Never commit secrets.
15. Every major feature must be testable independently.
16. Do not break already-working functionality while adding new features.
17. Before adding a new dependency, check whether an existing dependency can solve the problem.
18. Keep the core pipeline working at all times.

---

# 30. AI Coding Agent Instructions

Claude Code and OpenCode may be used to accelerate development.

However, coding agents must follow these rules:

- Read this README before making changes.
- Do not redesign the architecture without a clear reason.
- Do not add unnecessary features.
- Do not replace working components unnecessarily.
- Do not make broad changes when implementing a focused task.
- Test each feature after implementation.
- Preserve existing functionality.
- Explain major architectural changes.
- Prefer small incremental commits/changes.
- Keep the project runnable after each phase.

The coding agent should implement one phase at a time.

---

# 31. Development Environment

Expected environment:

- Windows development machine
- Python 3.11 or compatible version
- Node.js LTS
- npm
- FFmpeg
- Git

Verify:

    python --version
    node --version
    npm --version
    ffmpeg -version
    git --version

---

# 32. Security

Never store API keys directly in source code.

Use:

    .env

Example:

    AI_API_KEY=...
    AI_PROVIDER=...
    BACKEND_URL=...

The `.env` file must be included in `.gitignore`.

---

# 33. Testing Requirements

Every major component should have basic tests.

Test:

- Video metadata extraction
- Quality scoring
- Clip ranking
- Duplicate detection
- 9:16 conversion
- Template rendering
- FFmpeg rendering
- Output validation
- API endpoints

At minimum, the complete end-to-end workflow must be tested before the final demo.

---

# 34. Demo Dataset

For development and demonstration, prepare several raw video clips representing:

- Full product shot
- Model wearing product
- Close-up
- Fabric detail
- Walking shot
- Blurry shot
- Duplicate shot

The demo should clearly show that the system can distinguish useful footage from poor/unnecessary footage.

---

# 35. Demo Scenario

Use one representative Kaladhar product.

Example:

    Product:
    Banarasi Silk Saree

    Price:
    ₹18,500

    Category:
    Saree

    CTA:
    Shop Now

Upload approximately 5-10 raw clips.

Then demonstrate:

    Upload
       ↓
    Analyze
       ↓
    Reject bad footage
       ↓
    Select best clips
       ↓
    Smart crop
       ↓
    Add branding
       ↓
    Add product details
       ↓
    Render
       ↓
    Preview
       ↓
    Download

---

# 36. Final Demo Message

The final product should communicate:

> Kaladhar Auto-Reel reduces the time between product shoot and social-media publication by automating repetitive video-editing tasks while preserving human creative control.

The key business value is:

    Faster time-to-publish
    +
    Consistent brand content
    +
    Reduced manual editing
    +
    Mobile-first 9:16 output
    +
    Publish-ready content

---

# 37. Final Success Criteria

The project is considered successful when:

1. A user can upload raw product videos.
2. The system analyzes the footage.
3. The system identifies usable clips.
4. Poor footage is removed.
5. Duplicate footage is handled.
6. Clips are automatically selected.
7. Clips are converted to 9:16.
8. The subject/product remains visible where possible.
9. Clips are automatically sequenced.
10. Product information is added.
11. Kaladhar branding is applied.
12. Captions/text are added.
13. Audio can be added.
14. Transitions can be added.
15. FFmpeg produces a valid MP4.
16. The final video is 1080x1920 / 9:16.
17. The user can preview it.
18. The user can make basic changes.
19. The user can download it.
20. Actual processing time is displayed/measured.

---

# 38. Core Architecture Principle

The entire system should follow this principle:

    AI decides
       +
    Automation executes
       +
    Human reviews
       =
    Publish-ready content

---

# 39. One-Line Project Definition

> Kaladhar Auto-Reel is an AI-assisted video automation platform that transforms raw ethnic-wear product footage into branded, intelligently reframed, publish-ready 9:16 social media videos with minimal manual editing.

---

# 40. Hackathon Goal

The ultimate goal is NOT to build a generic AI video editor.

The goal is:

> Solve Kaladhar's specific time-to-publish problem.

Every feature should be evaluated against this question:

    "Does this help Kaladhar get from raw product footage
     to publish-ready content faster?"

If the answer is no, it should not be prioritized during the 12-hour hackathon.