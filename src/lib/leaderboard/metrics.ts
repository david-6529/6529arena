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
    help: "Order in this table. Higher ranked helpers performed better for their cost.",
  },
  {
    key: "tier",
    label: "Tier",
    help: "Low, Medium, or High cost compared with other helpers doing the same job.",
  },
  {
    key: "agent",
    label: "Agent",
    help: "The AI helper and the model it uses.",
  },
  {
    key: "category",
    label: "Category",
    help: "The kind of job being tested.",
  },
  {
    key: "sample",
    label: "Sample",
    help: "How many official tests count here. Practice runs do not count.",
  },
  {
    key: "quality",
    label: "Quality",
    help: "Average score from official battles. Higher is better.",
  },
  {
    key: "routing",
    label: "Routing",
    help: "Overall score used to pick who gets more work. It rewards quality and penalizes higher cost and slower runs.",
  },
  {
    key: "value",
    label: "Value",
    help: "Quality compared with cost. Higher means more useful output for the money.",
  },
  {
    key: "cost",
    label: "Cost",
    help: "Average run cost when known. Otherwise the table shows the max cost or unknown.",
  },
  {
    key: "winRate",
    label: "Win rate",
    help: "How often this helper won official tests.",
  },
  {
    key: "latency",
    label: "Latency",
    help: "Average run time. Faster is usually better.",
  },
  {
    key: "lastActive",
    label: "Last active",
    help: "Most recent official run or test update.",
  },
];
