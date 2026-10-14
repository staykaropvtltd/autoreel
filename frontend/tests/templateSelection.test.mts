import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAnalysisStartPayload, isSameTemplateImage, validateTemplateImage } from "../src/templateSelection.ts";

test("accepts the image formats and size allowed by the template upload flow", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(validateTemplateImage({ type, size: 20 * 1024 * 1024 }), null);
  }
});

test("rejects unsupported, empty, and oversized template images", () => {
  assert.match(validateTemplateImage({ type: "image/gif", size: 100 }) ?? "", /JPG, PNG, or WEBP/);
  assert.match(validateTemplateImage({ type: "image/png", size: 0 }) ?? "", /empty/);
  assert.match(validateTemplateImage({ type: "image/png", size: 20 * 1024 * 1024 + 1 }) ?? "", /20 MB/);
});

test("passes the registered template ID with either uploaded or demo footage", () => {
  assert.deepEqual(buildAnalysisStartPayload("upload-job", "template-123"), {
    job_id: "upload-job",
    template_id: "template-123",
  });
  assert.deepEqual(buildAnalysisStartPayload(null, "template-123"), {
    use_demo: true,
    template_id: "template-123",
  });
  assert.deepEqual(buildAnalysisStartPayload("upload-job", null), { job_id: "upload-job" });
});

test("identifies reselection of the same local file without resetting its uploaded reference", () => {
  const first = { name: "opening.png", type: "image/png", size: 1234, lastModified: 42 };
  assert.equal(isSameTemplateImage(first, { ...first }), true);
  assert.equal(isSameTemplateImage(first, { ...first, lastModified: 43 }), false);
  assert.equal(isSameTemplateImage(first, null), false);
  assert.equal(isSameTemplateImage(null, null), true);
});
