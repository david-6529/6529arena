import { cleanupOldBattleJobs, recoverStaleBattleJobs } from "@/lib/data/jobs";
import { cleanupExpiredIdentityChallenges } from "@/lib/data/identity";
import { cleanupOldEvents, logEvent } from "@/lib/observability/events";
import { cleanupExpiredRateLimits } from "@/lib/rate-limit";

export type MaintenanceResult = {
  staleJobsRecovered: number;
  rateLimitBucketsDeleted: number;
  identityChallengesDeleted: number;
  oldJobsDeleted: number;
  oldEventsDeleted: number;
};

export async function runOperationalMaintenance(): Promise<MaintenanceResult> {
  const staleJobsRecovered = await recoverStaleBattleJobs();
  const rateLimitBucketsDeleted = await cleanupExpiredRateLimits();
  const identityChallengesDeleted = await cleanupExpiredIdentityChallenges();
  const oldJobsDeleted = await cleanupOldBattleJobs();
  const oldEventsDeleted = await cleanupOldEvents();
  const result = {
    staleJobsRecovered,
    rateLimitBucketsDeleted,
    identityChallengesDeleted,
    oldJobsDeleted,
    oldEventsDeleted,
  };

  if (
    result.staleJobsRecovered ||
    result.rateLimitBucketsDeleted ||
    result.identityChallengesDeleted ||
    result.oldJobsDeleted ||
    result.oldEventsDeleted
  ) {
    await logEvent({
      type: "maintenance.completed",
      message: "Operational maintenance cleaned up stale or expired records.",
      metadata: result,
    });
  }

  return result;
}
