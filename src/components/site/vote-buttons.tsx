"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function VoteButtons({
  battleId,
  disabled,
  helper,
}: {
  battleId: string;
  disabled: boolean;
  helper?: string;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function vote(selectedLabel: "A" | "B") {
    setLoading(selectedLabel);
    setMessage("");
    const response = await fetch("/api/vote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ battleId, selectedLabel }),
    });
    const json = await response.json();
    setLoading(null);
    setMessage(response.ok ? `Vote recorded for Option ${selectedLabel}.` : json.error ?? "Vote failed.");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" disabled={disabled || loading !== null} onClick={() => vote("A")}>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Vote A
        </Button>
        <Button type="button" variant="secondary" disabled={disabled || loading !== null} onClick={() => vote("B")}>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Vote B
        </Button>
      </div>
      {message || helper ? (
        <p className="max-w-sm text-sm text-zinc-700 dark:text-zinc-300">
          {message || helper}
        </p>
      ) : null}
    </div>
  );
}
