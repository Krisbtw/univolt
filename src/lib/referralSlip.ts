/**
 * referralSlip.ts — Pure QR referral slip payload builder / decoder.
 * Privacy-by-design: no name, DOB, or location.
 * Payload ≤ 400 bytes using short keys.
 */
import type { FusionInputs, FusionLevel, FusionReason } from "./fusionEngine";

// ── Types ────────────────────────────────────────────────────────────────────

/** Compact payload stored in the QR code. */
export interface SlipPayload {
  /** Schema version. */
  v: 1;
  /** Anonymised session ID (first 8 chars of a UUID). */
  id: string;
  /** Unix timestamp seconds. */
  ts: number;
  age?: number;
  preg?: 1;
  bpm?: number;
  rr?: number;
  crt?: number;
  fet?: number;
  lvl: FusionLevel;
  rsn: string[];
}

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Build a compact JSON payload for the QR slip.
 * Omits null / undefined fields. Rounds floats to 1 decimal place.
 */
export function buildSlipPayload(
  session: FusionInputs,
  fusionLevel: FusionLevel,
  fusionReasons: FusionReason[],
  sessionId: string,
): SlipPayload {
  const payload: SlipPayload = {
    v: 1,
    id: sessionId.slice(0, 8),
    ts: Math.floor(Date.now() / 1000),
    lvl: fusionLevel,
    rsn: fusionReasons.map((r) => r.code),
  };

  if (session.ageYears != null && Number.isFinite(session.ageYears)) {
    payload.age = Math.round(session.ageYears);
  }
  if (session.pregnant === true) payload.preg = 1;

  const bpm = session.rppg?.bpm;
  if (bpm != null && Number.isFinite(bpm)) payload.bpm = Math.round(bpm);

  const rr = session.rppg?.rr;
  if (rr != null && Number.isFinite(rr)) payload.rr = Math.round(rr);

  if (session.crtSec != null && Number.isFinite(session.crtSec)) {
    payload.crt = Math.round(session.crtSec * 10) / 10;
  }
  if (session.fetSec != null && Number.isFinite(session.fetSec)) {
    payload.fet = Math.round(session.fetSec * 10) / 10;
  }

  return payload;
}

// ── Decoder ───────────────────────────────────────────────────────────────────

const VALID_LEVELS: readonly FusionLevel[] = [
  "insufficient_data",
  "self_care",
  "phc_today",
  "urgent",
];

/** Decode and validate a QR payload JSON string. Returns null if malformed. */
export function decodeSlipPayload(json: string): SlipPayload | null {
  try {
    const obj: unknown = JSON.parse(json);
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return null;
    const o = obj as Record<string, unknown>;
    if (o["v"] !== 1) return null;
    if (typeof o["id"] !== "string") return null;
    if (typeof o["ts"] !== "number") return null;
    if (!VALID_LEVELS.includes(o["lvl"] as FusionLevel)) return null;
    if (!Array.isArray(o["rsn"])) return null;

    return {
      v: 1,
      id: o["id"] as string,
      ts: o["ts"] as number,
      lvl: o["lvl"] as FusionLevel,
      rsn: (o["rsn"] as unknown[]).filter((r): r is string => typeof r === "string"),
      age: typeof o["age"] === "number" ? o["age"] : undefined,
      preg: o["preg"] === 1 ? 1 : undefined,
      bpm: typeof o["bpm"] === "number" ? o["bpm"] : undefined,
      rr: typeof o["rr"] === "number" ? o["rr"] : undefined,
      crt: typeof o["crt"] === "number" ? o["crt"] : undefined,
      fet: typeof o["fet"] === "number" ? o["fet"] : undefined,
    };
  } catch {
    return null;
  }
}

/** Estimate byte length of payload (UTF-8 approximation for ASCII JSON). */
export function payloadByteLength(payload: SlipPayload): number {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
}
