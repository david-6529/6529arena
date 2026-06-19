import Image from "next/image";
import Link from "next/link";
import { SiteNavLinks } from "@/components/site/nav-links";
import { isSimpleLaunchMode } from "@/lib/features";

export function SiteHeader() {
  const simple = isSimpleLaunchMode();

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="The Doom Signal home" className="flex min-w-0 items-center gap-3">
          <Image
            src="/agent-arena-logo.gif"
            alt=""
            width={40}
            height={40}
            unoptimized
            className="h-10 w-10 rounded-md object-cover"
            priority
          />
          <span className="truncate text-base font-bold text-zinc-950 dark:text-zinc-50">DOOMED</span>
        </Link>
        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-1 md:flex">
            <SiteNavLinks simple={simple} />
          </nav>
        </div>
      </div>
      <nav className="flex gap-2 overflow-x-auto border-t border-zinc-200 px-4 py-2 dark:border-zinc-800 md:hidden">
        <SiteNavLinks simple={simple} mobile />
      </nav>
    </header>
  );
}

export function PageFrame({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>;
}
