#!/usr/bin/env node

// 엔트리의 subj를 식약처 허가 카탈로그와 대조하고 효능효과 원문을 출력한다.
// 카탈로그는 수 GB가 될 수 있으므로 전부 메모리에 올리지 않고 한 번만 순회한다.

import { createReadStream } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultDataRoot = process.env.KR_DRUG_DATA_DIR ?? "C:\\dev\\kr-drug-data";

function flag(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function absoluteFromRoot(value) {
  return isAbsolute(value) ? value : resolve(root, value);
}

const entryDir = absoluteFromRoot(flag("entry-dir", join("data", "entries")));
const catalogPath = absoluteFromRoot(
  flag("catalog", join(defaultDataRoot, "permit", "catalog.jsonl")),
);
const requestedEntry = flag("entry");
const requestedSubjects = new Set();
for (let i = 0; i < process.argv.length - 1; i++) {
  if (process.argv[i] === "--subj") requestedSubjects.add(process.argv[i + 1]);
}

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, "")
    .replace(/[()［］【】\[\]{}·ㆍ・,./\\_\-]/g, "");
}

function materialNames(value) {
  const text = String(value ?? "");
  const names = [];
  const pattern = /(?:^|[;|])\s*(?:성분명|원료명|주성분)\s*[:：]\s*([^;|]*)/g;
  for (const match of text.matchAll(pattern)) {
    const name = match[1].trim();
    if (name) names.push(name);
  }
  return names;
}

async function readEntries() {
  const files = (await readdir(entryDir, { withFileTypes: true }))
    .filter((file) => file.isFile() && file.name.endsWith(".json"))
    .map((file) => file.name)
    .sort();

  const entries = [];
  const bySubject = new Map();

  for (const file of files) {
    const id = file.slice(0, -5);
    if (requestedEntry && id !== requestedEntry) continue;

    const entry = JSON.parse(await readFile(join(entryDir, file), "utf8"));
    if (typeof entry.subj !== "string" || !entry.subj.trim()) {
      throw new Error(`${file}: subj가 비어 있습니다`);
    }
    if (requestedSubjects.size && !requestedSubjects.has(entry.subj)) continue;

    const normalized = normalizeName(entry.subj);
    if (!normalized) throw new Error(`${file}: 정규화한 subj가 비어 있습니다`);

    const item = { id, subj: entry.subj, normalized };
    entries.push(item);
    const group = bySubject.get(normalized) ?? [];
    group.push(item);
    bySubject.set(normalized, group);
  }

  return { entries, bySubject };
}

async function* streamJsonl(path) {
  const stream = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (const line of lines) {
      lineNumber++;
      if (!line.trim()) continue;
      try {
        yield { lineNumber, record: JSON.parse(line) };
      } catch (error) {
        throw new Error(`${path}:${lineNumber}: JSON 파싱 실패: ${error.message}`);
      }
    }
  } finally {
    lines.close();
    stream.destroy();
  }
}

function permitDetails(record, matchedBy, matchedName) {
  const fields = record.fields ?? {};
  return {
    itemSeq: String(record.itemSeq ?? fields.ITEM_SEQ ?? ""),
    productName: fields.ITEM_NAME ?? record.productName ?? null,
    manufacturer: fields.ENTP_NAME ?? record.manufacturer ?? null,
    matchedBy,
    matchedName,
    fields: {
      ITEM_NAME: fields.ITEM_NAME ?? record.productName ?? null,
      MATERIAL_NAME: fields.MATERIAL_NAME ?? null,
      EE_DOC_DATA: fields.EE_DOC_DATA ?? null,
    },
  };
}

async function main() {
  const { entries, bySubject } = await readEntries();
  if (!entries.length) throw new Error("대조할 엔트리가 없습니다");

  const ingredientMatches = new Map();
  const productMatches = new Map();
  let catalogRecords = 0;

  for await (const { record } of streamJsonl(catalogPath)) {
    catalogRecords++;
    const fields = record.fields ?? {};
    const ingredientNames = new Set(materialNames(fields.MATERIAL_NAME));

    for (const name of ingredientNames) {
      const group = bySubject.get(normalizeName(name));
      if (!group) continue;
      for (const entry of group) {
        const matches = ingredientMatches.get(entry.id) ?? [];
        matches.push(permitDetails(record, "MATERIAL_NAME", name));
        ingredientMatches.set(entry.id, matches);
      }
    }

    const itemName = fields.ITEM_NAME ?? record.productName;
    const group = bySubject.get(normalizeName(itemName));
    if (!group) continue;
    for (const entry of group) {
      const matches = productMatches.get(entry.id) ?? [];
      matches.push(permitDetails(record, "ITEM_NAME", itemName));
      productMatches.set(entry.id, matches);
    }
  }

  let materialCount = 0;
  let itemCount = 0;
  let noneCount = 0;
  let matchedRecords = 0;

  for (const entry of entries) {
    const material = ingredientMatches.get(entry.id) ?? [];
    const item = productMatches.get(entry.id) ?? [];
    const matches = material.length ? material : item;
    const matchType = material.length ? "MATERIAL_NAME" : item.length ? "ITEM_NAME" : null;

    if (material.length) materialCount++;
    else if (item.length) itemCount++;
    else noneCount++;
    matchedRecords += matches.length;

    process.stdout.write(`${JSON.stringify({
      id: entry.id,
      subj: entry.subj,
      matchType,
      matches,
    })}\n`);
  }

  console.error(JSON.stringify({
    catalogPath,
    catalogRecords,
    entries: entries.length,
    entriesWithMaterialMatch: materialCount,
    entriesWithItemMatch: itemCount,
    entriesWithoutMatch: noneCount,
    matchedRecords,
  }, null, 2));
}

main().catch((error) => {
  console.error(`permit-lookup 실패: ${error.message}`);
  process.exitCode = 1;
});
