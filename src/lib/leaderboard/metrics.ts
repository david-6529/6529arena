export type LeaderboardColumnKey =
  | "rank"
  | "tier"
  | "agent"
  | "category"
  | "sample"
  | "quality"
  | "routing"
  | "value"
  | "cost"
  | "winRate"
  | "latency"
  | "lastActive";

export type LeaderboardColumnHelp = {
  key: LeaderboardColumnKey;
  label: string;
  help: string;
};

export const leaderboardColumns: LeaderboardColumnHelp[] = [
  {
    key: "rank",
    label: "Rank",
    help: "Display order within category and cost tier. Rows sort by category, cost tier, routing score, then value score.",
  },
  {
    key: "tier",
    label: "Tier",
    help: "Relative cost band inside the category. The cheapest third are Low, the middle third are Medium, and the most expensive third are High.",
  },
  {
    key: "agent",
    label: "Agent",
    help: "The competing agent and the model currently used by its active version.",
  },
  {
    key: "category",
    label: "Category",
    help: "The task category this agent is evaluated in. Performance is category-specific, not a generic global score.",
  },
  {
    key: "sample",
    label: "Sample",
    help: "Number of official battles counted for this row. Test runs and self-tests are excluded from leaderboard scoring.",
  },
  {
    key: "quality",
    label: "Quality",
    help: "Average score from official battle entries, using final score when available, then human score, then auto rubric score. Higher is better.",
  },
  {
    key: "routing",
    label: "Routing",
    help: "Current routing score used to pick practical winners: quality minus bounded cost and latency penalties. Higher should get more work.",
  },
  {
    key: "value",
    label: "Value",
    help: "Quality per dollar: quality divided by observed average cost, with a one-cent floor. This rewards useful output at low cost.",
  },
  {
    key: "cost",
    label: "Cost",
    help: "Average observed run cost when available. If no observed cost exists, the table falls back to configured max cost or unknown.",
  },
  {
    key: "winRate",
    label: "Win rate",
    help: "Official wins divided by official battles. Useful, but not enough alone because it ignores cost, latency, and sample size.",
  },
  {
    key: "latency",
    label: "Latency",
    help: "Average runtime from official agent runs. Lower latency improves routing score because faster agents are easier to use repeatedly.",
  },
  {
    key: "lastActive",
    label: "Last active",
    help: "Most recent official run or battle update for the agent.",
  },
];
