import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("homepage starts with the Signal workspace", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "The Doom Signal." })).toBeVisible();
    await expect(page.getByText("Keep noisy 6529 waves from losing the plot.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Signal", exact: true }).first()).toHaveAttribute("aria-current", "page");
    await expect(page.getByLabel("Wave name, link, or ID")).toBeVisible();
    await expect(page.getByRole("button", { name: "Preview" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Generate" })).toBeDisabled();
    await expect(page.getByText("Busy waves lose shared state.")).toHaveCount(0);

    await page.getByLabel("Wave name, link, or ID").fill("https://6529.io/waves/49f0e595-ec7c-4235-8695-a527f61b69f4");
    expect(page.url()).not.toContain("/summarize");
    await expect(page.getByText("Selected wave 49f0e595-ec7c-4235-8695-a527f61b69f4")).toBeVisible();
    await expect(page.getByRole("button", { name: "Preview" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Generate" })).toBeEnabled();
  });

  test("leaderboard shows cost groups and metric tooltips", async ({ page }) => {
    await page.goto("/leaderboard");

    await expect(page.getByRole("heading", { name: "Best AI Summary Helpers" })).toBeVisible();
    await expect(page.getByText("Best by Cost")).toBeVisible();

    await page.getByRole("button", { name: "About Quality" }).first().focus();
    const qualityTooltip = page.getByRole("tooltip").filter({ hasText: "Average score from official battles" });
    await expect(qualityTooltip).toBeVisible();
    const qualityTooltipBox = await qualityTooltip.boundingBox();
    expect(qualityTooltipBox?.width).toBeLessThanOrEqual(320);

    await page.getByRole("button", { name: "About Routing" }).first().focus();
    await expect(page.getByRole("tooltip").filter({ hasText: "rewards quality and penalizes higher cost" })).toBeVisible();
  });

  test("safety page explains human control", async ({ page }) => {
    await page.goto("/safety");

    await expect(page.getByRole("heading", { name: "AI drafts. People decide." })).toBeVisible();
    await expect(page.getByText("It should not get secrets")).toBeVisible();
  });

  test("identity page is parked in simple launch mode", async ({ page }) => {
    await page.goto("/identity");

    await expect(page.getByRole("heading", { name: "Wallet Linking Is Off" })).toBeVisible();
    await expect(page.getByText("Launch does not need wallets or weighted votes")).toBeVisible();
  });
});

test.describe("operator and submission flows", () => {
  test("operator login can create a dev session when admin key is not configured", async ({ page }) => {
    await page.goto("/operator/login");

    await expect(page.getByRole("heading", { name: "Sign in to The Doom Signal" })).toBeVisible();
    await page.getByLabel("App access key").fill("dev-admin-key");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/operator$/);
    await expect(page.getByRole("heading", { name: "The Doom Signal Console" })).toBeVisible();
    await expect(page.getByText("Open dev access")).toBeVisible();
  });

  test("operator console exposes the simple launch workflow", async ({ page }) => {
    await page.goto("/operator");

    await expect(page.getByRole("heading", { name: "The Doom Signal Console" })).toBeVisible();
    await expect(page.getByText("Production URL", { exact: true })).toBeVisible();
    await expect(page.getByText("Cron auth", { exact: true })).toBeVisible();
    await expect(page.getByText("Rate-limit salt", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create Check-in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Check And Score" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Track Follow-Ups" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent Check-ins" })).toBeVisible();
    await expect(page.getByText("Check citations, quality, cost, and posting status")).toBeVisible();
    await expect(page.getByText("No wave check-ins generated yet.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Check-in Quality Rollups" })).toBeVisible();
    await expect(page.getByText("Score check-ins for usefulness")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Check-in Cost Rollups" })).toBeVisible();
    await expect(page.getByText("Track spend, token volume, and latency")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Outcome Rollups" })).toBeVisible();
    await expect(page.getByText("Avg score").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Wave Rollups" })).toBeVisible();
    await expect(page.getByText("No wave activity yet.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Workflow Rollups" })).toBeVisible();
    await expect(page.getByText("No workflow activity yet.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Owner Rollups" })).toBeVisible();
    await expect(page.getByText("No owner activity yet.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Follow-Up Queue" })).toBeVisible();
    await expect(page.getByText("No follow-ups created yet.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Evaluation Battle Runner" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Run Maintenance" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Leaderboard CSV" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Wave Check-ins CSV" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Wave Tasks CSV" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Battles CSV" })).toHaveCount(0);
  });

  test("readiness page exposes launch blocker checks", async ({ page }) => {
    await page.goto("/operator/readiness");

    await expect(page.getByRole("heading", { name: "Production Readiness" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Launch Blockers" })).toBeVisible();
    await expect(page.getByText("Production URL", { exact: true })).toBeVisible();
    await expect(page.getByText("Cron auth", { exact: true })).toBeVisible();
    await expect(page.getByText("Rate-limit salt", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Safety Gates" })).toBeVisible();
  });

  test("battle operations expose import, close, and post controls", async ({ page }) => {
    await page.goto("/operator/battles");

    await expect(page.getByRole("heading", { name: "Battle Operations" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Import Votes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Close Battle" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Preview Post" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Post to 6529" })).toBeVisible();
  });

  test("wave check-ins page exposes generation and review controls", async ({ page }) => {
    await page.goto("/operator/briefs");

    await expect(page.getByRole("heading", { name: "Wave Check-ins" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Start with a wave" })).toBeVisible();
    await expect(page.getByText("Search or paste a wave, preview the sources, then generate a check-in.")).toBeVisible();
    await expect(page.getByLabel("Wave name")).toBeVisible();
    await expect(page.getByLabel("Wave ID")).toBeVisible();
    await expect(page.getByLabel("Use all available wave history")).toBeVisible();
    await expect(page.getByLabel("Provider")).toBeVisible();
    await expect(page.getByLabel("Check-in request")).toContainText("Create a clear wave check-in");
    await expect(page.getByRole("button", { name: "Preview Sources" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Generate Check-in" })).toBeDisabled();
    await page.route("**/api/admin/6529/context", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          preview: {
            waveId: "wave-1",
            dropCount: 2,
            fromDropId: "drop-1",
            toDropId: "drop-2",
            briefEstimate: {
              provider: "openai",
              modelName: "gpt-4.1-mini",
              promptTokens: 1234,
              maxOutputTokens: 1800,
              estimatedCostUsd: 0.003374,
              costCapUsd: 0.25,
              costCapExceeded: false,
              pricingAvailable: true,
              promptDropCount: 2,
              promptOmittedDropCount: 0,
              fetchedDropCount: 2,
            },
            context: {
              from: null,
              to: null,
              mode: "recent",
              includeAllHistory: false,
              maxMessages: 500,
              maxMessagesPerWave: 250,
              searchedMessages: 3,
              hitCap: false,
              explicitWindow: false,
              sources: [
                {
                  waveId: "wave-1",
                  label: "Primary wave",
                  primary: true,
                  name: "Follow The Repo",
                  availableDropCount: 1,
                  dropCount: 1,
                  hitCap: false,
                  oldestDropAt: "2026-06-18T11:00:00.000Z",
                  newestDropAt: "2026-06-18T11:00:00.000Z",
                  searchedMessages: 1,
                },
                {
                  waveId: "wave-firehose",
                  label: "Raw PR feed",
                  primary: false,
                  name: "PR Firehose",
                  availableDropCount: 1,
                  dropCount: 1,
                  hitCap: false,
                  oldestDropAt: "2026-06-18T12:00:00.000Z",
                  newestDropAt: "2026-06-18T12:00:00.000Z",
                  searchedMessages: 2,
                },
              ],
            },
            sampleDrops: [
              {
                id: "drop-2",
                serialNo: 2,
                author: "punk6529bot",
                createdAt: "2026-06-18T12:00:00.000Z",
                sourceWaveId: "wave-firehose",
                sourceWaveName: "PR Firehose",
                sourceWaveRole: "Raw PR feed",
                preview: "Raw GitHub PR card.",
              },
            ],
          },
        }),
      });
    });
    await page.getByLabel("Wave ID").fill("wave-1");
    await page.getByRole("button", { name: "Preview Sources" }).click();
    await expect(page.getByRole("heading", { name: "Sources Preview" })).toBeVisible();
    await expect(page.getByText("2 drops collected in recent mode after searching 3 messages.")).toBeVisible();
    await expect(page.getByText("Est. cost")).toBeVisible();
    await expect(page.getByText("Est. input")).toBeVisible();
    await expect(page.getByText("1234")).toBeVisible();
    await expect(page.getByText("Prompt drops")).toBeVisible();
    await expect(page.getByRole("link", { name: "PR Firehose · Raw PR feed · 1 drops" })).toBeVisible();
    await expect(page.getByText("Raw GitHub PR card.")).toBeVisible();
    await expect(page.getByText("No wave check-ins generated yet.")).toBeVisible();
    await page.getByLabel("Model override").fill("gpt-4.1");
    await expect(page.getByRole("heading", { name: "Sources Preview" })).toBeHidden();
  });

  test("wave task operator exposes the review queue", async ({ page }) => {
    await page.goto("/operator/tasks");

    await expect(page.getByRole("heading", { name: "Wave Tasks" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Task Review Queue" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create Manual Task" })).toBeVisible();
    await expect(page.getByText("Each task shows comments, outcome scores, and its own change history from the audit log.")).toBeVisible();
    await expect(page.getByLabel("Filter status")).toBeVisible();
    await expect(page.getByLabel("Task title")).toBeVisible();
    await expect(page.getByLabel("Workflow")).toBeVisible();
    await expect(page.getByLabel("Suggested owner")).toBeVisible();
    await expect(page.getByLabel("Assigned to")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Task" })).toBeDisabled();
    await expect(page.getByText("No tasks match this filter.")).toBeVisible();
  });

  test("submit page is parked in simple launch mode", async ({ page }) => {
    await page.goto("/submit");

    await expect(page.getByRole("heading", { name: "Agent Submissions Are Off" })).toBeVisible();
    await expect(page.getByText("For launch, we use our own check-in helpers.")).toBeVisible();
  });

  test("submission review has status, category, and provider filters", async ({ page }) => {
    await page.goto("/operator/submissions");

    await expect(page.getByLabel("Status")).toBeVisible();
    await expect(page.getByLabel("Category")).toBeVisible();
    await expect(page.getByLabel("Provider")).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply Filters" })).toBeVisible();
  });

  test("agent operator page exposes version history and mutation controls", async ({ page }) => {
    await page.goto("/operator/agents");

    await expect(page.getByText("Version History").first()).toBeVisible();
    await expect(page.getByText("Create Version").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Deactivate" }).first()).toBeVisible();
  });

  test("self-test history page is available to operators", async ({ page }) => {
    await page.goto("/operator/self-tests");

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
