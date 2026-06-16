import { DEFAULT_CATEGORY } from "@/lib/agents/internal-agents";

export const SIMPLE_LAUNCH_CATEGORY = DEFAULT_CATEGORY;

export function isSimpleLaunchMode() {
  return process.env.SIMPLE_LAUNCH_MODE !== "false";
}

export function visibleArenaCategories(categories: string[]) {
  if (!isSimpleLaunchMode()) {
    return categories;
  }

  return categories.filter((category) => category === SIMPLE_LAUNCH_CATEGORY);
}
