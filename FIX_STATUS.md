# AutoReel Code Review — Fix Status Report

Status audit of findings F-01 through F-63 from `AUDIT_REPORT.pdf` against the current codebase (`integrate/friend-fix-audit` branch).

---

## 1. Summary Table

| Severity | FIXED | PARTIAL | NOT FIXED | NOT APPLICABLE | UNVERIFIED | Total |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **CRITICAL** | 1 | 0 | 4 | 0 | 0 | **5** |
| **HIGH** | 11 | 3 | 8 | 0 | 0 | **22** |
| **MEDIUM** | 17 | 4 | 7 | 0 | 0 | **28** |
| **LOW** | 4 | 4 | 0 | 0 | 0 | **8** |
| **TOTAL** | **33** | **11** | **19** | **0** | **0** | **63** |

---

## 2. Full Findings Table

| ID | Severity | Title | Status | Evidence (file:line or grep result) | What remains |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **F-01** | CRITICAL | Fake login, any password works | NOT FIXED | `frontend/src/context/AuthContext.tsx:56,63` (`_password` ignored, `usr_${Date.now()}` generated); `frontend/src/components/auth/AuthPage.tsx:137,146` (`password \|\| "secret123"`) | Real backend authentication with password hashing, session tokens, and removal of client-side user fabrication. |
| **F-02** | CRITICAL | Google sign-in trusts an unverified JWT decoded in browser | NOT FIXED | `frontend/src/services/googleAuth.ts:44-55`; `frontend/src/context/AuthContext.tsx:106` (`parseGoogleJwt` decodes payload without signature/audience check) | Send Google credential to backend, verify signature/audience with Google public keys, create server session. |
| **F-03** | CRITICAL | Backend has no authentication at all | NOT FIXED | `backend/app/api/credits.py:12` & `backend/app/api/reels.py:86` (`DEMO_USER_ID = "user_demo"`); no `Depends(get_current_user)` in routers | Add authentication dependency to all routers; key user assets/credits by verified `user_id`; remove `DEMO_USER_ID`. |
| **F-04** | CRITICAL | Anyone can mint unlimited credits (`/api/credits/add` open) | FIXED | `backend/app/api/credits.py:17-42` (only balance & cost endpoints present; `/credits/add` & `/deduct` removed; live curl returns HTTP 404) | None. Public minting/deducting endpoints completely removed. |
| **F-05** | HIGH | Path traversal via `template_id` | FIXED | `backend/app/api/analysis.py:49` (`template_id: uuid.UUID \| None`); `backend/app/api/reels.py:185,200,207` (strict UUID parse + `is_relative_to`); live curl with `'../../uploads'` rejected (HTTP 422) | None. |
| **F-06** | HIGH | Path traversal / arbitrary-file read via `source_file` | FIXED | `backend/app/services/reel_composer.py:215-235` (`resolve_source_path` rejects `..`, absolute paths, uses basename, asserts `is_relative_to`); verified live | None. |
| **F-07** | HIGH | FFmpeg filter-graph injection through styling fields | FIXED | `backend/app/schemas/story.py:205-360` (hex regex + whitelist for colors, Literals for placements, `Field(ge=, le=)` for numbers, drawtext escaping); verified live | None. |
| **F-08** | HIGH | Shared music library overwrite / unvalidated audio | PARTIAL | `backend/app/api/music.py:90-195` (UUID filenames, stored in `storage/music/`, probed with ffprobe, size capped); but storage is still shared across all visitors | Per-user directory and per-user quota isolation once auth (F-03) is implemented. |
| **F-09** | HIGH | Shared, global branding (`logo.*`/`brand.json`) | PARTIAL | `backend/app/services/brand_service.py:11-45,120-160` (atomic writes under `_brand_lock`, Pillow `Image.open().verify()`, stored in `storage/branding/`); but still global to server | Multi-tenant / per-user branding storage in database or user directory once auth is implemented. |
| **F-10** | HIGH | CORS allows single origin and hard-coded localhost | FIXED | `frontend/src/api.ts:4` (`VITE_API_BASE_URL` used throughout, 0 hardcoded localhost references in `frontend/src/`); `backend/app/main.py:20-35` (CORS allows configured frontend + localhost/127.0.0.1 Vite origins) | None. |
| **F-11** | MEDIUM | Absolute server paths and raw ffmpeg stderr leak | FIXED | `backend/app/schemas/reel.py:33-47` (`output_path` excluded from `ReelGenerateResponse`); `backend/app/api/reels.py:640-675` (generic sanitized errors returned to client) | None. |
| **F-12** | MEDIUM | No upload quotas, no rate limiting, no cleanup | PARTIAL | `backend/app/api/videos.py:21-65` (caps: 30 files, 500MB/file, 1GB total, duplicate filename rejection, cleanup on error); `backend/app/api/music.py:41-55` (rate limit); but no storage TTL cleanup | Automated background TTL cleanup job for orphaned files/jobs; non-blocking file streaming with `aiofiles`. |
| **F-13** | MEDIUM | Thumbnail key collisions and unauthenticated download | PARTIAL | `backend/app/services/thumbnail_service.py:17-31` (key incorporates `job_id`); `backend/app/api/thumbnails.py:17` (strict hex regex validation); but download routes remain unauthenticated | Authentication and access control on thumbnail and reel download endpoints. |
| **F-14** | CRITICAL | No payment system exists | NOT FIXED | Grep shows 0 payment gateways, order persistence, or webhook endpoints in backend | Integrate payment gateway (Razorpay/Stripe), handle webhooks, store orders/invoices, audit credit ledger. |
| **F-15** | HIGH | Credits in-memory only and capped at 50 | NOT FIXED | `backend/app/services/credit_service.py:12,18,22,87` (`_credit_accounts` dict, `MAX_CREDITS = 50`, in-memory lock) | Database persistence (PostgreSQL/SQLite) with transaction ledger; remove hardcoded 50 credit cap or tie to plans. |
| **F-16** | HIGH | Credit charged before render without idempotency | NOT FIXED | `backend/app/api/reels.py:497-505` (`deduct_credits` called synchronously before rendering; no idempotency key) | Asynchronous job creation, credit reservation, idempotency key support, refund on failure/timeout. |
| **F-17** | HIGH | `/reels/generate` is a blocking synchronous render | PARTIAL | `backend/app/services/ffmpeg_service.py:90-105` (added subprocess timeout=600); but `backend/app/api/reels.py:434` is still a synchronous HTTP request thread | Decouple rendering to a background worker/task queue (Celery/RQ/BackgroundTasks) with polling/progress. |
| **F-18** | HIGH | Job state in process memory | NOT FIXED | `backend/app/core/job_store.py:15-19` (`_upload_jobs`, `_analysis_jobs`, `_reel_jobs`, `_template_images` module dicts) | Persistent database/Redis storage for jobs, upload tracking, and generated reel metadata. |
| **F-19** | MEDIUM | Client-side canvas "Photo Reel" exporter bypasses credits | NOT FIXED | `frontend/src/components/dashboard/ReelImageEditorWorkspace.tsx:1052-1175` (`handleExportReel` records canvas stream locally without backend or credits) | Product decision: remove canvas exporter or integrate with backend rendering/credit deduction. |
| **F-20** | HIGH | Music start offset applied twice | FIXED | `backend/app/services/reel_editor_renderer.py:434-455` (removed duplicate `-ss` flag), `538-560` (single `atrim={audio_start}:{audio_end}`, `music.end_time` honored) | None. |
| **F-21** | HIGH | Branded intro bumper inserted after first content clip | FIXED | `backend/app/services/reel_editor_renderer.py:892-908` (ordered explicitly: `[template?] + [intro_bumper?] + content + [outro?]`) | None. |
| **F-22** | HIGH | Final duration wrong (-t cuts end card, outro unbudgeted) | FIXED | `backend/app/services/reel_duration.py`; `backend/app/services/reel_planner.py:143-154`; `backend/app/services/reel_editor_renderer.py:925,1127` (single unified duration model; `-t` matches real concatenated length) | None. |
| **F-23** | HIGH | Overlay timing ignores template; logo shows twice | FIXED | `backend/app/services/reel_editor_renderer.py:957-962` (`total_content_offset = template_actual + intro_actual`), `1005-1025` (logo deduplicated when bumper present) | None. |
| **F-24** | MEDIUM | Zoom transitions zoom toward top-left corner | FIXED | `backend/app/services/reel_composer.py:343-345` (added `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'` centering expressions) | None. |
| **F-25** | MEDIUM | Phone-rotation metadata ignored | FIXED | `backend/app/services/video_metadata.py:19-54` (`_get_rotation` inspects `tags.rotate` & `side_data displaymatrix`; swaps width/height on 90/270 degree rotation) | None. |
| **F-26** | MEDIUM | Output filename collisions and unrestricted extension | FIXED | `backend/app/api/reels.py:489` (output forced to strictly `OUTPUTS_DIR / f"{reel_id}.mp4"`, client filename ignored) | None. |
| **F-27** | MEDIUM | Hard-coded Windows fonts and brand text | FIXED | `backend/app/services/product_end_card.py:34-65,518-522` (cross-platform Linux/macOS/Windows fonts, missing font warnings, configurable `cta_text`) | None. |
| **F-28** | MEDIUM | Hard-coded fake product data stamped onto reel | FIXED | `frontend/src/components/dashboard/PhotoshootUploadsPage.tsx:790-800` (defaults set to empty strings; price parsed with `formatInrPrice`) | None. |
| **F-29** | MEDIUM | Scene analysis quality is heuristic and resolution-dependent | NOT FIXED | `backend/app/services/frame_analyzer.py:86` (unnormalized Laplacian variance on full-res frames; heuristic role classification) | Downscale before scoring, sequential sampling with optical flow, perceptual hashing, and real ML classification. |
| **F-30** | MEDIUM | Analysis job robustness | FIXED | `backend/app/api/analysis.py:76-177` (independent video processing in bounded pool, per-file error capture, job timeout handling) | None. |
| **F-31** | LOW | Planner edge cases | FIXED | `backend/app/services/reel_planner.py:195,438` (enforces `min_clip_duration` in selection and shortfall fillers; unit test passes) | None. |
| **F-32** | HIGH | Duplicate route `/api/templates/upload` | FIXED | `backend/app/api/templates.py:32` (single canonical route; duplicate removed from `videos.py`) | None. |
| **F-33** | MEDIUM | Branding router registered twice | FIXED | `backend/app/main.py:47` (`branding.router` included exactly once) | None. |
| **F-34** | MEDIUM | Mutable default evaluated at import time makes brand stale | FIXED | `backend/app/api/reels.py:124` (`brand: BrandRequest = Field(default_factory=BrandRequest)`) | None. |
| **F-35** | MEDIUM | Endpoint contracts are loose | FIXED | `backend/app/api/reels.py:128-138` (typed models, UUID validation, `target_duration` bounds; live curl <= 0 rejected with 422); `backend/app/api/branding.py:180` (JSON body for placement) | None. |
| **F-36** | MEDIUM | Dependencies unpinned, incomplete and mixed | FIXED | `backend/requirements.txt:1-9` (pinned versions, `pillow==12.2.0` added, headless opencv); `backend/requirements-dev.txt:1-3` (dev dependencies split) | None. |
| **F-37** | MEDIUM | FFmpeg wrapper has no timeouts and text-decodes stderr | FIXED | `backend/app/services/ffmpeg_service.py:45-125` (`timeout=120/600`, `encoding='utf-8'`, `errors='replace'`, `protocol_whitelist`) | None. |
| **F-38** | MEDIUM | Logging and error handling use `print()` and bare re-raise | FIXED | `backend/app/api/reels.py` & `reel_editor_renderer.py` use `logging.getLogger(__name__)`; 0 `print()` calls found | None. |
| **F-39** | LOW | Dead and duplicated code in backend | FIXED | `backend/app/services/reel_editor_renderer.py:24-25,1065-1077` (duplicate end card functions and unused constants deleted) | None. |
| **F-40** | LOW | Stray / generated files committed to repository | PARTIAL | `.gitignore` includes `storage/**`; but `renderer-diff.txt` and ~60 `storage/templates/*` files remain committed in git index | Run `git rm --cached` on committed `storage/templates/` files and delete `renderer-diff.txt`. |
| **F-41** | HIGH | Copyrighted music is bundled in the app | NOT FIXED | `assets/music/` still contains `Ghoomar Padmaavat 128 Kbps.mp3`, `Kalyani - 128k(DJMaza).mp3` and derived hooks | Replace commercial tracks with royalty-free tracks and include license metadata. |
| **F-42** | HIGH | No route protection (#dashboard and #studio open) | NOT FIXED | `frontend/src/App.tsx:300-335` (hash routing sets screen directly with no authentication check) | Adopt route guards or router with authenticated route protection. |
| **F-43** | HIGH | Saved "Previous works" keyed by changing user id | NOT FIXED | `frontend/src/components/dashboard/DashboardScreen.tsx:179` (`kaladhar_reels_${user.id}`); local data lost on each sign-in | Key projects by stable authenticated user ID and store projects server-side. |
| **F-44** | HIGH | Clip selection in review step does not do what it shows | NOT FIXED | `frontend/src/App.tsx:654-659` (matches clips by `source_file` filename rather than unique clip IDs) | Support planning from an explicit list of selected clip IDs end-to-end. |
| **F-45** | HIGH | Analysis polling gives up silently after ~48 s | NOT FIXED | `frontend/src/components/dashboard/PhotoshootUploadsPage.tsx:702-728` (`while (!done && attempts < 40)` loop terminates without error when exceeded) | Poll until terminal status (`completed`/`failed`) with exponential backoff and timeout error notification. |
| **F-46** | MEDIUM | Dead/unreachable code and stale logic in generate flow | FIXED | `frontend/src/components/dashboard/PhotoshootUploadsPage.tsx:720-750` (unreachable code removed); `ResultScreen.tsx` deleted; `listMusic` removed from `App.tsx` | None. |
| **F-47** | MEDIUM | Spotify 'Import link' is a stub | NOT FIXED | `frontend/src/components/dashboard/PhotoshootUploadsPage.tsx:1807-1840` (Import button only clears error; link is never fetched or used) | Remove the non-functional Spotify link import tab or implement a valid music import mechanism. |
| **F-48** | MEDIUM | Template image is uploaded immediately and orphaned | NOT FIXED | `frontend/src/components/UploadScreen.tsx:108-160` (uploads image on selection before form submit; unreferenced by dashboard photoshoot flow) | Upload template with workflow submission or delete on cancellation; wire template selection into photoshoot flow. |
| **F-49** | MEDIUM | Error handling swallows failures (`alert`, `console.log`) | PARTIAL | `console.log` eliminated across `frontend/src/` (0 occurrences); native `alert()` reduced to 2 instances in auth forms | Replace remaining 2 `alert()` calls in `AuthModal.tsx:445` and `AuthPage.tsx:442` with toast notifications. |
| **F-50** | MEDIUM | Credits UI is out of sync and unverified | NOT FIXED | `frontend/src/App.tsx`, `PlanScreen.tsx`, `ReviewScreen.tsx` never fetch or display credit cost/balance before generation | Show credit cost (10 credits) and user balance before generation; disable generate button if insufficient. |
| **F-51** | MEDIUM | Planned total shown to user is not real output length | FIXED | `frontend/src/types.ts:161`; `frontend/src/App.tsx:1271,1309`; `frontend/src/components/PlanScreen.tsx:47-52` (UI displays backend-computed `estimated_final_duration`) | None. |
| **F-52** | LOW | Hard-coded sample data / ethnic-wear assumptions | PARTIAL | Placeholder WhatsApp link removed; but `DashboardScreen.tsx:82-125` still hardcodes sample project fallback reels (`/sample_reel_1.mp4`..`4`) | Remove sample fallback reels or make them optional empty-state templates. |
| **F-53** | MEDIUM | Gigantic components and CSS files | NOT FIXED | `DashboardScreen.tsx` (2,885 lines), `PhotoshootUploadsPage.tsx` (2,032 lines), `ReelImageEditorWorkspace.tsx` (2,546 lines), `Dashboard.css` (6,937 lines) | Refactor monolithic views into focused subcomponents and custom hooks (`useCredits`, `useReelJob`, `useMusic`). |
| **F-54** | MEDIUM | Heavy third-party assets and effects hurt load time | PARTIAL | `frontend/public/favicon.svg` is valid (9.5 KB); but `frontend/index.html:8` loads 5 external font families, and `vite.config.ts` has no code-splitting | Add route code-splitting with `React.lazy`, optimize/self-host fonts, compress public assets. |
| **F-55** | LOW | Accessibility and UX gaps | PARTIAL | `frontend/src/context/ThemeContext.tsx:18-36` (localStorage in try/catch); `AuthPage.tsx:400` (`current-password` vs `new-password`); `useDialogFocus.ts` added; but native alerts and zod validation remain | Add Zod schema form validation, remove native alerts, and audit keyboard accessibility. |
| **F-56** | HIGH | Test suite red and not isolated from real data | FIXED | `backend/tests/test_brand_service.py`, `test_branding_api.py`, `test_reel_branding_config.py` monkeypatch isolated temp dirs; duration tolerances updated | None. |
| **F-57** | MEDIUM | No CI, no containerisation, no env docs parity | NOT FIXED | No `.github/workflows/`, `Dockerfile`, or `docker-compose.yml` exist in the repository | Create GitHub Actions CI workflow, Dockerfile, and docker-compose configuration. |
| **F-58** | LOW | Unused-variable / lint warnings | PARTIAL | Dead code and unused imports pruned; but `oxlint` still reports 38 warnings and 10 errors (unused states, set-state-in-effect, impure Date.now()) | Fix remaining 38 warnings and 10 errors in `DashboardScreen.tsx` and `ReelImageEditorWorkspace.tsx`. |
| **F-59** | HIGH | `GET /api/music` runs ffprobe on every track on every call | FIXED | `backend/app/services/music_service.py:111-127` (`get_cached_audio_info` caches probe by path, size, mtime; live test confirmed 1.85s -> 0.007s) | None. |
| **F-60** | LOW | Rejected uploads leave empty folders behind | FIXED | `backend/app/api/templates.py:101-125` & `backend/app/api/videos.py:71-77` (`shutil.rmtree` cleans up empty/partial job folder on error or empty file) | None. |
| **F-61** | MEDIUM | Login page claims '256-BIT ENCRYPTED' | FIXED | `frontend/src/components/auth/AuthPage.tsx` removed misleading encryption footer (0 occurrences found) | None. |
| **F-62** | MEDIUM | npm audit: axios has 8 advisories | FIXED | `frontend/package.json:16` bumped to `axios: "^1.20.0"`; `npm audit --omit=dev` reports 0 vulnerabilities | None. |
| **F-63** | LOW | Button label "Upload Product Videos (3 files)" | FIXED | `frontend/src/components/UploadScreen.tsx:573` renamed button to "Analyze footage" with dynamic file count | None. |

---

## 3. Remaining Work List

Sorted by severity: **Critical > High > Medium > Low**, with the one-line fix from the report:

### Critical
1. **F-01** (Frontend): Build a real auth backend (e.g. FastAPI + hashed passwords with argon2/bcrypt, or an auth provider such as Firebase/Auth0/Supabase) and remove fake login paths.
2. **F-02** (Frontend + Backend): Send Google ID token to the backend and verify it with Google's public keys (`google-auth` library) before creating a session.
3. **F-03** (Backend): Add an auth dependency (`Depends(get_current_user)`) to all routers, key all assets/credits by user ID, and remove `DEMO_USER_ID`.
4. **F-14** (Frontend + Backend): Integrate a payment gateway (Razorpay/Stripe), store plans/subscriptions/orders, process verified webhooks to grant credits, and add refund/cancellation flows.

### High
5. **F-08** (Backend — Partial): Store user audio per user under `storage/users/<user_id>/music/` and enforce per-user storage quotas once auth is available.
6. **F-09** (Backend — Partial): Make branding configuration and logo storage per-user/multi-tenant once authentication is implemented.
7. **F-15** (Backend): Persist credit balances and a transaction ledger in a database (PostgreSQL/SQLite with row locks) and remove or plan-base the 50 credit cap.
8. **F-16** (Frontend + Backend): Make generation asynchronous: POST returns a reel job ID immediately, with credit reservation and an idempotency key.
9. **F-17** (Backend — Partial): Move video rendering to an asynchronous queue/worker (Celery/RQ/BackgroundTasks) with concurrency limits and progress reporting.
10. **F-18** (Backend): Persist reel, analysis, and upload jobs in a database (or Redis) with TTL; serve downloads from persistent records.
11. **F-41** (Repo/DevOps/Tests): Replace commercial Bollywood film songs in `assets/music/` with properly licensed or royalty-free audio tracks.
12. **F-42** (Frontend): Adopt react-router with protected routes and URL-addressable steps; persist workflow state (job IDs) across refreshes.
13. **F-43** (Frontend): Store user projects/previous works server-side per authenticated user and load them via the API.
14. **F-44** (Frontend + Backend): Add a backend endpoint/parameter that builds the plan from explicit clip IDs the user selected, and key clips by stable clip ID rather than filename.
15. **F-45** (Frontend): Poll analysis job status until a terminal state (`completed` or `failed`) with backoff, clear error handling, and timeout notifications.

### Medium
16. **F-12** (Backend — Partial): Add an automated background TTL cleanup job for `storage/` (uploads/temp/outputs/thumbnails) and stream files with `aiofiles`.
17. **F-13** (Backend — Partial): Require user authentication on thumbnail and reel download endpoints.
18. **F-19** (Frontend): Decide product direction for canvas "Photo Reel" exporter: either remove it or move rendering server-side with credit deduction.
19. **F-29** (Backend): Downscale frames to a fixed width before sharpness scoring, sample sequentially with optical flow, use perceptual hashing, and classify roles with a real model.
20. **F-47** (Frontend): Remove the non-functional Spotify link import tab or implement a legitimate licensed-music flow.
21. **F-48** (Frontend + Backend): Upload template images together with the analyze/generate request or delete on cancellation; wire template selection into photoshoot flow.
22. **F-49** (Frontend — Partial): Replace the remaining two native `alert()` calls in `AuthModal.tsx` and `AuthPage.tsx` with accessible toast notifications.
23. **F-50** (Frontend): Display credit cost (10 credits) and remaining balance before generation; disable generate button or prompt if balance is insufficient.
24. **F-53** (Frontend): Split giant components (`DashboardScreen.tsx`, `PhotoshootUploadsPage.tsx`, `ReelImageEditorWorkspace.tsx`, `Dashboard.css`) into focused modules and custom hooks.
25. **F-54** (Frontend — Partial): Code-split routes with `React.lazy`, self-host or reduce Google font families, and compress public media assets.
26. **F-57** (Repo/DevOps/Tests): Add GitHub Actions CI (pytest + tsc + oxlint + build), Dockerfile with FFmpeg and fonts, and update environment documentation parity.

### Low
27. **F-40** (Repo/DevOps/Tests — Partial): Run `git rm --cached` on committed `storage/templates/*` files, delete leftover `renderer-diff.txt`, and clean up test images in `frontend/public/`.
28. **F-52** (Frontend — Partial): Remove hardcoded fallback projects (`sample_reel_1..4.mp4`) in `DashboardScreen.tsx` so new accounts show an empty state.
29. **F-55** (Frontend — Partial): Add form validation schemas (Zod), replace native alerts, and complete ARIA/keyboard focus management across dashboard custom buttons.
30. **F-58** (Frontend — Partial): Fix the remaining 38 warnings and 10 errors reported by `oxlint` (unused states, set-state-in-effect, impure Date.now() during render).

---

## 4. Needs My Decision (Product / Architecture Decisions)

1. **Authentication & User System (F-01, F-02, F-03, F-42, F-43)**:
   - Choose auth architecture: custom FastAPI JWT with bcrypt/argon2 vs. managed provider (Supabase / Firebase / Auth0 / Clerk).
2. **Payments & Billing Gateway (F-14, F-15)**:
   - Select payment processor (Razorpay for India/INR vs. Stripe for global); define plan pricing, credit pack tiers, and subscription webhook handling.
3. **Database & Persistence Engine (F-15, F-18, F-43)**:
   - Choose database stack (PostgreSQL with SQLAlchemy + Alembic vs. SQLite for MVP) for user accounts, credit balances, job states, and project libraries.
4. **Asynchronous Render Queue & Background Workers (F-16, F-17)**:
   - Choose worker infrastructure: FastAPI `BackgroundTasks` (single-machine process pool) vs. distributed task queue (Celery + Redis / ARQ / RQ).
5. **Bundled Commercial Music (F-41)**:
   - Approve replacement of ripped Bollywood film audio tracks with royalty-free, commercial-use licensed audio tracks.
6. **Client-Side Canvas Exporter (F-19)**:
   - Decide whether to remove the client-side canvas "Photo Reel" exporter entirely from `ReelImageEditorWorkspace.tsx` or migrate it to backend FFmpeg rendering with credit deduction.
7. **Spotify Import Tab (F-47)**:
   - Decide whether to remove the non-functional Spotify link import tab or replace it with a supported custom audio upload / licensed music library.

---

## 5. Possible Regressions & Observations

1. **Tracked Files in Git Index (F-40)**:
   - While `.gitignore` was updated to ignore `storage/**`, existing committed files (`renderer-diff.txt` and over 60 files under `storage/templates/`) were not removed from the git index (`git rm --cached`), meaning they are still being tracked by git.
2. **Dashboard Video Preview / Format Menu Warnings (F-58)**:
   - `DashboardScreen.tsx` has multiple unused menu state variables (`showFormatMenu`, `showAspectMenu`, `showExportMenu`) and React purity violations (`Date.now()` invoked directly during JSX render at line 280), which can cause unstable rendering.
3. **ReelImageEditorWorkspace Audio Hook Dependencies (F-58)**:
   - `useEffect` at `ReelImageEditorWorkspace.tsx:830` does not list `currentTime` in its dependencies, which can lead to stale audio sync or playback drift during canvas preview.
4. **Template Upload in Dashboard vs Studio Flow (F-48)**:
   - Template image upload logic only exists in the legacy `UploadScreen.tsx` flow. The primary dashboard photoshoot flow (`PhotoshootUploadsPage.tsx`) does not wire or pass `template_id`, leaving template video generation disconnected from the dashboard UI.
