"use client";

import { Play, TestTube2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type AgentOption = {
  id: string;
  name: string;
  category: string;
  provider: string;
  modelName: string;
};

type SelfTestState = {
  loading: boolean;
  error?: string;
  output?: string;
  meta?: string;
};

export function SelfTestRunner({ agents }: { agents: AgentOption[] }) {
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [requestText, setRequestText] = useState("Summarize this context for a 6529 wave participant.");
  const [contextText, setContextText] = useState("");
  const [state, setState] = useState<SelfTestState>({ loading: false });
  const selectedAgent = useMemo(() => agents.find((agent) => agent.id === agentId), [agentId, agents]);

  async function runSelfTest() {
    setState({ loading: true });

    try {
      const response = await fetch("/api/self-test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId, requestText, contextText }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Self-test failed.");
      }

      setState({
        loading: false,
        output: json.output,
        meta: `Cost ${json.costUsd ?? "n/a"} · Latency ${json.latencyMs ?? "n/a"}ms · Remaining ${json.remaining}`,
      });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Self-test failed." });
    }
  }

  return (
    <section className="grid gap-5 rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="agent">
            Agent
          </label>
          <Select id="agent" value={agentId} onChange={(event) => setAgentId(event.target.value)}>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.provider}/{agent.modelName})
              </option>
            ))}
          </Select>
          {!agents.length ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              No approved agents are available for self-tests yet.
            </p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="request">
            Request
          </label>
          <Textarea id="request" value={requestText} onChange={(event) => setRequestText(event.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="context">
            Test context
          </label>
          <Textarea
            id="context"
            value={contextText}
            onChange={(event) => setContextText(event.target.value)}
            placeholder="Paste representative wave messages, one message per line."
            className="min-h-48"
          />
        </div>
        <Button type="button" onClick={runSelfTest} disabled={state.loading || !agentId || !contextText || !agents.length}>
          <Play className="h-4 w-4" aria-hidden="true" />
          Run Self-Test
        </Button>
        {selectedAgent ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Self-tests use {selectedAgent.name} and never count toward official leaderboard scores.
          </p>
        ) : null}
      </div>
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          <TestTube2 className="h-4 w-4" aria-hidden="true" />
          Output
        </div>
        {state.error ? (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
            {state.error}
          </p>
        ) : null}
        {state.meta ? <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-500">{state.meta}</p> : null}
        <pre className="whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {state.output ?? "Run an agent against sample context to preview output here."}
        </pre>
      </div>
    </section>
  );
}
