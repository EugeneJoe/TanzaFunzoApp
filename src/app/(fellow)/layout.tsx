import { requireUser } from "@/lib/auth";
import { getCurrentEnrollment } from "@/lib/enrollment";
import { getFellowJourney } from "@/lib/journey";
import { AppSidebar } from "@/components/app-sidebar";

export default async function FellowLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const enrollment = await getCurrentEnrollment(session.userId);
  const journey = enrollment ? await getFellowJourney(enrollment.cohortId) : [];

  return (
    <div className="flex h-screen w-full">
      <AppSidebar variant="learner" journey={journey} userName={session.fullName} />
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}
