import { useEffect, useRef } from "react";

export function WaveformCanvas({
  samplesRef,
  className,
  color = "#9ee0c2",
  grid = "#1b3a31",
  background = "#10221c",
}: {
  samplesRef: { current: number[] };
  className?: string;
  color?: string;
  grid?: string;
  background?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 22) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }
      const data = samplesRef.current;
      if (data.length > 1) {
        let min = Infinity;
        let max = -Infinity;
        for (const v of data) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
        const pad = (max - min) * 0.18 || 0.05;
        min -= pad;
        max += pad;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        const windowed = data.length > 220 ? data.slice(data.length - 220) : data;
        for (let i = 0; i < windowed.length; i++) {
          const x = (i / Math.max(windowed.length - 1, 1)) * w;
          const y = h - ((windowed[i]! - min) / (max - min)) * h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [background, color, grid, samplesRef]);

  return <canvas ref={canvasRef} className={className} />;
}

export function StaticWaveform({
  samples,
  className,
  color = "#145c4c",
}: {
  samples: number[];
  className?: string;
  color?: string;
}) {
  if (samples.length < 2) return <div className={className} />;
  let min = Infinity;
  let max = -Infinity;
  for (const v of samples) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  const w = 320;
  const h = 72;
  const d = samples
    .map((v, i) => {
      const x = (i / (samples.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 8) - 4;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
