# Technology Stack: Kaladhar Studio

## 1. System Architecture Overview
Kaladhar is structured as a decoupled client-server monorepo:
- **Frontend SPA**: React 19 + TypeScript + Vite, running on port 5173.
- **Backend API & CV Worker**: Python 3.12 + FastAPI + Uvicorn, running on port 8000.
- **Client Cache**: LocalStorage-driven persistence per user (kaladhar_reels_{userId}) ensuring  recurring database fees.

---

## 2. Frontend Layer

### Core Framework & Tooling
- **React 19** (
eact, 
eact-dom ^19.2.8)
- **TypeScript** (	ypescript ~6.0.2)
- **Vite 8** (ite ^8.2.0, @vitejs/plugin-react ^6.0.4)
- **Styling**: Tailwind CSS v4 (	ailwindcss ^4.3.3, @tailwindcss/vite)
- **Linter**: Oxlint (oxlint ^1.75.0)

### Animation, 3D & UI Libraries
- **Framer Motion & Motion**: motion ^13.1.1, ramer-motion ^13.1.1
- **GSAP**: gsap ^3.15.0 (text and timeline tweening)
- **Three.js & React Three Fiber**: 	hree ^0.185.1, @react-three/fiber ^9.7.0, @react-three/drei ^10.7.8 (3D ethnic fabric simulations)
- **Icons**: Lucide React (lucide-react ^1.37.0)
- **HTTP Client**: Axios (xios ^1.19.0)

---

## 3. Backend Layer

### Server Framework
- **Python 3.12**
- **FastAPI**: Asynchronous REST endpoints, background task workers, streaming responses.
- **Uvicorn**: ASGI web server (uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload).
- **Pydantic v2**: Strict schema validation, typed models, and data transformation.

### Computer Vision & Audio Processing
- **OpenCV (cv2)**: Frame extraction, Laplacian blur scoring, color histogram analysis.
- **PySceneDetect / Scene Detection**: Cut boundary detection and content change estimation.
- **MediaPipe**: Human pose and model face tracking for intelligent 9:16 smart-reframe cropping.
- **Librosa / Essentia**: Audio beat tracking, tempo estimation, and transient detection.

### Video Encoding Pipeline (FFmpeg Gold Standard)
All reels are generated using custom FFmpeg filterchains to adhere to strict Instagram/Shorts ingestion standards:
| Parameter | Gold Standard Value | Architectural Rationale |
| :--- | :--- | :--- |
| **Aspect Ratio** | **9:16 (1080x1920)** | Native vertical mobile format; prevents pillarboxing. |
| **Video Codec** | **H.264 (libx264) High Profile, Level 4.2** | Broadest universal hardware decode support across iOS and Android. |
| **Pixel Format** | **yuv420p (8-bit 4:2:0)** | Critical: prevents black screens on mobile Instagram players. |
| **Frame Rate** | **30 fps CFR (Constant)** | Prevents variable frame rate (VFR) audio de-sync on social ingestion. |
| **Faststart** | **-movflags +faststart** | Relocates moov atom to the beginning for immediate browser streaming. |
| **Audio Codec** | **AAC-LC Stereo, 48 kHz, 192 kbps** | Broadcast-quality social audio. |

---

## 4. Testing & Quality Assurance
- **Backend Tests**: pytest with pytest-asyncio and comprehensive mocks located under ackend/tests/ (25+ test suites covering API, video processor, branding, planner, and composer).
- **Frontend Build Validation**: 
pm run build (	sc -b && vite build) with zero TypeScript errors.
