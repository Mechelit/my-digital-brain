import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MilaCommandCenter } from "@/components/MilaCommandCenter";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  return (
    <AppShell>
      <MilaCommandCenter />
    </AppShell>
  );
}
