// 항목에 known 을 박는다. "이 용도로 이미 허가받았나"를 적는 자리다.
//
//   label     — 어느 나라에서든 그 용도로 허가받았다. 오프라벨이 아니다
//   standard  — 허가는 없지만 진료지침에 실린 표준 요법이다. 오프라벨이지만 새롭지 않다
//   off       — 허가 밖이고 표준도 아니다. 아카이브가 찾는 것
//
// 안 적힌 항목은 미판정으로 두고 점수를 깎지도 올리지도 않는다.
//
//   node tools/set-known.mjs [--write]

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "data", "entries");
const WRITE = process.argv.includes("--write");

// 근거를 같이 적는다. 나중에 누가 왜 이렇게 찍었는지 되짚을 수 있어야 한다.
const JUDGED = {
  // ── 허가받은 용도 ──
  "sildenafil-erectile-dysfunction":          ["label", "비아그라 1998 발기부전 허가"],
  "sildenafil-diabetes-pos":                  ["label", "당뇨병 남성의 발기부전도 허가 적응증 안"],
  "thalidomide-hiv-infection-pos":            ["label", "탈로미드 1997 HIV 구강궤양 허가"],
  "minoxidil-androgenetic-alopecia":          ["label", "로게인 외용 미녹시딜 남성형 탈모 허가"],
  "bimatoprost-eyelash-hypotrichosis":        ["label", "라티세 2008 속눈썹 허가"],
  "dextromethorphan-bupropion-depression":    ["label", "오벨리티 2022 주요우울장애 허가"],
  "aspirin-stroke-pos":                       ["label", "뇌졸중 2차 예방 허가"],
  "aspirin-brain-infarction-pos":             ["label", "뇌경색 2차 예방 허가"],
  "aspirin-cardiovascular-disease-pos":       ["label", "심혈관질환 2차 예방 허가"],
  "sirolimus-coronary-disease":               ["label", "약물용출 스텐트로 기기 허가"],
  "duloxetine-painful-neuropathy-pos":        ["label", "당뇨병성 말초신경병증 통증 허가"],
  "baclofen-spinal-cord-injury-pos":          ["label", "척수손상 경직 허가"],
  "botulinum-toxin-stroke":                   ["label", "뇌졸중 후 상지 경직 허가"],
  "propranolol-migraine-pos":                 ["label", "편두통 예방 허가"],
  "pantoprazole-helicobacter-infection-pos":  ["label", "헬리코박터 제균 병용요법 허가"],
  "propranolol-infantile-hemangioma":         ["label", "헤만지올 2014 영아 혈관종 허가"],
  "baclofen-cerebral-palsy":                  ["label", "뇌성마비 경직 허가"],
  "botulinum-axillary-hyperhidrosis":         ["label", "겨드랑이 다한증 허가"],
  "botulinum-toxin-parkinson-pos":            ["label", "제오민 2018 침흘림 허가"],

  // ── 허가는 없지만 표준 요법 ──
  "ketamine-treatment-resistant-depression":  ["standard", "에스케타민은 허가, 케타민은 학회 지침에 실림"],
  "clonidine-tic-disorder":                   ["standard", "틱 진료지침 1차 약"],
  "clonidine-anesthesia":                     ["standard", "마취 보조로 널리 씀"],
  "tranexamic-acid-surgery":                  ["standard", "정형외과 수술 출혈 관리 표준"],
  "tranexamic-acid-hip-fracture":             ["standard", "고관절 수술 출혈 관리 표준"],
  "ivermectin-scabies":                       ["standard", "옴 진료지침 1차, 나라에 따라 허가"],
  "ondansetron-gastroenteritis-pos":          ["standard", "소아 응급실에서 널리 씀"],
  "ketamine-analgesia":                       ["standard", "통증 보조진통으로 널리 씀"],
  "metformin-polycystic-ovary-syndrome-pos":  ["standard", "다낭성난소증후군 표준, 나라에 따라 허가"],
  "bupropion-schizophrenia-pos":              ["standard", "부프로피온 금연은 허가 적응증"],

  // ── 확인된 허가 밖 ──
  "thalidomide-vascular-malformation-pos":    ["off", "소화관 혈관기형 출혈은 허가 없음"],
  "quetiapine-dementia-harm":                 ["off", "치매 행동증상은 허가 밖이고 사망 경고가 붙음"],
  "losartan-diabetes":                        ["off", "당뇨병 발생 예방은 허가 없음"],
  "spironolactone-acute-kidney-injury-harm":  ["off", "급성 신손상은 허가 없음"],
  "modafinil-substance-abuse-harm":           ["off", "사용장애 치료는 허가 없음"],
  "ivermectin-malaria-pos":                   ["off", "말라리아 전파 차단은 허가 없음"],
  "rivastigmine-delirium-harm":               ["off", "중환자 섬망은 허가 없음"],
  "sildenafil-infertility-pos":               ["off", "배란유도 보조는 허가 없음"],
  "semaglutide-atrial-fibrillation-pos":      ["off", "심방세동 예방은 허가 없음"],
  "empagliflozin-hypertension":               ["off", "고혈압은 허가 없음"],
  "ondansetron-pain-pos":                     ["off", "프로포폴 주사 통증은 허가 없음"],
  "tranexamic-acid-bleeding":                 ["off", "코피 지혈은 허가 없음"],
  "melatonin-anxiety":                        ["off", "수술 전후 불안은 허가 없음"],
  "hydroxychloroquine-pregnancy-related-pos": ["off", "전자간증 예방은 허가 없음"],
  "hydroxyurea-thalassemia":                  ["off", "겸상적혈구는 허가, 지중해빈혈은 허가 없음"],
  "montelukast-multiple-myeloma":             ["off", "주입반응 예방은 허가 없음"],
  "modafinil-depression-pos":                 ["off", "우울증 보조는 허가 없음"],
  "prazosin-sleep-disorders":                 ["off", "악몽·수면장애는 허가 없음"],
  "memantine-schizophrenia-pos":              ["off", "조현병 음성증상은 허가 없음"],
  "dapsone-malaria-harm":                     ["off", "말라리아 병용은 허가 없음"],
  "baclofen-gerd-pos":                        ["off", "위식도역류질환은 허가 없음"],
  "raloxifene-schizophrenia":                 ["off", "조현병 보조는 허가 없음"],
  "berberine-metabolic-syndrome":             ["off", "건강기능식품이라 치료 허가가 없음"],
  "spironolactone-hyperkalemia-harm":         ["off", "고칼륨혈증은 부작용이지 적응증이 아님"],
  "duloxetine-urinary-incontinence-harm":     ["off", "미국은 허가 밖, 유럽만 허가"],
};

let wrote = 0, missing = [];
const tally = { label: 0, standard: 0, off: 0 };

for (const [id, [known, why]] of Object.entries(JUDGED)) {
  const f = join(dir, id + ".json");
  if (!existsSync(f)) { missing.push(id); continue; }
  const e = JSON.parse(readFileSync(f, "utf8"));
  if (e.known === known && e.knownWhy === why) continue;
  e.known = known;
  e.knownWhy = why;
  tally[known]++;
  wrote++;
  if (WRITE) writeFileSync(f, JSON.stringify(e, null, 2) + "\n", "utf8");
}

console.log(`판정 ${Object.keys(JUDGED).length}건 — 허가받음 ${tally.label} · 표준 요법 ${tally.standard} · 허가 밖 ${tally.off}`);
if (missing.length) console.log(`없는 항목 ${missing.length}건: ${missing.join(", ")}`);
console.log(WRITE ? `${wrote}건 적었습니다.` : `${wrote}건 적을 예정. --write 를 붙이면 실제로 적습니다.`);
