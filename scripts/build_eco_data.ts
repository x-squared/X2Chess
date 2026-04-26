#!/usr/bin/env node
/**
 * build_eco_data.ts — one-time offline build script.
 *
 * Reads the Lichess chess-openings TSV files (a.tsv – e.tsv) from /tmp,
 * or fetches them fresh if not present, then writes
 * frontend/data/eco-data.json sorted by ascending move-sequence length.
 *
 * Usage:
 *   npx tsx scripts/build_eco_data.ts
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "parts/eco/data/eco-data.json");
const BASE_URL = "https://raw.githubusercontent.com/lichess-org/chess-openings/master";

type EcoEntry = {
  eco: string;
  name: string;
  moves: string[];
};

const parseSanSequence = (pgn: string): string[] => {
  return pgn
    .trim()
    .split(/\s+/)
    .filter((token) => !/^\d+\.+$/.test(token) && token.trim() !== "")
    .map((tok) => tok.trim());
};

const fetchTsv = async (letter: string): Promise<string> => {
  const url = `${BASE_URL}/${letter}.tsv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
};

const parseTsv = (tsv: string): EcoEntry[] => {
  const lines = tsv.split("\n").slice(1); // skip header
  const entries: EcoEntry[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [eco, name, pgn] = trimmed.split("\t");
    if (!eco || !name || !pgn) continue;
    entries.push({ eco: eco.trim(), name: name.trim(), moves: parseSanSequence(pgn) });
  }
  return entries;
};

const main = async (): Promise<void> => {
  const all: EcoEntry[] = [];

  for (const letter of ["a", "b", "c", "d", "e"]) {
    const tmpPath = `/tmp/eco_${letter}.tsv`;
    let tsv: string;
    if (existsSync(tmpPath)) {
      tsv = readFileSync(tmpPath, "utf8");
      console.log(`Read ${tmpPath} (${tsv.split("\n").length} lines)`);
    } else {
      console.log(`Fetching ${letter}.tsv …`);
      tsv = await fetchTsv(letter);
    }
    const parsed = parseTsv(tsv);
    console.log(`  ${letter}.tsv → ${parsed.length} entries`);
    all.push(...parsed);
  }

  all.sort((a, b) => a.moves.length - b.moves.length || a.eco.localeCompare(b.eco));

  const json = JSON.stringify(all, null, 0);
  writeFileSync(OUT, json + "\n", "utf8");
  console.log(`\nWrote ${OUT}  (${all.length} entries, ${json.length} bytes)`);
};

try {
  await main();
} catch (err: unknown) {
  console.error(err);
  process.exit(1);
}
