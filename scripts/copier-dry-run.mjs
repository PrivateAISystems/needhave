#!/usr/bin/env node
/**
 * Live dry-run helper for copier tuning. Not used by npm test.
 * Reports per-source would-copy counts and does not insert rows.
 *
 *   node --experimental-sqlite --no-warnings scripts/copier-dry-run.mjs
 *   node --experimental-sqlite --no-warnings scripts/copier-dry-run.mjs --hours 24 --uncapped
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCopier } from "../src/copier.js";
import { createLocalEnv, loadLocalSql } from "../test/d1-sqlite.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const hoursFlag = process.argv.indexOf("--hours");
const hours = hoursFlag >= 0 ? Number(process.argv[hoursFlag + 1]) : 24;
const uncapped = args.has("--uncapped");
const maxAgeMs = Math.round((Number.isFinite(hours) && hours > 0 ? hours : 24) * 60 * 60 * 1000);

const env = createLocalEnv(loadLocalSql(root), {
  COPIER_DRY_RUN: "1",
  COPIER_MAX_AGE_MS: String(maxAgeMs),
  ...(uncapped
    ? { COPIER_MAX_PER_RUN: "200", COPIER_MAX_PER_SOURCE: "200" }
    : {}),
});

const result = await runCopier(env, { dryRun: true, now: Date.now() });
const report = {
  hours,
  uncapped,
  would_copy: result.would_copy,
  copied: result.copied,
  by_source: result.by_source,
  items: result.items.map((item) => ({
    source: item.source,
    source_url: item.source_url,
    note: item.note,
  })),
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
