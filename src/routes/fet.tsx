import { createFileRoute } from "@tanstack/react-router";
import { FetTestScreen } from "../screens/FetTestScreen";

export const Route = createFileRoute("/fet")({ component: FetTestScreen });
