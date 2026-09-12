import { createFileRoute } from "@tanstack/react-router";
import { CrtScanScreen } from "../screens/CrtScanScreen";

export const Route = createFileRoute("/crt")({ component: CrtScanScreen });
