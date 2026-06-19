"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LogOut, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

type Identity = {
  id: string;
  wallet: string;
  handle: string | null;
  displayName: string | null;
  source: string;
  repScore?: number | null;
};

type State = {
  loading?: "me" | "connect" | "sign" | "logout";
  error?: string;
  message?: string;
  identity?: Identity | null;
};

function errorMessage(payload: { error?: string; errorId?: string }) {
  return payload.errorId ? `${payload.error ?? "Request failed."} (${payload.errorId})` : payload.error ?? "Request failed.";
}

function shortWallet(wallet: string) {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

export function WalletLinker() {
  const [handle, setHandle] = useState("");
  const [state, setState] = useState<State>({ loading: "me" });

  useEffect(() => {
    let mounted = true;

    async function loadIdentity() {
      try {
        const response = await fetch("/api/identity/me");
        const payload = await response.json();

        if (mounted) {
          setState({ identity: payload.identity });
          setHandle(payload.identity?.handle ?? "");
        }
      } catch {
        if (mounted) {
          setState({ identity: null });
        }
      }
    }

    void loadIdentity();

    return () => {
      mounted = false;
    };
  }, []);

  async function connectAndSign() {
    if (!window.ethereum) {
      setState({
        identity: state.identity,
        error: "No wallet was found. Open this page in a browser with MetaMask or another wallet.",
      });
      return;
    }

    setState({ loading: "connect", identity: state.identity });

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const wallet = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : undefined;

      if (!wallet) {
        throw new Error("Wallet did not return an account.");
      }

      const challengeResponse = await fetch("/api/identity/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      const challenge = await challengeResponse.json();

      if (!challengeResponse.ok) {
        throw new Error(errorMessage(challenge));
      }

      setState({ loading: "sign", identity: state.identity });

      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [challenge.message, wallet],
      });

      if (typeof signature !== "string") {
        throw new Error("Wallet did not return a signature.");
      }

      const linkResponse = await fetch("/api/identity/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet,
          challengeId: challenge.challengeId,
          signature,
          handle: handle || undefined,
        }),
      });
      const linked = await linkResponse.json();

      if (!linkResponse.ok) {
        throw new Error(errorMessage(linked));
      }

      setState({
        identity: linked.identity,
        message: `Linked ${shortWallet(linked.identity.wallet)}.`,
      });
    } catch (error) {
      setState({
        identity: state.identity,
        error: error instanceof Error ? error.message : "Wallet link failed.",
      });
    }
  }

  async function logout() {
    setState({ loading: "logout", identity: state.identity });
    await fetch("/api/identity/me", { method: "DELETE" }).catch(() => undefined);
    setState({ identity: null, message: "Wallet session cleared." });
  }

  const isLinked = Boolean(state.identity);

  return (
    <section className="grid gap-5 rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <span className="mb-1 block">6529 handle</span>
          <Input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="optional handle"
            disabled={state.loading !== undefined}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={connectAndSign} disabled={state.loading !== undefined}>
            <Wallet className="h-4 w-4" aria-hidden="true" />
            {state.loading === "connect" ? "Connecting" : state.loading === "sign" ? "Waiting for Wallet" : "Link Wallet"}
          </Button>
          {isLinked ? (
            <Button type="button" variant="secondary" onClick={logout} disabled={state.loading !== undefined}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {state.loading === "logout" ? "Clearing" : "Clear Session"}
            </Button>
          ) : null}
        </div>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Signing only proves wallet ownership. It cannot spend funds, move NFTs, or grant admin rights.
        </p>
      </div>

      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Linked Wallet
        </div>
        {state.error ? (
          <p aria-live="polite" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
            {state.error}
          </p>
        ) : null}
        {state.message ? (
          <p aria-live="polite" className="mb-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {state.message}
          </p>
        ) : null}
        {state.identity ? (
          <dl className="grid gap-3 text-sm">
            <Info label="Wallet" value={state.identity.wallet} />
            <Info label="Handle" value={state.identity.handle ?? "not set"} />
            <Info label="Source" value={state.identity.source} />
            <Info label="REP" value={state.identity.repScore == null ? "not synced yet" : String(state.identity.repScore)} />
          </dl>
        ) : (
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            No wallet is linked in this browser session.
          </p>
        )}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500 dark:text-zinc-500">{label}</dt>
      <dd className="break-all font-semibold text-zinc-950 dark:text-zinc-50">{value}</dd>
    </div>
  );
}
