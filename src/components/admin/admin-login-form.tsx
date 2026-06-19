"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, LogIn } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adminKey }),
    });
    const json = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(json.error ?? "Login failed.");
      return;
    }

    router.push(searchParams.get("next") ?? "/operator");
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-8 max-w-md rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
        <h2 className="font-bold text-zinc-950 dark:text-zinc-50">Operator Login</h2>
      </div>
      <label className="mt-4 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        <span className="mb-1 block">App access key</span>
        <Input
          type="password"
          value={adminKey}
          onChange={(event) => setAdminKey(event.target.value)}
          autoFocus
          autoComplete="current-password"
        />
      </label>
      {error ? (
        <p className="mt-3 rounded-md border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>
      ) : null}
      <Button type="submit" className="mt-4 w-full" disabled={loading || !adminKey}>
        <LogIn className="h-4 w-4" aria-hidden="true" />
        {loading ? "Signing in" : "Sign In"}
      </Button>
    </form>
  );
}
