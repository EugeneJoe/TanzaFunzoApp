import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("admin");

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="font-semibold">
            Tanza Fellowship Hub — Admin
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/admin/curriculum" className="hover:text-foreground">
              Curriculum
            </Link>
            <Link href="/admin/cohorts" className="hover:text-foreground">
              Cohorts
            </Link>
            <Link href="/admin/grading" className="hover:text-foreground">
              Grading
            </Link>
          </nav>
        </div>
        <LogoutButton />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
