import assert from "node:assert/strict";
import { test } from "node:test";
import { getCreditGate, getExpectedCreditBalance, loadCreditQuote } from "../src/creditAvailability.ts";

test("loads the live balance and cost once from their separate API responses", async () => {
  let balanceCalls = 0;
  let costCalls = 0;
  const quote = await loadCreditQuote(
    async () => { balanceCalls++; return { credits: 27 }; },
    async () => { costCalls++; return { cost: 10 }; },
  );
  assert.deepEqual(quote, { credits: 27, cost: 10 });
  assert.equal(balanceCalls, 1);
  assert.equal(costCalls, 1);
});

test("reports failed and malformed credit API responses", async () => {
  await assert.rejects(loadCreditQuote(
    async () => { throw new Error("balance endpoint unavailable"); },
    async () => ({ cost: 10 }),
  ), /balance endpoint unavailable/);
  await assert.rejects(loadCreditQuote(
    async () => ({ credits: -1 }),
    async () => ({ cost: 10 }),
  ), /invalid credit information/);
});

test("allows generation only when the live balance covers the returned cost", () => {
  assert.equal(getCreditGate(50, 10, false, null).allowed, true);
  assert.equal(getCreditGate(10, 10, false, null).allowed, true);
  assert.equal(getCreditGate(9, 10, false, null).allowed, false);
});

test("blocks generation while loading or after a balance/cost fetch failure", () => {
  assert.equal(getCreditGate(null, null, true, null).allowed, false);
  assert.equal(getCreditGate(null, null, false, "Credits unavailable").allowed, false);
  assert.match(getCreditGate(null, null, false, "Credits unavailable").message ?? "", /unavailable/i);
});

test("shows the remaining balance only when sufficient credits are available", () => {
  assert.equal(getExpectedCreditBalance(50, 10), 40);
  assert.equal(getExpectedCreditBalance(10, 10), 0);
  assert.equal(getExpectedCreditBalance(9, 10), null);
  const gate = getCreditGate(3, 10, false, null);
  assert.match(gate.message ?? "", /requires 10 credits/);
  assert.match(gate.message ?? "", /balance is 3/);
});
