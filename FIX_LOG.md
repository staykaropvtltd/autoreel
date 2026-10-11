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


