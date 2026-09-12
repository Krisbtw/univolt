import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { BootScreen } from "@/components/app-shell";
import { useUnivolt } from "@/lib/univolt/store";
import appCss from "../styles.css?url";

// Register service worker once on client — safe for SSR (typeof window guard).
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[SW] registration failed:", err);
      });
    }
  });
}

const APP_NAME = "Univolt";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "Offline field vitals kit — PPG heart rate, estimated respiratory rate, SpO2 screening, and cough heuristic.",
      },
      { name: "theme-color", content: "#145C4C" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const init = useUnivolt((s) => s.init);
  const ready = useUnivolt((s) => s.ready);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>{ready ? <Outlet /> : <BootScreen />}</AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
