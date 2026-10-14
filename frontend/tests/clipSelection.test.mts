import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPlanMatchesSelection, selectedClipsById } from "../src/clipSelection.ts";

const sameSourceClips = [
  { clip_id: "clip-a", source_file: "same.mp4", start_time: 1, end_time: 3 },
  { clip_id: "clip-b", source_file: "same.mp4", start_time: 5, end_time: 7 },
];

test("selects clips independently when they share one source file", () => {
  assert.deepEqual(selectedClipsById(sameSourceClips, ["clip-a"]), [sameSourceClips[0]]);
  assert.deepEqual(selectedClipsById(sameSourceClips, ["clip-b"]), [sameSourceClips[1]]);
  assert.deepEqual(selectedClipsById(sameSourceClips, ["clip-a", "clip-b"]), sameSourceClips);
});

test("a deselected clip is excluded while a same-file selected clip remains", () => {
  const selected = selectedClipsById(sameSourceClips, ["clip-b"]);
  assert.deepEqual(selected.map((clip) => clip.clip_id), ["clip-b"]);
});

test("only exact selected IDs may proceed to the plan", () => {
  assertPlanMatchesSelection(["clip-a", "clip-b"], [
    { clip_id: "clip-a" },
    { clip_id: "clip-b" },
  ]);
  assert.throws(
    () => assertPlanMatchesSelection(["clip-a"], [{ clip_id: "clip-a" }, { clip_id: "clip-b" }]),
    /every selected clip/,
  );
  assert.throws(() => assertPlanMatchesSelection([], []), /Select at least one clip/);
  assert.throws(
    () => assertPlanMatchesSelection(["clip-a", "clip-a"], [{ clip_id: "clip-a" }]),
    /every selected clip/,
  );
});
