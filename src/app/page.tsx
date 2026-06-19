import {
  ArrowRight,
  BadgeCheck,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Landmark,
  ListChecks,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

const statusStats = [
  { label: "Messages read", value: "318", detail: "last wave snapshot", icon: MessageSquareText },
  { label: "Follow-ups found", value: "9", detail: "owners and open asks", icon: ListChecks },
  { label: "Claims to check", value: "2", detail: "sources needed", icon: ShieldCheck },
  { label: "Summary status", value: "Ready", detail: "review before sharing", icon: BadgeCheck },
];

const summarySections = [
  {
    title: "Decided",
    text: "Move the curation pilot forward if the budget cap and reviewer list are confirmed.",
  },
  {
    title: "Still Open",
    text: "Final budget, reviewer availability, and whether the pilot should run for 2 or 4 weeks.",
  },
  {
    title: "Follow-Up",
    text: "Maya checks reviewer interest. Ben sources prior grant numbers. Ana drafts the pilot scope.",
  },
  {
    title: "Check First",
    text: "Budget claim needs a link. One privacy-sensitive message should stay out of the public note.",
  },
];

const reviewChecks = [
  { label: "Sources cited", value: "5 drops", state: "Ready" },
  { label: "Agreement clear", value: "likely, not final", state: "Check" },
  { label: "Private info", value: "1 line flagged", state: "Edit" },
  { label: "Cost estimate", value: "$0.18 run", state: "Logged" },
];

const workflowSteps = [
  {
    title: "Read the wave",
    text: "Choose the wave and time window. SwarmOps pulls only the messages needed for the job.",
    icon: MessageSquareText,
  },
  {
    title: "Create the summary",
    text: "AI turns the conversation into a plain recap, decisions, open questions, follow-ups, and checks.",
    icon: FileText,
  },
  {
    title: "Check before sharing",
    text: "Use it privately, share it with people in the wave, or post it back only after review.",
    icon: ClipboardCheck,
  },
];

const useCases = [
  {
    title: "Governance Ops",
    text: "Catch up on a proposal wave without rereading every message.",
    icon: Landmark,
  },
  {
    title: "Builder Grants",
    text: "See missing facts, follow-ups, and unresolved asks before decisions move forward.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Curation Rooms",
    text: "Summarize submissions, opinions, and final review points in one place.",
    icon: Sparkles,
  },
];

const caseStudies = [
  {
    group: "Meme Grants Room",
    role: "Wave participant",
    quote: "I caught up in two minutes instead of rereading the whole wave. The summary showed the open questions and owners.",
    result: "3 hours saved",
  },
  {
    group: "Open Curation Room",
    role: "Curation lead",
    quote: "The wave had too many links and opinions. SwarmOps made the final review simple.",
    result: "18 follow-ups sorted",
  },
  {
    group: "Builder Sprint Crew",
    role: "Project lead",
    quote: "Every Monday we got a plain summary, blockers, and follow-ups. Everyone knew what to do next.",
    result: "9 owners assigned",
  },
];

const safetyItems = [
  {
    title: "Limited access",
    text: "AI sees the selected wave context, not wallets, keys, or private workspace data.",
    icon: LockKeyhole,
  },
  {
    title: "Cost visible",
    text: "Runs record token use, model, latency, and estimated cost when the provider returns it.",
    icon: CircleDollarSign,
  },
  {
    title: "Human control",
    text: "Agents summarize. People approve, reject, edit, or keep the summary private.",
    icon: ShieldCheck,
  },
];

export default function Home() {
  return (
    <main className="bg-zinc-100 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="border-b border-zinc-200 bg-[#f7f8f6] dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:py-18">
          <div className="max-w-4xl">
            <Badge className="border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
              <FileCheck2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              SwarmOps alpha
            </Badge>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-normal text-zinc-950 sm:text-6xl dark:text-zinc-50">
              Keep noisy 6529 waves from losing the plot.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-700 sm:text-xl dark:text-zinc-300">
              SwarmOps is an optimized summarizer for anyone in a 6529 wave. It catches you up fast: what happened, what was decided, what is still open, who owns the next step, and what needs checking.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/operator/briefs" size="lg">
                <FileText className="h-5 w-5" aria-hidden="true" />
                Open Summaries
              </ButtonLink>
              <ButtonLink href="#example" variant="secondary" size="lg">
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
                See Example
              </ButtonLink>
            </div>
          </div>

          <ProductWorkspace />

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statusStats.map((stat) => (
              <StatusStat key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </section>

      <section id="platform" className="border-b border-zinc-200 bg-white py-14 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <Users className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Problem
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">Busy waves lose shared state.</h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              People join late, skim, and ask the same questions again. Decisions, open issues, owners, and facts get buried. SwarmOps gives anyone in the wave a clear summary they can read privately, share with collaborators, or post back when the wave needs a public recap.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {workflowSteps.map((step) => (
              <WorkflowStep key={step.title} {...step} />
            ))}
          </div>
        </div>
      </section>

      <section id="example" className="border-b border-zinc-200 bg-zinc-100 py-14 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <Badge className="border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
                <FileText className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Example Wave Summary
              </Badge>
              <h2 className="mt-4 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">The summary is plain on purpose.</h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-700 dark:text-zinc-300">
                A good wave summary is short enough to scan and specific enough to act on.
              </p>
            </div>
            <ButtonLink href="/operator/briefs" variant="secondary">
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              Review Drafts
            </ButtonLink>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <p className="text-sm font-semibold uppercase tracking-normal text-zinc-500 dark:text-zinc-500">Wave summary</p>
                <h3 className="mt-1 text-xl font-semibold text-zinc-950 dark:text-zinc-50">Curation pilot wave</h3>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {summarySections.map((section) => (
                  <SummaryRow key={section.title} {...section} />
                ))}
              </div>
            </section>
            <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Review checks</h3>
              <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
                {reviewChecks.map((check) => (
                  <ReviewCheck key={check.label} {...check} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      <section id="workflows" className="border-b border-zinc-200 bg-white py-14 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="mb-7 max-w-3xl">
            <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <Bot className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Use Cases
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">For anyone who needs to catch up.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {useCases.map((useCase) => (
              <UseCaseCard key={useCase.title} {...useCase} />
            ))}
          </div>
        </div>
      </section>

      <section id="case-studies" className="border-b border-zinc-200 bg-zinc-100 py-14 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="mb-7 max-w-3xl">
            <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <BadgeCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Sample Stories
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">What success should feel like.</h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Fictional examples for the draft site. These show the outcomes SwarmOps is built to create.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {caseStudies.map((story) => (
              <CaseStudyCard key={story.group} {...story} />
            ))}
          </div>
        </div>
      </section>

      <section id="safety" className="border-b border-zinc-200 bg-white py-14 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Safety
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">Agents summarize. People decide.</h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              The product is useful only if people trust the process. SwarmOps keeps access narrow, records costs, and makes review the default.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {safetyItems.map((item) => (
              <SafetyCard key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-zinc-950 py-14 text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold">Launch the simplest useful loop.</h2>
            <p className="mt-3 text-base leading-7 text-zinc-300">
              Read a wave, create the summary, check it, and track follow-ups. Add external agents and payments only after this loop works.
            </p>
          </div>
          <ButtonLink href="/operator/briefs" size="lg" className="w-fit bg-white text-zinc-950 hover:bg-zinc-200 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            Open Operator
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}

function ProductWorkspace() {
  return (
    <section className="mt-10 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950" aria-label="Wave summary workflow preview">
      <div className="flex flex-col gap-3 border-b border-zinc-200 bg-zinc-950 px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <div>
          <p className="text-sm font-semibold text-zinc-300">Wave 6529 / Curation pilot</p>
          <p className="mt-1 text-xl font-semibold">Wave summary review</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-emerald-100">Draft ready</span>
          <span className="rounded-md border border-amber-300/40 bg-amber-300/10 px-2.5 py-1 text-amber-100">2 checks</span>
          <span className="rounded-md border border-zinc-500 bg-zinc-900 px-2.5 py-1 text-zinc-200">$0.18</span>
        </div>
      </div>

      <div className="grid min-h-[360px] lg:grid-cols-[0.82fr_1.24fr_0.94fr]">
        <div className="border-b border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/70 lg:border-b-0 lg:border-r">
          <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Wave activity</p>
          <div className="mt-4 space-y-3">
            <MessageSnippet name="Maya" text="We should test a smaller pilot first." />
            <MessageSnippet name="Ben" text="Prior grants used a 2 ETH cap, but I need the link." />
            <MessageSnippet name="Ana" text="I can draft the pilot scope by Friday." />
          </div>
        </div>

        <div className="border-b border-zinc-200 p-5 dark:border-zinc-800 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-teal-700 dark:text-teal-300">Summary output</p>
              <h2 className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">What happened in the wave</h2>
            </div>
            <Badge className="border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200">Reviewed</Badge>
          </div>
          <div className="mt-5 space-y-4">
            {summarySections.slice(0, 3).map((section) => (
              <div key={section.title}>
                <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{section.title}</p>
                <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{section.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-50 p-4 dark:bg-zinc-900/70">
          <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Before sharing</p>
          <div className="mt-4 space-y-3">
            {reviewChecks.slice(0, 3).map((check) => (
              <ReviewPill key={check.label} {...check} />
            ))}
          </div>
          <div className="mt-5 grid gap-2">
            <ButtonLink href="/operator/briefs" className="w-full">
              Review Summary
            </ButtonLink>
            <ButtonLink href="#example" variant="secondary" className="w-full">
              View Example
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function MessageSnippet({ name, text }: { name: string; text: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-500">{name}</p>
      <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{text}</p>
    </div>
  );
}

function StatusStat({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: LucideIcon }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden="true" />
        <p className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{value}</p>
      </div>
      <p className="mt-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">{label}</p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">{detail}</p>
    </div>
  );
}

function WorkflowStep({ title, text, icon: Icon }: { title: string; text: string; icon: LucideIcon }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <Icon className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden="true" />
      <h3 className="mt-4 font-semibold text-zinc-950 dark:text-zinc-50">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{text}</p>
    </article>
  );
}

function SummaryRow({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid gap-2 px-5 py-4 sm:grid-cols-[160px_1fr]">
      <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{title}</p>
      <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{text}</p>
    </div>
  );
}

function ReviewCheck({ label, value, state }: { label: string; value: string; state: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{label}</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">{value}</p>
      </div>
      <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">{state}</Badge>
    </div>
  );
}

function ReviewPill({ label, value, state }: { label: string; value: string; state: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{label}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{value}</p>
        </div>
        <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{state}</span>
      </div>
    </div>
  );
}

function UseCaseCard({ title, text, icon: Icon }: { title: string; text: string; icon: LucideIcon }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <Icon className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden="true" />
      <h3 className="mt-4 font-semibold text-zinc-950 dark:text-zinc-50">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{text}</p>
    </article>
  );
}

function CaseStudyCard({ group, role, quote, result }: { group: string; role: string; quote: string; result: string }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="font-semibold text-zinc-950 dark:text-zinc-50">{group}</p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">{role}</p>
      <p className="mt-5 text-base leading-7 text-zinc-800 dark:text-zinc-200">&quot;{quote}&quot;</p>
      <p className="mt-5 border-t border-zinc-100 pt-4 text-sm font-semibold text-teal-800 dark:border-zinc-800 dark:text-teal-300">{result}</p>
    </article>
  );
}

function SafetyCard({ title, text, icon: Icon }: { title: string; text: string; icon: LucideIcon }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <Icon className="h-5 w-5 text-teal-700 dark:text-teal-300" aria-hidden="true" />
      <h3 className="mt-4 font-semibold text-zinc-950 dark:text-zinc-50">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{text}</p>
    </article>
  );
}
