import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("homepage presents the SwarmOps draft site", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "6529 SwarmOps" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open Briefs/i })).toBeVisible();
    await expect(page.getByText("Live Swarm Console")).toBeVisible();
    await expect(page.getByText("Workflow Library")).toBeVisible();
  });

  test("leaderboard shows cost-tier winners and metric tooltips", async ({ page }) => {
    await page.goto("/leaderboard");

    await expect(page.getByRole("heading", { name: "Best Wave Summarizers" })).toBeVisible();
    await expect(page.getByText("Wave Summarization Cost-Tier Winners")).toBeVisible();

    await page.getByRole("button", { name: "About Quality" }).first().focus();
    const qualityTooltip = page.getByRole("tooltip").filter({ hasText: "Average score from official battle entries" });
    await expect(qualityTooltip).toBeVisible();
    const qualityTooltipBox = await qualityTooltip.boundingBox();
    expect(qualityTooltipBox?.width).toBeLessThanOrEqual(320);

    await page.getByRole("button", { name: "About Routing" }).first().focus();
    await expect(page.getByRole("tooltip").filter({ hasText: "quality minus bounded cost and latency penalties" })).toBeVisible();
  });

  test("safety page explains the permission boundary", async ({ page }) => {
    await page.goto("/safety");

    await expect(page.getByRole("heading", { name: "Reputation is not the security boundary." })).toBeVisible();
    await expect(page.getByText("The actual safety boundary is permissions")).toBeVisible();
  });

  test("identity page is parked in simple launch mode", async ({ page }) => {
    await page.goto("/identity");

    await expect(page.getByRole("heading", { name: "Wallet Linking Is Hidden" })).toBeVisible();
    await expect(page.getByText("The first launch does not need wallet identity")).toBeVisible();
  });
});

test.describe("admin and submission flows", () => {
  test("admin login can create a dev session when admin key is not configured", async ({ page }) => {
    await page.goto("/admin/login");

    await expect(page.getByRole("heading", { name: "Sign in to manage battles" })).toBeVisible();
    await page.getByLabel("Admin key").fill("dev-admin-key");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Manual Battle Runner" })).toBeVisible();
  });

  test("manual battle runner exposes the expected controls without calling live services", async ({ page }) => {
    await page.goto("/admin");

    await expect(page.getByLabel("Wave ID")).toBeVisible();
    await expect(page.getByLabel("Request prompt")).toContainText("@AgentArena summarize this wave");
    await expect(page.getByLabel("Battle type")).toBeVisible();
    await expect(page.getByRole("button", { name: "Preview Context" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Queue Run/i })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Run Maintenance" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Leaderboard CSV" })).toBeVisible();
  });

  test("battle operations expose import, close, and post controls", async ({ page }) => {
    await page.goto("/admin/battles");

    await expect(page.getByRole("heading", { name: "Battle Operations" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Import Votes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Close Battle" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Preview Post" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Post to 6529" })).toBeVisible();
  });

  test("wave brief admin exposes generation and review controls", async ({ page }) => {
    await page.goto("/admin/briefs");

    await expect(page.getByRole("heading", { name: "Wave Brief Drafts" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Generate Wave Brief" })).toBeVisible();
    await expect(page.getByLabel("Wave ID")).toBeVisible();
    await expect(page.getByLabel("Provider")).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate Brief" })).toBeDisabled();
  });

  test("wave task admin exposes the review queue", async ({ page }) => {
    await page.goto("/admin/tasks");

    await expect(page.getByRole("heading", { name: "Wave Tasks" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Task Review Queue" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create Manual Task" })).toBeVisible();
    await expect(page.getByLabel("Filter status")).toBeVisible();
    await expect(page.getByLabel("Task title")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Task" })).toBeDisabled();
    await expect(page.getByText("No tasks match this filter.")).toBeVisible();
  });

  test("submit page is parked in simple launch mode", async ({ page }) => {
    await page.goto("/submit");

    await expect(page.getByRole("heading", { name: "Agent Submissions Are Hidden" })).toBeVisible();
    await expect(page.getByText("The first launch uses a fixed internal summarizer pool.")).toBeVisible();
  });

  test("submission review has status, category, and provider filters", async ({ page }) => {
    await page.goto("/admin/submissions");

    await expect(page.getByLabel("Status")).toBeVisible();
    await expect(page.getByLabel("Category")).toBeVisible();
    await expect(page.getByLabel("Provider")).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply Filters" })).toBeVisible();
  });

  test("agent admin exposes version history and mutation controls", async ({ page }) => {
    await page.goto("/admin/agents");

    await expect(page.getByText("Version History").first()).toBeVisible();
    await expect(page.getByText("Create Version").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Deactivate" }).first()).toBeVisible();
  });

  test("self-test history page is available to admins", async ({ page }) => {
    await page.goto("/admin/self-tests");

    await expect(page.getByRole("heading", { name: "Self-Test History" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });
});

test.describe("battle pages", () => {
  test("unknown battle ids render a 404 instead of crashing", async ({ page }) => {
    const response = await page.goto("/battles/not-a-real-battle");

    expect(response?.status()).toBe(404);
    await expect(page.getByText(/404|not found/i).first()).toBeVisible();
  });
});
