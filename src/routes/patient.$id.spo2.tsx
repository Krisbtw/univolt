import { createFileRoute } from "@tanstack/react-router";
import { Spo2FingerScanScreen } from "@/screens/Spo2FingerScanScreen";

export const Route = createFileRoute("/patient/$id/spo2")({
  component: PatientSpo2Route,
});

function PatientSpo2Route() {
  const { id } = Route.useParams();
  return <Spo2FingerScanScreen patientId={id} />;
}