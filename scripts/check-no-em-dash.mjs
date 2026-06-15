import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const forbidden = "\u2014";
const root = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  ".next",
  "node_modules",
  "playwright-report",
  "test-results",
  "src/generated",
]);
const ignoredFiles = new Set([
  "package-lock.json",
]);
const checkedExtensions = new Set([
  ".css",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".prisma",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);

function isIgnored(path) {
  const normalized = path.split("/").join("/");

  return [...ignoredDirectories].some((directory) => normalized === directory || normalized.startsWith(`${directory}/`));
}

function extension(path) {
  const match = path.match(/\.[^.]+$/);

  return match?.[0] ?? "";
}

function walk(directory, matches) {
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);
    const relativePath = relative(root, absolute);

    if (isIgnored(relativePath)) {
      continue;
    }

    const stats = statSync(absolute);

    if (stats.isDirectory()) {
      walk(absolute, matches);
      continue;
    }

    if (!stats.isFile() || ignoredFiles.has(relativePath) || !checkedExtensions.has(extension(entry))) {
      continue;
    }

    const content = readFileSync(absolute, "utf8");

    if (content.includes(forbidden)) {
      matches.push(relativePath);
    }
  }
}

const matches = [];
walk(root, matches);

if (matches.length) {
  console.error("Forbidden long dash character found in:");
  for (const match of matches) {
    console.error(`- ${match}`);
  }
  process.exit(1);
}
