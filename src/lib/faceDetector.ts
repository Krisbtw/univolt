import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

export interface FaceBox { x: number; y: number; w: number; h: number; }
export interface RoiRect { x: number; y: number; w: number; h: number; }

const SELF_WASM = "/mediapipe/wasm";
const SELF_MODEL = "/models/blaze_face_short_range.tflite";
const CDN_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const CDN_MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const LOAD_TIMEOUT_MS = 12_000;

export type ModelSource = "self" | "cdn" | "none";
export let lastModelSource: ModelSource = "none";
export let lastModelError: string = "none";

let detectorPromise: Promise<FaceDetector | null> | null = null;

async function tryCreate(wasm: string, model: string): Promise<FaceDetector> {
  const fileset = await FilesetResolver.forVisionTasks(wasm);
  return FaceDetector.createFromModelPath(fileset, model);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("model load timeout")), ms),
    ),
  ]);
}

/** 3-tier load: self-hosted (offline) → CDN (network) → null (skin fallback). Never hangs. */
export function loadFaceDetector(): Promise<FaceDetector | null> {
  if (detectorPromise === null) {
    detectorPromise = (async () => {
      try {
        const d = await withTimeout(tryCreate(SELF_WASM, SELF_MODEL), LOAD_TIMEOUT_MS);
        lastModelSource = "self";
        return d;
      } catch (err) {
        lastModelError = String(err);
        console.warn("[univolt] self-hosted face model failed, trying CDN:", err);
      }
      try {
        const d = await withTimeout(tryCreate(CDN_WASM, CDN_MODEL), LOAD_TIMEOUT_MS);
        lastModelSource = "cdn";
        return d;
      } catch (err) {
        lastModelError = String(err);
        console.warn("[univolt] CDN face model failed, using skin fallback:", err);
        return null;
      }
    })();
  }
  return detectorPromise;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Largest face in the frame, normalized 0–1 coords. Logs errors instead of swallowing. */
export function detectFace(
  detector: FaceDetector,
  video: HTMLVideoElement,
  tsMs: number,
): FaceBox | null {
  try {
    const res = detector.detectForVideo(video, tsMs);
    const detections = res.detections ?? [];
    let best: FaceBox | null = null;
    let bestArea = 0;
    const vw = video.videoWidth || 1;
    const vh = video.videoHeight || 1;
    for (const d of detections) {
      const bb = d.boundingBox;
      if (!bb) continue;
      const w = clamp01(bb.width / vw);
      const h = clamp01(bb.height / vh);
      if (w < 0.05 || h < 0.05) continue;
      const area = w * h;
      if (area > bestArea) {
        bestArea = area;
        best = { x: clamp01(bb.originX / vw), y: clamp01(bb.originY / vh), w, h };
      }
    }
    return best;
  } catch (err) {
    console.warn("[univolt] detectForVideo error:", err);
    return null;
  }
}

/** Forehead + cheeks, avoiding eyes and mouth. */
export function foreheadCheekRoi(box: FaceBox): RoiRect[] {
  return [
    { x: box.x + box.w * 0.2, y: box.y + box.h * 0.1, w: box.w * 0.6, h: box.h * 0.2 },
    { x: box.x + box.w * 0.13, y: box.y + box.h * 0.34, w: box.w * 0.25, h: box.h * 0.24 },
    { x: box.x + box.w * 0.62, y: box.y + box.h * 0.34, w: box.w * 0.25, h: box.h * 0.24 },
  ];
}

/** Loosened skin fallback — works while the model loads AND when it fails. */
export function skinRegionRoi(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): RoiRect[] {
  const x0 = Math.floor(width * 0.15), x1 = Math.floor(width * 0.85);
  const y0 = Math.floor(height * 0.1), y1 = Math.floor(height * 0.9);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let count = 0, total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * width + x) * 4;
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
      const cb = 128 - 0.169 * r - 0.331 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.419 * g - 0.081 * b;
      total += 1;
      if (cb >= 77 && cb <= 130 && cr >= 130 && cr <= 180) {
        count += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (count < total * 0.04) return [];
  if (maxX - minX < width * 0.08 || maxY - minY < height * 0.08) return [];
  return [{ x: minX / width, y: minY / height, w: (maxX - minX) / width, h: (maxY - minY) / height }];
}

/** EMA-smoothed tracker with per-frame motion (normalized units). */
export interface FaceTrackerUpdate { box: FaceBox | null; motion: number; }
export function createFaceTracker(): { update(box: FaceBox | null): FaceTrackerUpdate; reset(): void } {
  let cx = 0, cy = 0, w = 0, h = 0, primed = false;
  return {
    update(box) {
      if (box === null) return { box: null, motion: primed ? 1 : 0 };
      const ncx = box.x + box.w / 2, ncy = box.y + box.h / 2;
      if (!primed) { cx = ncx; cy = ncy; w = box.w; h = box.h; primed = true; return { box, motion: 0 }; }
      const motion = Math.hypot(ncx - cx, ncy - cy);
      const a = 0.35;
      cx += a * (ncx - cx); cy += a * (ncy - cy);
      w += a * (box.w - w); h += a * (box.h - h);
      return { box: { x: cx - w / 2, y: cy - h / 2, w, h }, motion };
    },
    reset() { primed = false; },
  };
}