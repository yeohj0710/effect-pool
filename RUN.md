# 조사 돌리는 법

`data/worklist.md`에 주제 115개가 있고 그중 9개를 채웠습니다. 남은 106개를 Codex로 채웁니다.

---

## 한 세션에 붙여넣을 프롬프트

```
이 저장소의 AGENTS.md 를 먼저 끝까지 읽어라. 조사 규칙과 판정 기준이 전부 거기 있다.

할 일: data/worklist.md 에서 아직 [ ] 인 줄을 위에서부터 10개 골라, 각각에 대해
AGENTS.md 규칙 3의 열 단계를 그대로 밟고 data/entries/<id>.json 을 만들어라.

절대 건너뛰지 마라:
- 물질 동일성 대조. 검색 엔진이 이름이 비슷한 다른 물질을 끼워 넣는다
- 반대쪽 별도 검색 (no effect / did not / failed to / negative)
- 안전성 별도 검색 (adverse / toxicity / case report)
- queried 에 그날 실제로 쓴 검색어와 반환 건수를 적을 것

한 줄 문장은 결론을 적는 것이지 주제를 적는 게 아니다.
수동형과 번역투를 쓰지 마라. 용량과 복용법은 절대 적지 마라.
근거가 아예 없어서 항목을 못 만들겠으면 worklist 줄 끝에 "— 근거 없음(날짜)" 을 붙여둬라.

다 적었으면 node build.mjs 를 돌려라. 오류가 나오면 전부 고치고 다시 돌려라.
빌드가 통과해야 끝난 것이다. 통과하면 worklist 의 해당 줄을 [x] 로 바꾸고 커밋해라.
```

**한 세션에 10개씩.** 그 이상 넣으면 뒤로 갈수록 반대쪽·안전성 검색을 건너뛰기 시작합니다.
106개면 열한 번 돌리면 됩니다.

---

## 여러 세션을 동시에 돌릴 때

항목을 파일 하나씩 나눠놨기 때문에 `data/entries/` 는 부딪히지 않습니다.
부딪히는 건 `data/worklist.md` 하나뿐이라, **세션마다 다른 섹션을 맡기면** 됩니다.

프롬프트에서 이 줄만 바꾸세요.

```
data/worklist.md 의 "## 4. 보충제·식품" 섹션에서 아직 [ ] 인 줄만 골라라.
다른 섹션은 건드리지 마라.
```

섹션이 여덟 개라 최대 여덟 세션까지 안전합니다.

---

## 끝나고 확인할 것

```bash
node build.mjs
```

빌드가 이렇게 알려줍니다.

- 항목 수와 칸별 분포
- **효과 없음·해로운 쪽 비중** — 3분의 1 아래로 떨어지면 경고합니다. 한쪽만 보고 있다는 뜻이라
  새 항목을 더 넣지 말고 반대쪽·안전성 검색을 다시 돌려야 합니다
- 연결된 근거 자료 수
- 조사 목록 진행률

그다음 링크가 실제로 살아 있는지 훑습니다.

```bash
node -e 'const d=require("fs");const U={doi:v=>"https://doi.org/"+v,pmid:v=>"https://pubmed.ncbi.nlm.nih.gov/"+v+"/",pmc:v=>"https://pmc.ncbi.nlm.nih.gov/articles/"+v+"/",nct:v=>"https://clinicaltrials.gov/study/"+v};d.readdirSync("data/entries").forEach(f=>JSON.parse(d.readFileSync("data/entries/"+f)).refs.forEach(r=>Object.keys(U).filter(k=>r[k]).forEach(k=>console.log(U[k](r[k])))))' > /tmp/urls.txt
while read u; do echo "$(curl -sL -o /dev/null -w '%{http_code}' --max-time 20 -A 'Mozilla/5.0' "$u")  $u"; done < /tmp/urls.txt | grep -v '^200'
```

`403`은 대개 죽은 링크가 아니라 NEJM·Karger 같은 곳의 봇 차단입니다.
`404`가 나오면 진짜 잘못된 번호이니 고쳐야 합니다.

마지막으로 배포합니다.

```bash
node build.mjs && npx vercel --prod --yes
```

---

## 빌드가 설 때

| 메시지 | 뜻 |
|---|---|
| `반대쪽을 따로 찾은 기록이 없음` | `queried.negative` 를 안 적었습니다. 검색을 실제로 돌리고 적으세요 |
| `안전성을 따로 찾은 기록이 없음` | `queried.safety` 를 안 적었습니다 |
| `against 를 "—" 로 두지 마라` | 찾아본 결과를 문장으로 적어야 합니다. 없으면 "찾아봤지만 없었습니다" |
| `refs 가 비어 있음` | 원문으로 갈 수 없으면 항목이 아닙니다 |
| `doi 형식이 이상함` | DOI 를 지어냈을 가능성이 큽니다. 실제로 열어보세요 |
| `파일명이 id 와 다릅니다` | `data/entries/<id>.json` 규칙을 지키세요 |
| `같은 물질·주장·판정이 이미 있습니다` | 이미 있는 항목입니다. worklist 를 다시 보세요 |

---

## 100건쯤에서 다시 볼 것

- `lab`(세포·시험관) 칸이 계속 비어 있으면 그 칸을 없앨지 판단합니다
- 한 화면에 100줄이면 거르개만으로 부족합니다. 물질별 묶어보기가 필요한지 봅니다
- `null`·`harm` 비중이 어디서 유지되는지 봅니다. 60%를 넘으면 그것대로 편향입니다
