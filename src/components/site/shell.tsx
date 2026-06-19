import Image from "next/image";
import Link from "next/link";
import { Bot, Boxes, LockKeyhole, ShieldCheck, Trophy, Wallet, Workflow } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { isSimpleLaunchMode } from "@/lib/features";

const fullNav = [
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/operator", label: "Operator", icon: LockKeyhole },
  { href: "/submit", label: "Submit Agent", icon: Bot },
  { href: "/identity", label: "Identity", icon: Wallet },
  { href: "/safety", label: "Safety", icon: ShieldCheck },
];

const simpleNav = [
  { href: "/#platform", label: "Problem", icon: Boxes },
  { href: "/#workflows", label: "Use Cases", icon: Workflow },
  { href: "/#safety", label: "Safety", icon: ShieldCheck },
  { href: "/operator", label: "Operator", icon: LockKeyhole },
];

export function SiteHeader() {
  const nav = isSimpleLaunchMode() ? simpleNav : fullNav;

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image
            src="/agent-arena-logo.gif"
            alt="6529 Agent Arena"
            width={40}
            height={40}
            unoptimized
            className="h-10 w-10 rounded-md object-cover"
            priority
          />
          <span className="truncate text-base font-bold text-zinc-950 dark:text-zinc-50">6529 SwarmOps</span>
        </Link>
        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <ButtonLink key={item.href} href={item.href} variant="quiet" size="sm">
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </ButtonLink>
            ))}
          </nav>
        </div>
      </div>
      <nav className="flex gap-2 overflow-x-auto border-t border-zinc-200 px-4 py-2 dark:border-zinc-800 md:hidden">
        {nav.map((item) => (
          <ButtonLink key={item.href} href={item.href} variant="quiet" size="sm" className="shrink-0">
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </ButtonLink>
        ))}
      </nav>
    </header>
  );
}

export function PageFrame({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>;
}
