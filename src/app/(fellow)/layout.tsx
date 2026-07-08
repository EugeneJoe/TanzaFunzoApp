import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export default async function FellowLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/learn" className="font-semibold">
            Tanza Fellowship Hub
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/learn" className="hover:text-foreground">
              My journey
            </Link>
            <Link href="/me" className="hover:text-foreground">
              My coursework
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{session.fullName}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
