"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SubmissionState = {
  loading: boolean;
  error?: string;
  message?: string;
};

export function AgentSubmissionForm({
  categories,
  enabled,
}: {
  categories: string[];
  enabled: boolean;
}) {
  const [state, setState] = useState<SubmissionState>({ loading: false });

  async function submitAgent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ loading: true });

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") ?? ""),
      category: String(formData.get("category") ?? ""),
      ownerWallet: String(formData.get("ownerWallet") ?? "") || undefined,
      ownerHandle: String(formData.get("ownerHandle") ?? "") || undefined,
      provider: String(formData.get("provider") ?? ""),
      modelName: String(formData.get("modelName") ?? ""),
      maxCostUsd: formData.get("maxCostUsd") ? Number(formData.get("maxCostUsd")) : undefined,
      maxOutputLength: formData.get("maxOutputLength") ? Number(formData.get("maxOutputLength")) : undefined,
      description: String(formData.get("description") ?? "") || undefined,
      systemPrompt: String(formData.get("systemPrompt") ?? ""),
      submitterEmail: String(formData.get("submitterEmail") ?? "") || undefined,
    };

    try {
      const response = await fetch("/api/agent-submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Submission failed.");
      }

      form.reset();
      setState({
        loading: false,
        message: `Submission received. Review ID ${json.submission.id.slice(0, 8)}.`,
      });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Submission failed." });
    }
  }

  return (
    <form
      onSubmit={submitAgent}
      className="grid gap-5 rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-2"
    >
      {!enabled ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 lg:col-span-2">
          Public submissions are currently closed. This form is wired for the approval queue and will activate when
          submissions are enabled.
        </div>
      ) : null}
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 lg:col-span-2">
        Prompt-config agents only. Do not include API keys, wallet keys, private memory, or production credentials in a submission.
      </div>
      <Field label="Agent name">
        <Input name="name" required minLength={2} maxLength={80} placeholder="Decision Brief Summarizer" />
      </Field>
      <Field label="Category">
        <Select name="category" required>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Owner wallet">
        <Input name="ownerWallet" placeholder="0x..." />
      </Field>
      <Field label="6529 handle">
        <Input name="ownerHandle" placeholder="optional 6529 handle" />
      </Field>
      <Field label="Submitter email">
        <Input name="submitterEmail" type="email" placeholder="optional contact email" />
      </Field>
      <Field label="Model provider">
        <Select name="provider" required defaultValue="openai">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="google">Google Gemini</option>
        </Select>
      </Field>
      <Field label="Model name">
        <Input name="modelName" placeholder="gpt-4.1-mini" required />
      </Field>
      <Field label="Max cost per run">
        <Input name="maxCostUsd" type="number" min="0" max="25" step="0.01" placeholder="0.10" />
      </Field>
      <Field label="Max output length">
        <Input name="maxOutputLength" type="number" min="200" max="8000" step="100" placeholder="1200" />
      </Field>
      <Field label="Public description" className="lg:col-span-2">
        <Textarea name="description" maxLength={2000} placeholder="What this agent is optimized to do well." />
      </Field>
      <Field label="System prompt" className="lg:col-span-2">
        <Textarea
          name="systemPrompt"
          className="min-h-40"
          required
          minLength={20}
          maxLength={12000}
          placeholder="Instructions for producing the required structured summary JSON."
        />
      </Field>
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200 lg:col-span-2">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200 lg:col-span-2">
          {state.message}
        </p>
      ) : null}
      <div className="lg:col-span-2">
        <Button type="submit" disabled={state.loading || !enabled}>
          <Send className="h-4 w-4" aria-hidden="true" />
          Submit for Review
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">{label}</span>
      {children}
    </label>
  );
}
