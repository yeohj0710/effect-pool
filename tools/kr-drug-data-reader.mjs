import { createReadStream } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const root = resolve(
  process.env.KR_DRUG_DATA_DIR ?? "C:\\dev\\kr-drug-data",
);
const permitPath = resolve(root, "permit", "catalog.jsonl");

// 허가 카탈로그 원본(수 기가)은 저장소 밖에 있어서 Vercel 빌더에는 없다.
// 빌드가 실제로 보는 건 1.6KB 짜리 manifest 하나뿐이라 그것만 저장소에 넣어 둔다.
// 이 사본이 없으면 원격 빌드가 `C:\dev\kr-drug-data` 를 찾다가 매번 죽는다.
const snapshotPath = resolve(repoRoot, "data", "permit-manifest.snapshot.json");

export function krDrugDataRoot() {
  return root;
}

const exists = (p) => access(p).then(() => true, () => false);

/**
 * 원본이 있으면 원본을 읽고, 사본이 뒤처졌으면 같이 갱신한다.
 * 원본이 없는 곳(원격 빌더)에서는 사본을 읽는다. 둘 다 없으면 그때는 죽는 게 맞다.
 * 검사 자체는 build.mjs 가 한다 — 여기서는 어느 쪽을 읽었는지만 알려준다.
 */
export async function readPermitManifest() {
  const livePath = resolve(root, "permit", "manifest.json");

  if (await exists(livePath)) {
    const text = await readFile(livePath, "utf8");
    const snapshotText = (await exists(snapshotPath))
      ? await readFile(snapshotPath, "utf8")
      : null;
    if (snapshotText !== text) {
      // 사본을 손으로 맞추게 두면 반드시 어긋난다. 원본을 읽은 김에 갱신한다.
      try {
        await writeFile(snapshotPath, text);
      } catch {
        // 읽기 전용 환경이면 갱신은 포기하고 원본 값으로 계속 간다.
      }
    }
    return { ...JSON.parse(text), _source: "live" };
  }

  if (await exists(snapshotPath)) {
    return { ...JSON.parse(await readFile(snapshotPath, "utf8")), _source: "snapshot" };
  }

  throw new Error(
    `허가 manifest 를 못 찾았다. 원본(${livePath})도 사본(${snapshotPath})도 없다.`,
  );
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
