import { requireRole } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin");

  return (
    <div className="flex h-screen w-full">
      <AppSidebar variant="admin" />
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}
