import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

/**
 * Limited gesture communication — the honest seed of the sign-language roadmap.
 *
 * Uses MediaPipe's CANNED GestureRecognizer vocabulary (Thumb_Up, Thumb_Down,
 * Closed_Fist, Open_Palm, Pointing_Up, Victory, ILoveYou). This is NOT
 * sign-language recognition: it is a fixed, pretrained gesture set with no
 * training data of our own.
 *
 * Assets are self-hosted from /public so the feature keeps working offline
 * after the first load (see public/sw.js precache list).
 */
const WASM_BASE = "/mediapipe/wasm";
const MODEL_URL = "/models/gesture_recognizer.task";

/** Canned gestures we map to a phrase. Everything else is ignored. */
export type SupportedGesture = "Thumb_Up" | "Thumb_Down" | "Victory" | "Open_Palm";

export const GESTURE_VOCABULARY: SupportedGesture[] = [
  "Thumb_Up",
  "Thumb_Down",
  "Victory",
  "Open_Palm",
];

/** Frames of the same gesture required before we accept it (~0.5 s at 30 fps). */
export const GESTURE_HOLD_FRAMES = 15;

let recognizerPromise: Promise<GestureRecognizer | null> | null = null;

/** Loads the canned MediaPipe gesture recognizer once; resolves null on failure. */
export function loadGestureRecognizer(): Promise<GestureRecognizer | null> {
  if (recognizerPromise === null) {
    recognizerPromise = (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
        return await GestureRecognizer.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: "VIDEO",
          numHands: 1,
        });
      } catch {
        return null; // assets unavailable → caller shows the unavailable state
      }
    })();
  }
  return recognizerPromise;
}

export type GestureFrame = {
  /** Highest-confidence canned gesture name, or null when nothing recognized. */
  gesture: SupportedGesture | null;
  /** Confidence 0–1 of that gesture. */
  score: number;
  /** Extended-finger count from landmarks (0–5), or null when no hand is visible. */
  fingerCount: number | null;
};

function isSupported(name: string): name is SupportedGesture {
  return (GESTURE_VOCABULARY as string[]).includes(name);
}

/**
 * Extended-finger count heuristic: a finger is extended when its tip sits
 * further from the wrist than its PIP joint does. Used for the optional
 * 1–5 pain scale, never for gesture recognition itself.
 */
export function countExtendedFingers(landmarks: NormalizedLandmark[]): number | null {
  if (landmarks.length < 21) return null;
  const wrist = landmarks[0];
  if (!wrist) return null;
  const dist = (p: NormalizedLandmark) => Math.hypot(p.x - wrist.x, p.y - wrist.y);
  // [tip, pip] indices for thumb, index, middle, ring, pinky.
  const pairs: Array<[number, number]> = [
    [4, 2],
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];
  let count = 0;
  for (const [tipIdx, pipIdx] of pairs) {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    if (!tip || !pip) continue;
    if (dist(tip) > dist(pip) * 1.05) count += 1;
  }
  return count;
}

/** Recognize the current video frame. Returns null when the frame was skipped. */
export function recognizeGesture(
  recognizer: GestureRecognizer,
  video: HTMLVideoElement,
  tsMs: number,
): GestureFrame | null {
  try {
    const result = recognizer.recognizeForVideo(video, tsMs);
    const top = result.gestures?.[0]?.[0];
    const landmarks = result.landmarks?.[0] ?? null;
    const name = top?.categoryName ?? "";
    return {
      gesture: isSupported(name) ? name : null,
      score: top?.score ?? 0,
      fingerCount: landmarks ? countExtendedFingers(landmarks) : null,
    };
  } catch {
    return null;
  }
}
