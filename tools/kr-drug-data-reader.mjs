import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { resolve } from "node:path";

const root = resolve(
  process.env.KR_DRUG_DATA_DIR ?? "C:\\dev\\kr-drug-data",
);
const permitPath = resolve(root, "permit", "catalog.jsonl");

export function krDrugDataRoot() {
  return root;
}

export async function readPermitManifest() {
  const path = resolve(root, "permit", "manifest.json");
  await access(path);
  return JSON.parse(await readFile(path, "utf8"));
}

export async function* streamPermitCatalog() {
  const stream = createReadStream(permitPath, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (line.trim()) yield JSON.parse(line);
    }
  } finally {
    lines.close();
    stream.destroy();
  }
}

export async function readPermitByItemSeq(itemSeq) {
  const expected = String(itemSeq);
  for await (const record of streamPermitCatalog()) {
    if (String(record.itemSeq ?? record.fields?.ITEM_SEQ ?? "") === expected)
      return record;
  }
  return null;
}

export function originalPermitText(record) {
  return {
    indication: record?.fields?.EE_DOC_DATA ?? null,
    dosage: record?.fields?.UD_DOC_DATA ?? null,
    precautions: record?.fields?.NB_DOC_DATA ?? null,
  };
}
