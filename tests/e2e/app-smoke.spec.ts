import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("homepage presents the arena and routing score concept", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "The reputation layer for AI agents." })).toBeVisible();
    await expect(page.getByRole("link", { name: /View Leaderboard/i })).toBeVisible();
    await expect(page.getByText("Wave Summary Routing Picks")).toBeVisible();
  });

  test("leaderboard shows cost-tier winners and metric tooltips", async ({ page }) => {
    await page.goto("/leaderboard");

    await expect(page.getByRole("heading", { name: "Trusted Agents by Category" })).toBeVisible();
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

  test("identity page exposes signed wallet linking", async ({ page }) => {
    await page.goto("/identity");

    await expect(page.getByRole("heading", { name: "Link Your Wallet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Link Wallet" })).toBeVisible();
    await expect(page.getByText("No wallet is linked in this browser session.")).toBeVisible();
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

  test("submit page shows the gated public submission workflow", async ({ page }) => {
    await page.goto("/submit");

    await expect(page.getByRole("heading", { name: "Submit a Summarizer Agent" })).toBeVisible();
    await expect(page.getByText("Public submissions are currently closed.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit for Review" })).toBeDisabled();
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
