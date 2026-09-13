import { createFileRoute } from "@tanstack/react-router";
import { Spo2FingerScanScreen } from "@/screens/Spo2FingerScanScreen";

export const Route = createFileRoute("/spo2")({ component: StandaloneSpo2Route });

function StandaloneSpo2Route() {
  return <Spo2FingerScanScreen />;
}