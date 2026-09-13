import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  loadFaceDetector,
  detectFace,
  skinRegionRoi,
  lastModelSource,
  lastModelError,
  lastDetectError,
} from "@/lib/faceDetector";
import type { FaceDetector } from "@mediapipe/tasks-vision";
import { Play, Copy, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/debug")({ component: DebugScreen });

type TestStatus = "idle" | "running" | "pass" | "fail";

interface TestCardState {
  status: TestStatus;
  details: string;
}

export function DebugScreen() {
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const [t1, setT1] = useState<TestCardState>({
    status: "idle",
    details: "Pending test run.",
  });
  const [t2, setT2] = useState<TestCardState>({
    status: "idle",
    details: "Pending test run.",
  });
  const [t3, setT3] = useState<TestCardState>({
    status: "idle",
    details: "Pending test run.",
  });
  const [t4, setT4] = useState<TestCardState>({
    status: "idle",
    details: "Pending test run.",
  });
  const [t5, setT5] = useState<TestCardState>({
    status: "idle",
    details: "Pending test run.",
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<FaceDetector | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  async function runAllTests() {
    if (isRunning) return;
    setIsRunning(true);
    setCopied(false);

    // Reset all
    setT1({ status: "running", details: "Checking camera environment..." });
    setT2({ status: "idle", details: "Waiting..." });
    setT3({ status: "idle", details: "Waiting..." });
    setT4({ status: "idle", details: "Waiting..." });
    setT5({ status: "idle", details: "Waiting..." });

    let videoEl = videoRef.current;
    let cameraSuccess = false;

    // ─────────────────────────────    // ─────────────────────────────────────────────────────────────
    // TEST 1 — Camera
    // ─────────────────────────────────────────────────────────────
    try {
      const isHttps =
        window.location.protocol === "https:" ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      const hasMediaDevices = Boolean(navigator.mediaDevices?.getUserMedia);

      let log = `location.protocol: ${window.location.protocol} (${isHttps ? "PASS" : "FAIL: must be https:"})\n`;
      log += `navigator.mediaDevices: ${hasMediaDevices ? "PASS (exists)" : "FAIL (missing)"}\n`;

      if (!hasMediaDevices) {
        throw new Error("navigator.mediaDevices.getUserMedia is unsupported in this environment.");
      }

      log += "getUserMedia({ video: { facingMode: 'user' } })...\n";
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        log += "stream: obtained\n";
      } catch (err) {
        log += `Direct user facingMode failed (${err}), trying fallback { video: true }...\n`;
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        log += "stream: obtained (fallback)\n";
      }

      streamRef.current = stream;
      if (!videoEl) {
        videoEl = videoRef.current;
        if (!videoEl) {
          videoEl = document.createElement("video");
        }
      }
      videoEl.srcObject = stream;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.autoplay = true;
      await videoEl.play();
      log += "video.play(): ok\n";

      await new Promise((r) => setTimeout(r, 2000));

      const w = videoEl.videoWidth || 0;
      const h = videoEl.videoHeight || 0;
      log += `videoWidth×videoHeight (after 2s): ${w}×${h}\n`;

      if (w > 0 && h > 0) {
        cameraSuccess = true;
        setT1({
          status: "pass",
          details: log + `Result: PASS (stream active, non-zero dimensions)`,
        });
      } else {
        setT1({
          status: "fail",
          details: log + `Result: FAIL (video dimensions remained 0×0 after 2s)`,
        });
      }
    } catch (err) {
      setT1({
        status: "fail",
        details: `Camera test failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 2 — Static Model Files
    // ─────────────────────────────────────────────────────────────
    setT2({ status: "running", details: "HEAD-requesting /models and /mediapipe assets..." });
    let staticSuccess = false;
    try {
      let tfliteStatus = 0;
      let tfliteType = "";
      let wasmStatus = 0;
      let wasmType = "";

      try {
        const r1 = await fetch("/models/blaze_face_short_range.tflite", { method: "HEAD" });
        tfliteStatus = r1.status;
        tfliteType = r1.headers.get("content-type") || "none";
      } catch (e1) {
        tfliteType = `Fetch error: ${e1}`;
      }

      try {
        const r2 = await fetch("/mediapipe/wasm/vision_wasm_internal.js", { method: "HEAD" });
        wasmStatus = r2.status;
        wasmType = r2.headers.get("content-type") || "none";
      } catch (e2) {
        wasmType = `Fetch error: ${e2}`;
      }

      const log =
        `/models/blaze_face_short_range.tflite: status=${tfliteStatus}, content-type=${tfliteType}\n` +
        `/mediapipe/wasm/vision_wasm_internal.js: status=${wasmStatus}, content-type=${wasmType}\n`;

      const tfliteOk = tfliteStatus === 200 && !tfliteType.includes("text/html");
      const wasmOk = wasmStatus === 200 && !wasmType.includes("text/html");

      if (tfliteOk && wasmOk) {
        staticSuccess = true;
        setT2({
          status: "pass",
          details: log + "Result: PASS (200 OK, non-html)",
        });
      } else {
        setT2({
          status: "fail",
          details:
            log +
            "Result: FAIL (expected 200 OK with static assets, got 404 or text/html fallback)",
        });
      }
    } catch (err) {
      setT2({
        status: "fail",
        details: `Static file check error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 3 — Model Load
    // ─────────────────────────────────────────────────────────────
    setT3({ status: "running", details: "Calling loadFaceDetector() (15s timeout)..." });
    let detector: FaceDetector | null = null;
    try {
      const loadPromise = loadFaceDetector();
      const timeoutPromise = new Promise<FaceDetector | null>((_, reject) =>
        setTimeout(() => reject(new Error("Model load exceeded 15s timeout")), 15000),
      );

      detector = await Promise.race([loadPromise, timeoutPromise]);
      detectorRef.current = detector;

      if (detector !== null) {
        setT3({
          status: "pass",
          details:
            `Tier succeeded: ${lastModelSource} (PASS)\n` +
            (lastModelError !== "none" ? `Previous tier error: ${lastModelError.slice(0, 200)}\n` : "") +
            `Model load: Success (ready for detection)`,
        });
      } else {
        setT3({
          status: "fail",
          details:
            `Tier: ${lastModelSource} (FAIL - returned null)\n` +
            `Error: ${lastModelError.slice(0, 200)}`,
        });
      }
    } catch (err) {
      const errStr = err instanceof Error ? err.message : String(err);
      setT3({
        status: "fail",
        details: `loadFaceDetector threw: ${errStr.slice(0, 200)}`,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 4 — Live Detection (10 seconds)
    // ─────────────────────────────────────────────────────────────
    setT4({ status: "running", details: "Starting 10-second live detection loop..." });
    if (!cameraSuccess || !videoEl) {
      setT4({
        status: "fail",
        details: "Skipped: Camera is not running (Test 1 did not pass).",
      });
    } else if (!detector) {
      setT4({
        status: "fail",
        details: `Skipped: Face detector model failed to load (Test 3: ${lastModelError.slice(0, 100)}).`,
      });
    } else {
      let framesProcessed = 0;
      let totalFacesDetected = 0;
      let detectErrText: string | null = null;
      const startTime = performance.now();
      const runDurationMs = 10_000;

      await new Promise<void>((resolve) => {
        let lastUiUpdate = 0;

        function loop(now: number) {
          const elapsed = now - startTime;
          if (elapsed >= runDurationMs) {
            resolve();
            return;
          }

          if (videoEl && videoEl.readyState >= 2) {
            framesProcessed++;
            try {
              const box = detectFace(detector!, videoEl, Math.max(1, Math.round(now)));
              if (box !== null) {
                totalFacesDetected++;
              }
              if (lastDetectError) {
                detectErrText = lastDetectError;
              }
            } catch (dErr) {
              detectErrText = String(dErr);
            }
          }

          if (now - lastUiUpdate > 300) {
            lastUiUpdate = now;
            const remSec = Math.max(0, (runDurationMs - elapsed) / 1000).toFixed(1);
            setT4({
              status: "running",
              details:
                `Running live detection... (${remSec}s remaining)\n` +
                `Frames processed: ${framesProcessed}\n` +
                `Faces detected: ${totalFacesDetected}\n` +
                `Faces/second: ${(totalFacesDetected / (Math.max(1, elapsed) / 1000)).toFixed(1)}` +
                (detectErrText ? `\ndetectForVideo error: ${detectErrText}` : ""),
            });
          }

          requestAnimationFrame(loop);
        }

        requestAnimationFrame(loop);
      });

      const facesPerSec = (totalFacesDetected / 10).toFixed(1);
      const passed = totalFacesDetected > 0 && !detectErrText;
      setT4({
        status: passed ? "pass" : "fail",
        details:
          `Frames processed: ${framesProcessed}\n` +
          `Total faces detected: ${totalFacesDetected}\n` +
          `Faces/second: ${facesPerSec}\n` +
          `detectForVideo error: ${detectErrText ?? "none"}\n` +
          `Result: ${passed ? "PASS (active face tracking)" : totalFacesDetected === 0 ? "FAIL (0 faces detected in 10s)" : "FAIL (detectForVideo error)"}`,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 5 — Skin Fallback
    // ─────────────────────────────────────────────────────────────
    setT5({ status: "running", details: "Evaluating skinRegionRoi on current frame..." });
    if (!videoEl || videoEl.videoWidth === 0) {
      setT5({
        status: "fail",
        details: "Skipped: Camera frame is not available.",
      });
    } else {
      try {
        const procW = 160;
        const procH = 120;
        const canvas = document.createElement("canvas");
        canvas.width = procW;
        canvas.height = procH;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          throw new Error("Could not create 2D canvas context.");
        }
        ctx.drawImage(videoEl, 0, 0, procW, procH);
        const pixels = ctx.getImageData(0, 0, procW, procH).data;
        const rois = skinRegionRoi(pixels, procW, procH);

        if (rois.length > 0) {
          const r = rois[0];
          const sizeStr = `${(r.w * 100).toFixed(1)}% × ${(r.h * 100).toFixed(1)}%`;
          setT5({
            status: "pass",
            details:
              `Skin ROI found: Yes (PASS)\n` +
              `ROI size: ${sizeStr} (at x=${(r.x * 100).toFixed(1)}%, y=${(r.y * 100).toFixed(1)}%)\n` +
              `Result: PASS (Skin fallback operational)`,
          });
        } else {
          setT5({
            status: "fail",
            details:
              `Skin ROI found: No (FAIL)\n` +
              `ROI size: None\n` +
              `Result: FAIL (<4% skin pixels detected under current lighting)`,
          });
        }
      } catch (err) {
        setT5({
          status: "fail",
          details: `skinRegionRoi evaluation error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    setIsRunning(false);
  }

  function copyReport() {
    const text = [
      `=== UniCare Face rPPG Diagnostic Report ===`,
      `Date: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
      `User-Agent: ${navigator.userAgent}`,
      ``,
      `[Test 1 — Camera]: ${t1.status.toUpperCase()}`,
      t1.details,
      ``,
      `[Test 2 — Static Model Files]: ${t2.status.toUpperCase()}`,
      t2.details,
      ``,
      `[Test 3 — Model Load]: ${t3.status.toUpperCase()}`,
      t3.details,
      ``,
      `[Test 4 — Live Detection]: ${t4.status.toUpperCase()}`,
      t4.details,
      ``,
      `[Test 5 — Skin Fallback]: ${t5.status.toUpperCase()}`,
      t5.details,
      `==========================================`,
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  return (
    <AppFrame>
      <AppHeader back={{ to: "/" }} title="System Diagnostics" subtitle="Face rPPG Chain Audit" />
      <main className="flex flex-1 flex-col gap-4 px-4 pb-12 pt-3">
        {/* Intro */}
        <div className="rounded-[20px] border border-line bg-paper p-4 shadow-xs">
          <h2 className="text-sm font-semibold text-ink">5-Point Diagnostic Suite</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Audits browser camera support, Vercel static asset emission, MediaPipe vision WASM / TFLite
            loading, live per-frame face detection, and skin-tone fallback.
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              id="btn-run-diagnostics"
              size="lg"
              className="flex-1 gap-2 bg-pine text-white hover:bg-pine/90"
              disabled={isRunning}
              onClick={runAllTests}
            >
              {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {isRunning ? "Running tests…" : "Run tests"}
            </Button>
          </div>
        </div>

        {/* Live Camera Viewfinder for Verification */}
        <div className="relative overflow-hidden rounded-[20px] border border-line bg-black p-2">
          <p className="mb-1 text-center text-[10px] uppercase tracking-wider text-zinc-400">
            Live Test Viewfinder
          </p>
          <video
            ref={videoRef}
            className="h-44 w-full rounded-[14px] bg-zinc-900 object-cover [transform:scaleX(-1)]"
            autoPlay
            playsInline
            muted
          />
        </div>

        {/* Test Cards */}
        <div className="flex flex-col gap-3">
          <DiagnosticCard title="Test 1 — Camera" state={t1} />
          <DiagnosticCard title="Test 2 — Static model files" state={t2} />
          <DiagnosticCard title="Test 3 — Model load" state={t3} />
          <DiagnosticCard title="Test 4 — Live detection (10s)" state={t4} />
          <DiagnosticCard title="Test 5 — Skin fallback" state={t5} />
        </div>

        {/* Copy Report */}
        <div className="mt-2">
          <Button
            id="btn-copy-report"
            variant="outline"
            size="lg"
            className="w-full gap-2 border-line bg-paper text-ink hover:bg-surface"
            onClick={copyReport}
          >
            <Copy className="size-4" />
            {copied ? "Copied report to clipboard!" : "Copy report"}
          </Button>
        </div>
      </main>
    </AppFrame>
  );
}

function DiagnosticCard({ title, state }: { title: string; state: TestCardState }) {
  const { status, details } = state;

  return (
    <div className="rounded-[18px] border border-line bg-paper p-3.5 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-ink">{title}</h3>
        {status === "pass" ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
            <CheckCircle2 className="size-3.5" /> PASS
          </span>
        ) : status === "fail" ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
            <XCircle className="size-3.5" /> FAIL
          </span>
        ) : status === "running" ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
            <Loader2 className="size-3.5 animate-spin" /> RUNNING
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            PENDING
          </span>
        )}
      </div>
      <div className="mt-2.5 rounded-[10px] bg-surface/80 p-2.5 font-mono text-[11px] leading-relaxed text-ink/80 whitespace-pre-wrap break-words border border-line/50">
        {details}
      </div>
    </div>
  );
}
