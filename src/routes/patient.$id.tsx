import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/patient/$id")({
  component: PatientLayout,
});

function PatientLayout() {
  return <Outlet />;
}
