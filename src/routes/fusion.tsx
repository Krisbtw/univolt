import { createFileRoute } from "@tanstack/react-router";
import { FusionScreen } from "../screens/FusionScreen";

export const Route = createFileRoute("/fusion")({ component: FusionScreen });
