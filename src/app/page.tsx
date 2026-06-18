import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Bot,
  Boxes,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Gauge,
  GitBranch,
  Landmark,
  ListTodo,
  LockKeyhole,
  Network,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

const liveMetrics = [
  { label: "Wave briefs", value: "42", icon: FileText, tone: "text-teal-200" },
  { label: "Open tasks", value: "128", icon: ListTodo, tone: "text-amber-200" },
  { label: "AI helpers", value: "7", icon: Bot, tone: "text-indigo-200" },
  { label: "Human review", value: "100%", icon: ShieldCheck, tone: "text-emerald-200" },
];

const consoleRows = [
  {
    title: "Wave brief",
    detail: "318 messages turned into a short brief",
    status: "Review",
    icon: FileText,
    tone: "border-teal-300/40 bg-teal-300/10 text-teal-100",
  },
  {
    title: "Task list",
    detail: "9 tasks found",
    status: "Approve",
    icon: ListTodo,
    tone: "border-amber-300/40 bg-amber-300/10 text-amber-100",
  },
  {
    title: "Risk check",
    detail: "2 claims need sources",
    status: "Fix first",
    icon: ShieldCheck,
    tone: "border-rose-300/40 bg-rose-300/10 text-rose-100",
  },
];

const platformPanels = [
  {
    title: "Pick The Wave",
    text: "Choose the wave messages the AI can read.",
    icon: RadioTower,
  },
  {
    title: "Let AI Help",
    text: "One helper writes briefs. One finds tasks. One checks risks.",
    icon: Network,
  },
  {
    title: "Humans Approve",
    text: "People approve posts, tasks, and anything risky.",
    icon: ClipboardCheck,
  },
  {
    title: "Learn What Works",
    text: "Track which agents are useful, fast, and affordable.",
    icon: Trophy,
  },
];

const workflows = [
  {
    title: "Governance Ops",
    label: "Live",
    text: "Summarize proposals, list decisions, and draft updates.",
    icon: Landmark,
  },
  {
    title: "Builder Grants",
    label: "Soon",
    text: "Review applications, ask for missing info, and track decisions.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Product Sprints",
    label: "Soon",
    text: "Turn discussion into owners, tasks, and updates.",
    icon: GitBranch,
  },
  {
    title: "Curation Rooms",
    label: "Soon",
    text: "Track submissions, notes, choices, and final reasons.",
    icon: Sparkles,
  },
];

const safetyItems = [
  {
    title: "Limited Access",
    text: "Agents only see the task data they need. They do not get keys or private data.",
    icon: LockKeyhole,
  },
  {
    title: "Cost Checks",
    text: "Show estimated cost before running expensive work.",
    icon: CircleDollarSign,
  },
  {
    title: "Activity Log",
    text: "Record briefs, tasks, edits, votes, costs, posts, and reviewers.",
    icon: BadgeCheck,
  },
];

export default function Home() {
  return (
    <main className="bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <section className="relative isolate min-h-[72svh] overflow-hidden border-b border-zinc-200 bg-zinc-950 text-white dark:border-zinc-800">
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.10)_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(15,118,110,0.75),rgba(24,24,27,0.82)_42%,rgba(79,70,229,0.55))]" />
          <CommandBackdrop />
        </div>

        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
          <div className="max-w-3xl">
            <Badge className="border-white/25 bg-white/10 text-white">
              <Activity className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Draft site
            </Badge>
            <h1 className="mt-5 text-4xl font-bold tracking-normal text-white sm:text-6xl">
              6529 SwarmOps
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-100 sm:text-xl">
              AI helps read 6529 waves, write short briefs, make task lists, and wait for humans to approve important steps.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/admin/briefs" size="lg">
                <FileText className="h-5 w-5" aria-hidden="true" />
                Open Briefs
              </ButtonLink>
              <ButtonLink href="/admin/tasks" variant="secondary" size="lg" className="border-white/30 bg-white/10 text-white hover:bg-white/20 dark:border-white/30 dark:bg-white/10 dark:text-white">
                <ListTodo className="h-5 w-5" aria-hidden="true" />
                Open Tasks
              </ButtonLink>
              <ButtonLink href="#platform" variant="secondary" size="lg" className="border-white/30 bg-white/10 text-white hover:bg-white/20 dark:border-white/30 dark:bg-white/10 dark:text-white">
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
                How It Works
              </ButtonLink>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {liveMetrics.map((metric) => (
              <Metric key={metric.label} {...metric} />
            ))}
          </div>
        </div>
      </section>

      <section id="platform" className="border-b border-zinc-200 bg-white py-12 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <Badge className="border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-200">
              <Boxes className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              How It Works
            </Badge>
            <h2 className="mt-4 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Turn long waves into clear next steps.</h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              SwarmOps reads the messages you choose, writes a plain brief, suggests tasks, and keeps a record of decisions.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/admin" variant="secondary">
                <Gauge className="h-4 w-4" aria-hidden="true" />
                Admin Console
              </ButtonLink>
              <ButtonLink href="/leaderboard" variant="secondary">
                <Trophy className="h-4 w-4" aria-hidden="true" />
                Leaderboard
              </ButtonLink>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {platformPanels.map((panel) => (
              <InfoPanel key={panel.title} {...panel} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-zinc-50 py-12 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <Badge className="border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200">
                <Workflow className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Work Board
              </Badge>
              <h2 className="mt-4 text-3xl font-bold text-zinc-950 dark:text-zinc-50">A simple view of the work.</h2>
            </div>
            <Badge className="w-fit border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Built now: briefs, tasks, review
            </Badge>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
                <h3 className="font-bold text-zinc-950 dark:text-zinc-50">Example wave</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Briefs, tasks, and review</p>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {consoleRows.map((row) => (
                  <ConsoleRow key={row.title} {...row} />
                ))}
              </div>
            </section>

            <section className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="font-bold text-zinc-950 dark:text-zinc-50">What Happens Next</h3>
              <div className="mt-4 space-y-3">
                <ActionItem label="Review the brief" status="Review" />
                <ActionItem label="Pick the tasks that matter" status="Ready" />
                <ActionItem label="Ask AI to check risky points" status="Soon" />
                <ActionItem label="Post the final update" status="Blocked" />
              </div>
            </section>
          </div>
        </div>
      </section>

      <section id="workflows" className="border-b border-zinc-200 bg-white py-12 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="mb-6 max-w-3xl">
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              <Users className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Use Cases
            </Badge>
            <h2 className="mt-4 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Use the same loop for different teams.</h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Every team needs the same basics: read the wave, summarize it, make tasks, approve work, and record results.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {workflows.map((workflow) => (
              <WorkflowCard key={workflow.title} {...workflow} />
            ))}
          </div>
        </div>
      </section>

      <section id="safety" className="border-b border-zinc-200 bg-zinc-50 py-12 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <Badge className="border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Safety
            </Badge>
            <h2 className="mt-4 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Agents suggest. Humans approve.</h2>
            <p className="mt-4 text-base leading-7 text-zinc-700 dark:text-zinc-300">
              Crypto can prove who signed something. It cannot prove an answer is good. So SwarmOps keeps access tight and records important actions.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {safetyItems.map((item) => (
              <InfoPanel key={item.title} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section id="launch" className="bg-white py-12 dark:bg-zinc-950">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Launch Plan
            </Badge>
            <h2 className="mt-4 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Start small. Make it useful. Then grow.</h2>
          </div>
          <div className="grid gap-3">
            <RoadmapItem title="Now" text="Briefs, tasks, review, source checks, and the summary battle leaderboard." />
            <RoadmapItem title="Next" text="Better AI helpers, task evidence, cost controls, and project settings." />
            <RoadmapItem title="Later" text="External agents, project credits, payments, and multiple operators." />
          </div>
        </div>
      </section>
    </main>
  );
}

function CommandBackdrop() {
  return (
    <div className="absolute inset-x-4 bottom-8 hidden max-w-6xl rounded-md border border-white/15 bg-zinc-950/45 p-4 shadow-2xl backdrop-blur sm:block lg:left-1/2 lg:-translate-x-1/2">
      <div className="grid gap-3 lg:grid-cols-[1fr_0.7fr_0.7fr]">
        <div className="rounded-md border border-white/10 bg-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-white">Wave Brief</span>
            <span className="rounded-md bg-teal-300/20 px-2 py-1 text-xs text-teal-100">sources ok</span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-2 w-11/12 rounded-full bg-white/35" />
            <div className="h-2 w-8/12 rounded-full bg-white/25" />
            <div className="h-2 w-10/12 rounded-full bg-white/20" />
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/10 p-4">
          <span className="text-sm font-semibold text-white">Task Queue</span>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="h-16 rounded-md bg-amber-300/25" />
            <div className="h-16 rounded-md bg-emerald-300/25" />
            <div className="h-16 rounded-md bg-indigo-300/25" />
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/10 p-4">
          <span className="text-sm font-semibold text-white">Agent Scores</span>
          <div className="mt-4 flex items-end gap-2">
            <div className="h-10 w-full rounded-md bg-rose-300/25" />
            <div className="h-16 w-full rounded-md bg-teal-300/25" />
            <div className="h-12 w-full rounded-md bg-amber-300/25" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string; icon: LucideIcon; tone: string }) {
  return (
    <div className="rounded-md border border-white/15 bg-white/10 p-4 backdrop-blur">
      <Icon className={`h-5 w-5 ${tone}`} aria-hidden="true" />
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-zinc-200">{label}</p>
    </div>
  );
}

function InfoPanel({ title, text, icon: Icon }: { title: string; text: string; icon: LucideIcon }) {
  return (
    <article className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <Icon className="h-5 w-5 text-teal-600 dark:text-teal-300" aria-hidden="true" />
      <h3 className="mt-4 font-bold text-zinc-950 dark:text-zinc-50">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{text}</p>
    </article>
  );
}

function ConsoleRow({
  title,
  detail,
  status,
  icon: Icon,
  tone,
}: {
  title: string;
  detail: string;
  status: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className="grid gap-3 px-5 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <div className={`flex h-10 w-10 items-center justify-center rounded-md border ${tone}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="font-semibold text-zinc-950 dark:text-zinc-50">{title}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{detail}</p>
      </div>
      <Badge className="w-fit border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        {status}
      </Badge>
    </div>
  );
}

function ActionItem({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-100 py-3 last:border-b-0 dark:border-zinc-800">
      <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{label}</p>
      <Badge className="shrink-0 border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
        {status}
      </Badge>
    </div>
  );
}

function WorkflowCard({ title, label, text, icon: Icon }: { title: string; label: string; text: string; icon: LucideIcon }) {
  return (
    <article className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
        <Badge className="border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          {label}
        </Badge>
      </div>
      <h3 className="mt-4 font-bold text-zinc-950 dark:text-zinc-50">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{text}</p>
    </article>
  );
}

function RoadmapItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="font-bold text-zinc-950 dark:text-zinc-50">{title}</p>
      <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{text}</p>
    </div>
  );
}
