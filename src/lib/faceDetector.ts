import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

/** Normalized (0–1) face bounding box. */
export interface FaceBox {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface RoiRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Self-hosted MediaPipe assets — served from /public/, work offline after first load. */
const WASM_BASE = "/mediapipe/wasm";
const MODEL_URL = "/models/blaze_face_short_range.tflite";

let detectorPromise: Promise<FaceDetector | null> | null = null;

/** Loads the MediaPipe BlazeFace (short-range) detector once; resolves null on failure. */
export function loadFaceDetector(): Promise<FaceDetector | null> {
    if (detectorPromise === null) {
        detectorPromise = (async () => {
            try {
                const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
                return await FaceDetector.createFromModelPath(fileset, MODEL_URL);
            } catch {
                return null; // model unavailable (first offline load) → caller uses skin-ROI heuristic
            }
        })();
    }
    return detectorPromise;
}

function clamp01(v: number): number {
    return Math.min(1, Math.max(0, v));
}

/** Detect the largest face in the current video frame (normalized coords). */
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
            if (w < 0.05 || h < 0.05) continue; // too small / too far away
            const area = w * h;
            if (area > bestArea) {
                bestArea = area;
                best = { x: clamp01(bb.originX / vw), y: clamp01(bb.originY / vh), w, h };
            }
        }
        return best;
    } catch {
        return null;
    }
}

/** Forehead + left/right cheek ROIs (normalized), avoiding eyes and mouth. */
export function foreheadCheekRoi(box: FaceBox): RoiRect[] {
    return [
        // Forehead band: 10–30 % of face height, inset 20 % from each side.
        { x: box.x + box.w * 0.2, y: box.y + box.h * 0.1, w: box.w * 0.6, h: box.h * 0.2 },
        // Left cheek.
        { x: box.x + box.w * 0.13, y: box.y + box.h * 0.34, w: box.w * 0.25, h: box.h * 0.24 },
        // Right cheek.
        { x: box.x + box.w * 0.62, y: box.y + box.h * 0.34, w: box.w * 0.25, h: box.h * 0.24 },
    ];
}

/**
 * Fallback ROI when the face model is unavailable: YCbCr skin mask over the
 * center crop. Returns [] when no plausible skin region is found.
 */
export function skinRegionRoi(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
): RoiRect[] {
    const x0 = Math.floor(width * 0.2);
    const x1 = Math.floor(width * 0.8);
    const y0 = Math.floor(height * 0.15);
    const y1 = Math.floor(height * 0.85);
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let count = 0;
    let total = 0;
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const cb = 128 - 0.169 * r - 0.331 * g + 0.5 * b;
            const cr = 128 + 0.5 * r - 0.419 * g - 0.081 * b;
            total += 1;
            if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) {
                count += 1;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (count < total * 0.08) return [];
    if (maxX - minX < width * 0.1 || maxY - minY < height * 0.1) return [];
    return [
        {
            x: minX / width,
            y: minY / height,
            w: (maxX - minX) / width,
            h: (maxY - minY) / height,
        },
    ];
}

/** EMA-smoothed face tracker that also reports per-frame motion (normalized units). */
export interface FaceTrackerUpdate {
    box: FaceBox | null;
    motion: number;
}
export function createFaceTracker(): {
    update(box: FaceBox | null): FaceTrackerUpdate;
    reset(): void;
} {
    let cx = 0;
    let cy = 0;
    let w = 0;
    let h = 0;
    let primed = false;
    return {
        update(box) {
            if (box === null) return { box: null, motion: primed ? 1 : 0 };
            const ncx = box.x + box.w / 2;
            const ncy = box.y + box.h / 2;
            if (!primed) {
                cx = ncx;
                cy = ncy;
                w = box.w;
                h = box.h;
                primed = true;
                return { box, motion: 0 };
            }
            const motion = Math.hypot(ncx - cx, ncy - cy);
            const a = 0.35;
            cx += a * (ncx - cx);
            cy += a * (ncy - cy);
            w += a * (box.w - w);
            h += a * (box.h - h);
            return { box: { x: cx - w / 2, y: cy - h / 2, w, h }, motion };
        },
        reset() {
            primed = false;
        },
    };
}