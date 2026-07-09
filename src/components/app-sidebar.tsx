"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";
import { TRIANGLE_WATERMARK } from "@/lib/brand";
import type { JourneyEntry } from "@/lib/journey";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function groupByModule(entries: JourneyEntry[]) {
  const groups: { module: JourneyEntry["module"]; classes: JourneyEntry[] }[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.module.id === entry.module.id) {
      last.classes.push(entry);
    } else {
      groups.push({ module: entry.module, classes: [entry] });
    }
  }
  return groups;
}

function NavItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-2.5 px-6 py-2.5 font-heading text-sm font-medium transition-colors",
        active ? "bg-[rgba(222,90,28,0.16)] text-white" : "text-[#9FB0C8] hover:text-white"
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", active && "bg-orange")} />
      <span className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-orange" : "bg-current opacity-50")} />
      {label}
    </Link>
  );
}

type LearnerProps = { variant: "learner"; journey: JourneyEntry[]; userName: string };
type AdminProps = { variant: "admin" };

export function AppSidebar(props: LearnerProps | AdminProps) {
  const pathname = usePathname();

  const currentClassId =
    props.variant === "learner" ? pathname.match(/^\/learn\/class\/([^/]+)/)?.[1] : undefined;

  const navItems =
    props.variant === "learner"
      ? [
          { href: "/learn", label: "My journey" },
          { href: "/me", label: "My coursework" },
        ]
      : [
          { href: "/admin/curriculum", label: "Curriculum" },
          { href: "/admin/cohorts", label: "Cohorts" },
          { href: "/admin/grading", label: "Grading" },
        ];

  // The admin shell has no dedicated "Overview" nav entry — /admin (the
  // per-cohort dashboard) is reached via the wordmark and is conceptually
  // part of Cohorts, so both routes light up the same nav item (matches
  // the handoff: 3A and 3B screenshots both show "Cohorts" active).
  function isNavActive(href: string) {
    if (props.variant === "admin" && href === "/admin/cohorts") {
      return pathname === "/admin" || pathname.startsWith("/admin/cohorts");
    }
    return pathname === href;
  }

  const currentModuleGroup =
    props.variant === "learner" && currentClassId
      ? groupByModule(props.journey).find((g) => g.classes.some((c) => c.class.id === currentClassId))
      : undefined;

  return (
    <aside
      className="flex h-full w-[244px] shrink-0 flex-col overflow-y-auto bg-navy bg-[length:90px_78px]"
      style={{ backgroundImage: TRIANGLE_WATERMARK }}
    >
      <div className="px-6 py-7">
        <Link
          href={props.variant === "learner" ? "/learn" : "/admin"}
          className="block font-heading text-sm leading-[1.3] font-semibold tracking-[2px] text-white uppercase"
        >
          Tanza
          <br />
          <span className="text-orange">Fellowship</span>
        </Link>
        {props.variant === "admin" && (
          <p className="mt-1 font-heading text-[11px] tracking-[1.5px] text-[#7C8DA6] uppercase">Admin</p>
        )}
      </div>

      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => (
          <NavItem key={item.href} href={item.href} label={item.label} active={isNavActive(item.href)} />
        ))}
      </nav>

      {currentModuleGroup && (
        <div className="mt-6 flex flex-col gap-2 border-t border-white/10 px-6 pt-6">
          <p className="font-heading text-[11px] tracking-[1.5px] text-[#5E708C] uppercase">
            {currentModuleGroup.module.title}
          </p>
          <div className="flex flex-col gap-1">
            {currentModuleGroup.classes.map((entry, i) => {
              const active = entry.class.id === currentClassId;
              return (
                <Link
                  key={entry.class.id}
                  href={`/learn/class/${entry.class.id}`}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-md py-2 pr-2 pl-3 text-sm transition-colors",
                    active ? "bg-[rgba(222,90,28,0.16)] text-white" : "text-[#9FB0C8] hover:text-white"
                  )}
                >
                  <span className={cn("absolute inset-y-0 left-0 w-[3px] rounded-l", active && "bg-orange")} />
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full font-heading text-[11px] font-semibold",
                      active ? "bg-orange text-white" : "bg-white/10 text-[#9FB0C8]"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="truncate">{entry.class.title}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 border-t border-white/10 px-6 pt-5 pb-6">
        {props.variant === "learner" && (
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange font-heading text-xs font-semibold text-white">
              {initials(props.userName)}
            </span>
            <span className="truncate font-heading text-sm text-white">{props.userName}</span>
          </div>
        )}
        <LogoutButton />
      </div>
    </aside>
  );
}
