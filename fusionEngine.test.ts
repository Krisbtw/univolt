/**
 * fusionEngine.test.ts — Task 2 acceptance tests.
 * 4 literal cases as specified.
 * Run: npx tsx fusionEngine.test.ts  (or add to your test runner)
 */
import { evaluateFusion, type FusionResult } from "./src/lib/fusionEngine";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function check(name: string, result: FusionResult, expected: string): void {
  assert(result.level === expected, `${name} — expected "${expected}" but got "${result.level}" (signals=${result.signalsUsed}, reasons=[${result.reasons.map(r => r.code).join(",")}])`);
  console.log(`  ✓ ${name} → ${result.level}`);
}

console.log("Running fusionEngine acceptance tests...\n");

// ── Case 1: All-normal → self_care ───────────────────────────────────────────
check(
  "all-normal",
  evaluateFusion({
    rppg: { bpm: 72, rr: 16, hrv: 40, quality: "good" },
    crtSec: 2,
    fetSec: 3,
    symptoms: {},
  }),
  "self_care",
);

// ── Case 2: bpm 130 + crtSec 4 → urgent ──────────────────────────────────────
check(
  "bpm=130 crt=4",
  evaluateFusion({
    rppg: { bpm: 130, rr: 18, hrv: null, quality: "good" },
    crtSec: 4,
    symptoms: {},
  }),
  "urgent",
);

// ── Case 3: fetSec 7 → phc_today ─────────────────────────────────────────────
check(
  "fetSec=7",
  evaluateFusion({
    rppg: { bpm: 80, rr: 14, hrv: 35, quality: "good" },
    fetSec: 7,
    symptoms: {},
  }),
  "phc_today",
);

// ── Case 4: Empty inputs → insufficient_data ──────────────────────────────────
check(
  "empty inputs",
  evaluateFusion({}),
  "insufficient_data",
);

// ── Case 5: spo2 92 → phc_today ──────────────────────────────────────────────
check(
  "spo2=92",
  evaluateFusion({
    rppg: { bpm: 72, rr: 16, hrv: 40, quality: "good" },
    spo2: { value: 92, quality: "good" },
    symptoms: {},
  }),
  "phc_today",
);

// ── Case 6: spo2 89 → urgent ─────────────────────────────────────────────────
check(
  "spo2=89",
  evaluateFusion({
    rppg: { bpm: 72, rr: 16, hrv: 40, quality: "good" },
    spo2: { value: 89, quality: "good" },
    symptoms: {},
  }),
  "urgent",
);

// ── Case 7: spo2 85 with quality reject → ignored (self_care) ────────────────
check(
  "spo2=85 quality=reject",
  evaluateFusion({
    rppg: { bpm: 72, rr: 16, hrv: 40, quality: "good" },
    spo2: { value: 85, quality: "reject" },
    symptoms: {},
  }),
  "self_care",
);

console.log("\nAll acceptance tests passed ✓");
