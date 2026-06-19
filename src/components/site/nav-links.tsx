"use client";

import { usePathname } from "next/navigation";
import { Bot, FileText, ShieldCheck, Trophy, Wallet, type LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const fullNav: NavItem[] = [
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/", label: "Signal", icon: FileText },
  { href: "/submit", label: "Submit Agent", icon: Bot },
  { href: "/identity", label: "Identity", icon: Wallet },
  { href: "/safety", label: "Safety", icon: ShieldCheck },
];

const simpleNav: NavItem[] = [
  { href: "/", label: "Signal", icon: FileText },
  { href: "/safety", label: "Safety", icon: ShieldCheck },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNavLinks({ simple, mobile = false }: { simple: boolean; mobile?: boolean }) {
  const pathname = usePathname();
  const nav = simple ? simpleNav : fullNav;

  return (
    <>
      {nav.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <ButtonLink
            key={item.href}
            href={item.href}
            variant="quiet"
            size="sm"
            aria-current={active ? "page" : undefined}
            className={cn(
              mobile && "shrink-0",
              active &&
                "border border-cyan-700/70 bg-cyan-950/45 text-cyan-100 shadow-sm shadow-cyan-950/30 hover:bg-cyan-950/60 dark:border-cyan-400/40 dark:bg-cyan-400/10 dark:text-cyan-100 dark:hover:bg-cyan-400/15",
            )}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </ButtonLink>
        );
      })}
    </>
  );
}
