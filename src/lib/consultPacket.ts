import { format } from "date-fns";
import type { Patient, TeleConsultRequest } from "./univolt/types";
import { getPriorityFromFusion, priorityMeta } from "./priority";
import type { Strings } from "./translations";

export function buildConsultSharePacket(
  req: TeleConsultRequest,
  patient: Patient | null,
  t: Strings,
): string {
  const caseId = patient?.caseId ?? req.patientId;
  const name = patient?.name ?? "Unknown Patient";
  const ageSex = patient ? `${patient.age}${patient.sex}` : "--";
  const village = patient?.village ?? "--";
  const dateStr = format(req.createdAt, "d MMM yyyy, HH:mm");
  const flag = getPriorityFromFusion(req.triageLevel);
  const pMeta = priorityMeta(flag);

  const v = req.vitals;
  const vitalsLines: string[] = [];
  if (v.hr != null && v.hr > 0) vitalsLines.push(`  • Heart Rate: ${v.hr} bpm (Camera scan)`);
  if (v.rr != null && v.rr > 0) vitalsLines.push(`  • Resp. Rate: ${v.rr} /min (Camera scan)`);
  if (v.spo2 != null)
    vitalsLines.push(
      `  • SpO₂: ${v.spo2}% (${v.cameraSpo2Quality === "manual" ? "Clinic equipment" : "Camera fingertip"})`,
    );
  if (v.bpSystolic != null && v.bpDiastolic != null)
    vitalsLines.push(`  • Blood Pressure: ${v.bpSystolic}/${v.bpDiastolic} mmHg (Clinic equipment)`);
  if (v.temperatureC != null)
    vitalsLines.push(`  • Temperature: ${v.temperatureC} °C (Clinic equipment)`);

  const sxList: string[] = [];
  if (req.symptoms) {
    for (const [k, val] of Object.entries(req.symptoms)) {
      if (val === true) sxList.push(k.replace(/([A-Z])/g, " $1").toLowerCase());
      else if (typeof val === "number" && val > 0) sxList.push(`${k}: ${val} days`);
    }
  }

  const lines: string[] = [
    `=== ${t.consultPacketTitle} ===`,
    `Patient: ${name} (${caseId}) · ${ageSex}, ${village}`,
    `Created: ${dateStr}`,
    `Priority: ${pMeta.labelEn.toUpperCase()} (${req.triageLevel.toUpperCase()})`,
    `Status: ${req.status.toUpperCase()}`,
    "",
    "VITALS RECORDED:",
    ...(vitalsLines.length > 0 ? vitalsLines : ["  • No vitals recorded"]),
    "",
    `SYMPTOMS: ${sxList.length > 0 ? sxList.join(", ") : "None reported"}`,
    `CLINICAL REASONS: ${req.reasons.length > 0 ? req.reasons.join(", ") : "Triage threshold"}`,
    req.notes ? `CLINICIAN NOTE: ${req.notes}` : "",
    "",
    "---",
    t.consultDisclaimer,
  ].filter(Boolean);

  return lines.join("\n");
}
