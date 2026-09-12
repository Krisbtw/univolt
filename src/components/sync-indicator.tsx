import { useEffect, useState } from "react";
import { CloudOff, WifiOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

/** True once a SW controls the current page (offline-ready). */
function useSwControlled(): boolean {
  const [controlled, setControlled] = useState(
    typeof navigator !== "undefined" && !!navigator.serviceWorker?.controller,
  );
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const handler = () => setControlled(!!navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener("controllerchange", handler);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", handler);
  }, []);
  return controlled;
}

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

export function SyncIndicator({ className }: { className?: string }) {
  const online = useOnlineStatus();
  const swReady = useSwControlled();

  if (!online) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border bg-paper px-2.5 py-1 text-[11px] font-semibold",
          "border-warn/40 text-warn",
          className,
        )}
        title="Device is offline — serving from cache"
      >
        <WifiOff className="size-3.5" strokeWidth={1.8} />
        Offline
      </span>
    );
  }

  if (swReady) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border bg-paper px-2.5 py-1 text-[11px] font-medium",
          "border-ok/40 text-ok",
          className,
        )}
        title="Service worker active — app works offline"
      >
        <Wifi className="size-3.5" strokeWidth={1.8} />
        Offline ready
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-muted",
        className,
      )}
      title="All records stay on this device. No network is required."
    >
      <CloudOff className="size-3.5" strokeWidth={1.8} />
      Offline · on device
    </span>
  );
}

export function SavedLocalBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium text-ok", className)}>
      <span className="size-1.5 rounded-full bg-ok" />
      Saved locally
    </span>
  );
}
