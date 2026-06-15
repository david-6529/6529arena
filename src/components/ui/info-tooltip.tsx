"use client";

import { Info } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type TooltipPosition = {
  left: number;
  top: number;
  placement: "top" | "bottom";
};

export function InfoTooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  function updatePosition() {
    const button = buttonRef.current;

    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const tooltipWidth = Math.min(288, window.innerWidth - 24);
    const halfWidth = tooltipWidth / 2;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2, halfWidth + 12),
      window.innerWidth - halfWidth - 12,
    );
    const shouldOpenAbove = rect.bottom + 156 > window.innerHeight && rect.top > 156;

    setPosition({
      left,
      top: shouldOpenAbove ? rect.top - 8 : rect.bottom + 8,
      placement: shouldOpenAbove ? "top" : "bottom",
    });
  }

  function show() {
    updatePosition();
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={open ? id : undefined}
        onBlur={hide}
        onClick={show}
        onFocus={show}
        onMouseEnter={show}
        onMouseLeave={hide}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-800 focus:bg-zinc-200 focus:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500/30 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus:bg-zinc-800 dark:focus:text-zinc-100"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && position ? (
        <span
          id={id}
          role="tooltip"
          style={{
            left: position.left,
            top: position.top,
            width: "min(18rem, calc(100vw - 1.5rem))",
            transform:
              position.placement === "top"
                ? "translate(-50%, -100%)"
                : "translate(-50%, 0)",
          }}
          className="pointer-events-none fixed z-50 block whitespace-normal rounded-md border border-zinc-200 bg-white p-3 text-left text-xs font-medium normal-case leading-5 text-zinc-700 shadow-xl dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
