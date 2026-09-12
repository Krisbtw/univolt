import { createFileRoute } from "@tanstack/react-router";
import { ReferralScreen } from "../screens/ReferralScreen";

export const Route = createFileRoute("/referral")({ component: ReferralScreen });
