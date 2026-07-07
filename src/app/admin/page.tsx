import { requireRole } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

// Stub for Stage 1 verification — Stage 4 replaces this with the real
// cohort dashboard (flags, capability gaps, metric cards).
export default async function AdminPage() {
  const session = await requireRole("admin");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">Welcome, {session.fullName}</h1>
      <p className="text-muted-foreground">The cohort dashboard lands here in Stage 4.</p>
      <LogoutButton />
    </div>
  );
}
