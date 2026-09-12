import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { UnivoltMark } from "@/components/mark";
import { SyncIndicator } from "@/components/sync-indicator";
import { cn } from "@/lib/utils";

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-surface shadow-[0_0_0_1px_var(--color-line)]">
        {children}
      </div>
    </div>
  );
}

type BackLink = { to: "/"; params?: never } | { to: "/patient/$id"; params: { id: string } };

export function AppHeader({
  back,
  backLabel = "Back",
  title,
  subtitle,
}: {
  back?: BackLink;
  backLabel?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-surface/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        {back ? (
          <Link
            to={back.to}
            params={back.params}
            className="inline-flex size-11 items-center justify-center rounded-[12px] text-ink hover:bg-paper"
            aria-label={backLabel}
          >
            <ChevronLeft className="size-5" />
          </Link>
        ) : (
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <UnivoltMark />
            <div className="leading-tight">
              <p className="font-display text-[1.15rem] font-semibold tracking-[-0.03em] text-ink">
                Univolt
              </p>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                Field vitals kit
              </p>
            </div>
          </Link>
        )}
        <SyncIndicator />
      </div>
      {title ? (
        <div className={cn(back ? "px-1 pt-1" : "pt-3")}>
          <h1 className="font-display text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] text-ink">
            {title}
          </h1>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
      ) : null}
    </header>
  );
}

export function BootScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <UnivoltMark className="size-12" />
        <p className="font-display text-xl font-semibold tracking-[-0.03em] text-ink">Univolt</p>
        <p className="text-sm text-muted">Loading field roster</p>
      </div>
    </div>
  );
}
