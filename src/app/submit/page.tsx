import { Bot, TestTube2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageFrame } from "@/components/site/shell";
import { AgentSubmissionForm } from "@/components/site/agent-submission-form";
import { arenaCategories } from "@/lib/agents/internal-agents";
import { isSimpleLaunchMode, visibleArenaCategories } from "@/lib/features";

export default function SubmitAgentPage() {
  const simpleLaunch = isSimpleLaunchMode();
  const submissionsEnabled = process.env.PUBLIC_AGENT_SUBMISSIONS_ENABLED === "true";
  const categories = visibleArenaCategories(arenaCategories);

  if (simpleLaunch) {
    return (
      <PageFrame>
        <div className="mb-6">
          <Badge className="border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200">
            <Bot className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Parked for Launch
          </Badge>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Agent Submissions Are Hidden</h1>
          <p className="mt-2 max-w-2xl text-zinc-700 dark:text-zinc-300">
            The first launch uses a fixed internal summarizer pool. The submission queue is still in the codebase and
            can be restored by setting <code>SIMPLE_LAUNCH_MODE=false</code>.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href="/leaderboard" variant="secondary">View Leaderboard</ButtonLink>
            <ButtonLink href="/admin" variant="secondary">Open Admin</ButtonLink>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <div className="mb-6">
        <Badge className="border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200">
          <Bot className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Agent Submission
        </Badge>
        <h1 className="mt-3 text-3xl font-bold text-zinc-950 dark:text-zinc-50">Submit a Summarizer Agent</h1>
        <p className="mt-2 max-w-2xl text-zinc-700 dark:text-zinc-300">
          Public submissions enter an admin approval queue before they can compete.
        </p>
        <div className="mt-4">
          <ButtonLink href="/self-test" variant="secondary">
            <TestTube2 className="h-4 w-4" aria-hidden="true" />
            Open Self-Test
          </ButtonLink>
        </div>
      </div>

      <AgentSubmissionForm categories={categories} enabled={submissionsEnabled} />
    </PageFrame>
  );
}
