import { createFileRoute } from "@tanstack/react-router";
import { ReferralScreen } from "../screens/ReferralScreen";

export type ReferralSearch = {
  patientId?: string;
};

export const Route = createFileRoute("/referral")({
  validateSearch: (search: Record<string, unknown>): ReferralSearch => {
    return {
      patientId: typeof search.patientId === "string" ? search.patientId : undefined,
    };
  },
  component: ReferralScreen,
});
