import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppFrame, AppHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUnivolt } from "@/lib/univolt/store";
import type { Sex } from "@/lib/univolt/types";

export const Route = createFileRoute("/register")({ component: RegisterScreen });

function RegisterScreen() {
  const addPatient = useUnivolt((s) => s.addPatient);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [village, setVillage] = useState("");
  const [age, setAge] = useState("42");
  const [sex, setSex] = useState<Sex>("F");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAge = Number(age);
    if (!name.trim() || !village.trim() || !Number.isFinite(parsedAge) || parsedAge < 0) return;
    const patient = addPatient({
      name: name.trim(),
      village: village.trim(),
      age: Math.round(parsedAge),
      sex,
    });
    void navigate({ to: "/patient/$id", params: { id: patient.id } });
  }

  return (
    <AppFrame>
      <AppHeader back={{ to: "/" }} title="Register patient" subtitle="Stored only on this device." />
      <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 px-4 pb-8 pt-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Full name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Kavita Joshi" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Village</span>
          <Input value={village} onChange={(e) => setVillage(e.target.value)} required placeholder="e.g. Sikar" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Age</span>
            <Input
              type="number"
              min={0}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
            />
          </label>
          <fieldset className="block">
            <legend className="mb-1.5 text-sm font-medium text-ink">Sex</legend>
            <div className="flex h-11 overflow-hidden rounded-[12px] border border-line bg-paper">
              {(["F", "M", "X"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSex(opt)}
                  className={`flex-1 text-sm font-medium ${
                    sex === opt ? "bg-pine text-pine-fg" : "text-muted hover:bg-surface"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <Button type="submit" size="lg" className="mt-2">
          Save to roster
        </Button>
      </form>
    </AppFrame>
  );
}
