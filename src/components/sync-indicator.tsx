import { CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function SyncIndicator({ className }: { className?: string }) {
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
