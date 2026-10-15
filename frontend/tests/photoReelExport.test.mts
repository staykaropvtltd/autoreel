import assert from "node:assert/strict";
import test from "node:test";

import { photoReelExportStatus } from "../src/photoReelExport.ts";

test("Photo Reel final export uses the free server-rendered editor pipeline", () => {
  assert.equal(photoReelExportStatus.enabled, true);
  assert.match(photoReelExportStatus.reason, /free.*server/i);
});
