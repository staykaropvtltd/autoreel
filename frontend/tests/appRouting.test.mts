import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canRestoreWorkflowRoute,
  hashForScreen,
  parseAppHash,
  safeReturnDestination,
  signInDestinationFor,
} from "../src/appRouting.ts";

test("legacy and slash-prefixed dashboard and Studio hashes resolve as private routes", () => {
  assert.deepEqual(parseAppHash("#dashboard"), { type: "private", destination: "dashboard" });
  assert.deepEqual(parseAppHash("#/dashboard"), { type: "private", destination: "dashboard" });
  assert.deepEqual(parseAppHash("#studio"), { type: "private", destination: "studio" });
});

test("private direct links retain an allowlisted sign-in destination", () => {
  assert.equal(signInDestinationFor(parseAppHash("#dashboard")), "dashboard");
  assert.equal(signInDestinationFor(parseAppHash("#studio")), "studio");
  assert.equal(signInDestinationFor(parseAppHash("#review")), "studio");
  assert.equal(parseAppHash("#/signin?returnTo=%2Fdashboard").type, "auth");
  assert.equal(safeReturnDestination("dashboard"), "dashboard");
  assert.equal(safeReturnDestination("//evil.example"), null);
  assert.equal(safeReturnDestination("editor"), null);
});

test("unknown hashes fail closed and screen transitions produce compatible hashes", () => {
  assert.deepEqual(parseAppHash("#not-a-route"), { type: "unknown" });
  assert.equal(hashForScreen("upload"), "#studio");
  assert.equal(hashForScreen("dashboard"), "#dashboard");
  assert.equal(hashForScreen("landing"), "");
});

test("workflow links restore only when their required in-memory state exists", () => {
  const empty = {
    analysisRunning: false,
    generationRunning: false,
    hasAnalysis: false,
    hasPlan: false,
    hasGeneratedReel: false,
  };
  assert.equal(canRestoreWorkflowRoute("review", empty), false);
  assert.equal(canRestoreWorkflowRoute("plan", empty), false);
  assert.equal(canRestoreWorkflowRoute("editor", empty), false);

  const available = { ...empty, hasAnalysis: true, hasPlan: true, hasGeneratedReel: true };
  assert.equal(canRestoreWorkflowRoute("review", available), true);
  assert.equal(canRestoreWorkflowRoute("plan", available), true);
  assert.equal(canRestoreWorkflowRoute("editor", available), true);
  assert.equal(canRestoreWorkflowRoute("analyzing", { ...empty, analysisRunning: true }), true);
  assert.equal(canRestoreWorkflowRoute("generating", { ...empty, generationRunning: true, hasPlan: true }), true);
});
