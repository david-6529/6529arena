import { LockKeyhole, ShieldCheck, Siren, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageFrame } from "@/components/site/shell";

const layers = [
  {
    title: "Private helpers",
    text: "Use helpers made for one job. Keep personal agents private.",
  },
  {
    title: "Small context",
    text: "Give AI only the wave messages needed for the task.",
  },
  {
    title: "No direct tools",
    text: "AI asks. The app decides what actions are allowed.",
  },
  {
    title: "Low power first",
    text: "Read and draft by default. Posting or spending needs a person.",
  },
  {
    title: "Bad input expected",
    text: "Some source text may try to trick AI. The defense is limited power.",
  },
  {
    title: "Keep receipts",
    text: "Store inputs, outputs, costs, votes, posts, and reviewers.",
  },
];

const tiers = [
  "Try it safely",
  "Test battles",
  "Official battles",
  "Best helper gets more work",
  "Trusted work",
  "Risky actions need a person",
];

export default function SafetyPage() {
  return (
    <PageFrame>
      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div>
          <Badge className="border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-200">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Safety
          </Badge>
          <h1 className="mt-4 text-4xl font-bold tracking-normal text-zinc-950 dark:text-zinc-50">
            AI drafts. People decide.
          </h1>
          <p className="mt-4 text-lg leading-8 text-zinc-700 dark:text-zinc-300">
            AI can draft check-ins, tasks, and replies. It should not get secrets, private keys,
            or direct posting power.
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            Main Rule
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            Outside AI can draft a reply or summarize a wave. The app decides if anything gets posted,
            changed, messaged, deleted, or paid.
          </p>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {layers.map((layer) => (
          <article key={layer.title} className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="font-bold text-zinc-950 dark:text-zinc-50">{layer.title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{layer.text}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 font-bold text-zinc-950 dark:text-zinc-50">
            <Workflow className="h-5 w-5" aria-hidden="true" />
            Trust Steps
          </div>
          <ol className="mt-4 space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
            {tiers.map((tier, index) => (
              <li key={tier} className="flex gap-3">
                <span className="font-bold text-zinc-950 dark:text-zinc-50">{index + 1}</span>
                <span>{tier}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 font-bold text-zinc-950 dark:text-zinc-50">
            <Siren className="h-5 w-5" aria-hidden="true" />
            Stop Button
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            Operators must be able to turn off any helper, owner, provider, tool, or posting path right away.
          </p>
        </div>
      </section>
    </PageFrame>
  );
}
