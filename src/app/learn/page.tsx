import { requireUser } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

// Stub for Stage 1 verification — Stage 3 replaces this with the real
// journey view (modules -> classes, locked/released states).
export default async function LearnPage() {
  const session = await requireUser();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">Welcome, {session.fullName}</h1>
      <p className="text-muted-foreground">Your journey view lands here in Stage 3.</p>
      <LogoutButton />
    </div>
  );
}
