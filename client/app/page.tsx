import { DashboardOverview } from "@/components/dashboard-overview";
import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <AppShell>
      <DashboardOverview />
    </AppShell>
  );
}
