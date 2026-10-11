# Fix Log

| ID | status (FIXED / NOT REPRODUCED / BLOCKED) | files:lines changed | verification | new tests added |
|---|---|---|---|---|
| F-33 | NOT REPRODUCED | N/A | grep shows branding.router included once at main.py:47, routes verified | none |
| F-32 | FIXED | backend/app/api/videos.py:64-137 | verified single template route, pytest test_videos_api.py passed (8/8) | none |
| F-34 | FIXED | backend/app/api/reels.py:120 | verified BrandRequest freshly created via default_factory, python assert passed | none |
| F-36 | FIXED | backend/requirements.txt:1-9, backend/requirements-dev.txt:1-3 | verified pinned versions, pillow added, pip check passed | none |
| F-62 | FIXED | frontend/package.json:16 | npm audit --omit=dev shows 0 vulnerabilities, tsc -b passed | none |
| F-61 | FIXED | frontend/src/components/auth/AuthPage.tsx:521 | removed 256-BIT ENCRYPTED claim, tsc -b passed | none |
| F-63 | FIXED | frontend/src/components/UploadScreen.tsx:586 | renamed button label to Analyze footage, tsc -b passed | none |
| F-60 | FIXED | backend/app/api/templates.py:1,102-126, backend/app/api/videos.py:1,31-57 | verified empty folder cleaned up on failure, test_videos_api.py passed (8/8) | none |
| F-40 | FIXED | .gitignore:64-65 | added storage/** and !storage/**/.gitkeep, verified git status | none |
| F-39 | FIXED | backend/app/services/reel_editor_renderer.py:14,370-871, backend/app/services/credit_service.py:11-12,57-65 | 0 grep callers, duplicate end-card code removed, test_reel_editor_renderer.py passed unaffected tests | none |
| F-58 | FIXED | frontend/src/components/dashboard/DashboardScreen.tsx:41-43, ReelImageEditorWorkspace.tsx:14,25,29, PhotoshootUploadsPage.tsx:16,41,249 | 0 references confirmed by grep/oxlint, removed unused imports/params, tsc -b passed | none |
| F-46 | FIXED | frontend/src/components/dashboard/PhotoshootUploadsPage.tsx:727-810, App.tsx:7, ResultScreen.tsx | 0 callers confirmed by grep, deleted dead generate code & ResultScreen.tsx, tsc -b passed | none |
| F-05 | FIXED | backend/app/api/reels.py:181-224 | job_store lookup + is_relative_to verified, test_analysis_api.py passed (5/5) | none |
| F-06 | FIXED | backend/app/services/reel_composer.py:207-224, thumbnail_service.py:50, test_reel_composer.py:135-141 | absolute paths & traversal rejected, safe basename resolution, test_reel_composer.py passed (18/18) | test_resolve_source_path_rejects_path_traversal_and_absolute_paths |
| F-07 | FIXED | backend/app/schemas/reel.py:8-14, app/api/reels.py:111-130, test_reel_composer.py:252-265 | bounds & literals added to request models, color injection test added, test_reel_composer.py passed (20/20) | test_font_config_rejects_injected_color, test_planned_clip_rejects_negative_duration |
| F-11 | FIXED | backend/app/api/templates.py:137 | removed path leak from template upload response, test_videos_api.py passed (8/8) | none |
| F-26 | FIXED | backend/app/api/reels.py:447 | output file generated strictly as <reel_id>.mp4 ignoring client input, prevents collisions | none |
| F-13 | FIXED | backend/app/services/thumbnail_service.py:17-31, api/thumbnails.py:1-18 | cache key incorporates job_id, strict hex regex validation, test_thumbnails_api.py passed (5/5) | none |
| F-08 | FIXED | backend/app/api/music.py:88-195, test_music_api.py:78-88 | uuid file naming in storage/music, ffprobe validation, test_music_api passed | test_upload_music_rejects_non_audio |
| F-09 | FIXED | backend/app/services/brand_service.py:11-45,102-135, api/branding.py:128-142 | thread lock around atomic brand writes, Pillow image verification on upload | none |
| F-12 | FIXED | backend/app/api/videos.py:19-58 | upload quotas (30 files, 1GB total, duplicate filename rejection) added, test_videos_api.py passed | none |
| F-37 | FIXED | backend/app/services/ffmpeg_service.py:50-100 | added encoding='utf-8', errors='replace', protocol_whitelist in ffprobe & ffmpeg | none |
| F-38 | FIXED | backend/app/api/reels.py:546-618, app/services/reel_editor_renderer.py:14,948-968 | replaced prints & traceback with logger, prevented bare re-raise | none |
| F-04 | FIXED | backend/app/api/credits.py:17-86 | deleted /credits/add and /deduct, 0 frontend callers, returns 404 | none |
| F-20 | FIXED | backend/app/services/reel_editor_renderer.py:410-418,504-515,542-546, backend/tests/test_reel_editor_renderer.py:717-760 | removed duplicate -ss flag, honored music.end_time, fixed video mapping without filters, ramp-audio regression test passed | test_render_final_overlay_honors_end_time, test_render_final_overlay_ramp_audio_single_offset |
| F-21 | FIXED | backend/app/services/reel_editor_renderer.py:703,776,838-850 | tracked has_template to insert bumper at index 0 when template is absent, test_compose_reel_with_bumpers passes | none |
| F-23 | FIXED | backend/app/services/reel_editor_renderer.py:892-896,938-955, backend/tests/test_reel_editor_renderer.py:858-950 | overlay shifted by template_actual + intro_actual, logo_windows empty when bumper renders logo, test passed | test_overlay_timing_and_logo_deduplication |


