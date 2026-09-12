import { createFileRoute } from "@tanstack/react-router";
import { VitalsScanScreen } from "@/screens/VitalsScanScreen";

export const Route = createFileRoute("/scan")({ component: ScanRoute });

function ScanRoute() {
    return <VitalsScanScreen />;
}