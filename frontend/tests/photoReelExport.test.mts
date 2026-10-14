import assert from "node:assert/strict";
import test from "node:test";

import { photoReelExportStatus } from "../src/photoReelExport.ts";

test("Photo Reel final export stays unavailable until server rendering is credit-accounted", () => {
  assert.equal(photoReelExportStatus.enabled, false);
  assert.match(photoReelExportStatus.reason, /credit-accounted server rendering/i);
});
