# 역전국수 한국어 인물 음성 스펙 (voice-spec)

> 추후 voice-studio로 한국어 인물 음성을 합성할 때 쓰는 정밀 스펙.
> 현재 게임은 `src/sfx.js`의 WebAudio 분위기 합성만 사용한다(인물 음성 없음). 이 문서대로 음성을 만들면 `main.js`에 옵셔널 `voice` 레이어로 드롭인할 수 있다(§5).
>
> 컨셉: **1980년대 한국 기차역 플랫폼의 가락국수 포장마차.** 따뜻한 야간 조명, 증기, 발차 안내방송. 대사는 짧고(0.6~3.5s) 그 시대 정서·말투. 표준 표기지만 살짝 구수한 톤.

---

## 0. 공통 제작 지침

- **언어/표기**: 한국어. 자막 동봉 가능(게임 내 popup과 병행).
- **포맷**: 모노 WAV, 44.1kHz / 16-bit. 라우드니스 −16 LUFS 목표, 피크 −1 dBFS. 앞뒤 무음 ≤80ms로 트림.
- **마이크 톤**: 역 플랫폼 야외 + 포장마차. 살짝 룸/공간감 OK, 과한 리버브 금지. PA(역안내)만 **가벼운 메가폰/저역컷+밴드패스** 처리(현장 스피커 느낌).
- **시대감**: 80년대 경상권 간이역 정서. 사투리는 옅게(과장 금지). 비속어·현대 신조어 금지.
- **속도 주의**: 길면 게임 타이밍과 어긋난다(makima-says에서 긴 WAV가 문제였음). 표 길이 상한을 지킬 것. 길면 ffmpeg `atempo`로 후트림.
- **두 안 중 택1**: 주인장은 (A) 걸걸한 중년 남성 / (B) 푸근한 아주머니 두 안을 모두 녹음 → 게임에서 `OWNER_VARIANT`로 한쪽 선택.

---

## 1. 주인장 (owner) — 게임 진행/추임새

플레이어가 분(扮)하는 가락국수집 주인. `start`(게임 시작), `serve`(서빙 성공), `combo`(연속 성공) 이벤트에서 재생.

### 안 A — 걸걸한 중년 남성 (사장님)
| key | 대사 | 길이(초) | 톤/감정 | 이벤트 |
|---|---|---|---|---|
| `owner-start-a` | "자, 오늘도 막차까지 한 그릇씩 말아보자고!" | ≤2.8 | 활기·결의, 굵고 걸걸 | start |
| `owner-serve-a` | "옜다, 뜨끈할 때 후딱 드시오!" | ≤1.8 | 정겨움, 툭 던지듯 | serve |
| `owner-combo-a` | "어이쿠, 오늘 손이 제대로 풀렸네!" | ≤2.2 | 신남·뿌듯 | combo |

### 안 B — 푸근한 아주머니 (사장님)
| key | 대사 | 길이(초) | 톤/감정 | 이벤트 |
|---|---|---|---|---|
| `owner-start-b` | "어서들 와요, 오늘도 따끈하게 말아줄게!" | ≤2.8 | 푸근·다정 | start |
| `owner-serve-b` | "자요, 호호 불어가며 드세요." | ≤1.8 | 살가움 | serve |
| `owner-combo-b` | "아이고 잘 나간다, 신난다 신나!" | ≤2.2 | 흥겨움 | combo |

> 파일명에 `-a`/`-b`로 안 구분. 게임은 한 안만 로드.

---

## 2. 손님 5종 (customer) — 주문 시 한마디

새 손님 등장(`order` 이벤트) 시, 해당 아키타입 음성 1종을 랜덤/순환 재생. 각 아키타입 **2~3 변주** 권장(`-1`,`-2`,`-3`)으로 반복 피로 완화. 표는 대표 1개씩.

`logic.js ARCHETYPES` 매핑: soldier=군인, worker=회사원, student=통학생, couple=연인, granny=할머니.

| archetype | 화자/성별 | 대사 | 길이(초) | 톤/감정 |
|---|---|---|---|---|
| `soldier` (군인) | **남성**(20대, 또렷·절도) | "아주머니, 곱빼기로 빨리요! 열차 시간 없습니다." | ≤2.2 | 다급·씩씩, 군기 든 말투 |
| `worker` (회사원) | 남성/여성(30대, 피곤) | "여기 한 그릇 후딱… 막차 놓치면 큰일이라." | ≤2.2 | 지친·서두름 |
| `student` (통학생) | 여성/남성(10대, 밝음) | "아저씨, 보통으로 하나요! 안 맵게요." | ≤2.0 | 맑고 빠름, 풋풋 |
| `couple` (연인) | 여성+남성 짧은 주고받기 | "우리 둘이… 따뜻한 거 두 그릇요." | ≤2.4 | 들뜬·다정, 소곤 |
| `granny` (할머니) | **여성**(노년, 느릿) | "아가, 안 맵게 하나만 말아주구려." | ≤2.6 | 느릿·정겨움, 약간 떨림 |

추가 변주 아이디어(같은 의미, 다른 표현):
- soldier: "보통 하나, 국물 많이요!" / "곱빼기 하나 빨리 부탁합니다!"
- worker: "맵게 한 그릇 주세요, 빨리." / "야근하고 와서 그래요, 후딱요."
- student: "곱빼기 돼요? 헤헤." / "국물만 더 주실 수 있어요?"
- couple: "같은 걸로 두 개요~" / "맵지 않게 둘이요."
- granny: "천천히 줘도 돼, 뜨겁게만." / "옛날 그 맛으로 한 그릇."

> **현 한계(녹음 시 보완)**: 군인 남성 보이스가 없어 기존 11 wav는 여성 변주로 대체됐었음. 이번 스펙은 soldier=남성 권장을 명시 — 가능하면 남성 성우 확보.

---

## 3. 손님 이탈 (leave) — 기차/인내심 한계

손님이 인내심을 다 써 떠날 때(`leave` 이벤트, `state.missed` 증가). 아키타입 무관 공용 1~2종 + 선택적으로 군인/할머니 전용.

| key | 대사 | 길이(초) | 톤/감정 |
|---|---|---|---|
| `leave-1` | "에이, 차 들어온다! 다음에 와요." | ≤2.0 | 아쉬움·체념 |
| `leave-2` | "아이고, 그냥 가야겠네…" | ≤1.6 | 서운함 |
| `leave-granny` (선택) | "다음에 또 옴세, 수고햐." | ≤1.8 | 너그러움 |

---

## 4. 역 안내방송 (PA) — 발차 안내

intermission 진입(`pa` 이벤트) 시. **차분한 아나운서**(중성적, 또렷). 메가폰/스피커 톤 처리. 게임의 PA 4음 차임 뒤에 이어 붙이면 자연스럽다(차임=sfx, 멘트=voice).

| key | 대사 | 길이(초) | 톤/감정 |
|---|---|---|---|
| `pa-depart-1` | "잠시 후 대전발 막차가 도착하겠습니다. 승객 여러분께서는…" | ≤3.5 | 차분·또렷, 안내체 |
| `pa-depart-2` | "다음 열차가 곧 출발합니다. 안전선 안쪽으로 물러나 주십시오." | ≤3.5 | 사무적·정중 |
| `pa-lastcall` (막차/W5) | "오늘 운행 마지막 열차입니다. 서둘러 주시기 바랍니다." | ≤3.0 | 약간 긴박, 그러나 침착 |

> 역명은 배경 전경 사인과 동일하게 **대전(DAEJEON)** 사용. 변경 시 동기화.

---

## 5. 파일명 규칙 & 배치

- 경로: `public/garak-guksu/voice/<key>.wav` → 웹 경로 `/garak-guksu/voice/<key>.wav`.
- key는 `<페르소나>-<이벤트>[-<변주>]` 케밥케이스. 예:
  - `owner-start-a.wav`, `owner-serve-b.wav`
  - `cust-soldier-1.wav`, `cust-granny-2.wav`
  - `leave-1.wav`, `pa-depart-1.wav`
- 변주는 `-1`,`-2`… 정수 접미. 매니페스트에서 그룹핑.

권장 매니페스트(`voice/manifest.json`, voice-studio 출력 시 동봉):
```json
{
  "ownerVariant": "a",
  "owner":   { "start": ["owner-start-a"], "serve": ["owner-serve-a"], "combo": ["owner-combo-a"] },
  "cust":    {
    "soldier": ["cust-soldier-1","cust-soldier-2"],
    "worker":  ["cust-worker-1","cust-worker-2"],
    "student": ["cust-student-1","cust-student-2"],
    "couple":  ["cust-couple-1"],
    "granny":  ["cust-granny-1","cust-granny-2"]
  },
  "leave":   ["leave-1","leave-2"],
  "pa":      ["pa-depart-1","pa-depart-2"],
  "paLast":  ["pa-lastcall"]
}
```

---

## 6. 이벤트 ↔ 음성 매핑

| 게임 이벤트(현 sfx.cue) | main.js 발생 지점 | voice 레이어 |
|---|---|---|
| `start` | 게임 시작(chefReady) | `owner.start` 1종 |
| `serve` | 서빙 성공 | `owner.serve` (간헐 25~40%만, 과다 방지) |
| `combo` | 콤보 달성 | `owner.combo` (콤보 임계마다) |
| `order` | 새 손님 등장 | `cust[archetype]` 랜덤 변주 |
| `leave` | 손님 이탈(`missed`+) | `leave` 랜덤 (떠난 손님 granny면 `leave-granny`) |
| `pa` | intermission 진입 | 차임 후 `pa`(막차 웨이브면 `paLast`) |

원칙: **voice는 sfx를 대체하지 않고 위에 얹는다**(sfx=피드백 보장, voice=분위기). 손님 음성은 archetype을 알아야 하므로 `order` cue 호출부에 `c.archetype` 전달이 필요(아래 스케치 참고).

---

## 7. main.js 드롭인 코드 스케치 (옵셔널 voice 레이어)

`sfx`와 **병행**하는 가벼운 voice 플레이어. 매니페스트 로드 실패/파일 없음이면 조용히 no-op → 게임은 sfx만으로 정상 동작(점진적 향상).

```js
// src/voice.js — 옵셔널 인물 음성 레이어. 매니페스트 없으면 전부 no-op.
export function createVoice(sfx) {
  let M = null, cache = new Map(), enabled = false;
  const pick = (arr) => arr && arr.length ? arr[(Math.random() * arr.length) | 0] : null;

  async function load() {
    try {
      M = await fetch('/garak-guksu/voice/manifest.json').then(r => r.ok ? r.json() : null);
      enabled = !!M;
    } catch { enabled = false; }
  }
  function el(key) {
    if (!cache.has(key)) {
      const a = new Audio(`/garak-guksu/voice/${key}.wav`);
      a.preload = 'auto';
      cache.set(key, a);
    }
    return cache.get(key);
  }
  // sfx.isMuted()와 뮤트 상태 공유. delay로 sfx 차임 뒤 멘트 붙이기.
  function say(key, delay = 0) {
    if (!enabled || !key || (sfx.isMuted && sfx.isMuted())) return;
    const a = el(key); a.currentTime = 0;
    if (delay) setTimeout(() => { try { a.play(); } catch {} }, delay * 1000);
    else { try { a.play(); } catch {} }
  }

  return {
    load,
    get enabled() { return enabled; },
    owner(ev)   { if (enabled) say(pick(M.owner?.[ev])); },          // 'start'|'serve'|'combo'
    order(arche){ if (enabled) say(pick(M.cust?.[arche])); },        // logic.js archetype 키
    leave(arche){ if (enabled) say(arche === 'granny' && M.leaveGranny ? pick(M.leaveGranny) : pick(M.leave)); },
    pa(isLast)  { if (enabled) say(pick(isLast ? M.paLast : M.pa), 1.0); }, // PA 차임 뒤 1s
  };
}
```

`main.js` 배선(기존 `audio`(sfx) 호출은 그대로 두고 voice만 추가):
```js
import { createVoice } from './voice.js';
const voice = createVoice(audio);
voice.load();                 // 비동기, 실패해도 무해

// start:   audio.cue('start');  voice.owner('start');
// serve:   audio.cue('serve');  if (Math.random() < 0.35) voice.owner('serve');
// combo:   audio.cue('combo');  voice.owner('combo');
// order(손님 루프 안, c가 손님): audio.cue('order'); voice.order(c.archetype);
// leave:   audio.cue('leave');  voice.leave(lastLeftArchetype);   // 떠난 손님 archetype 추적 필요
// pa:      audio.cue('pa');     voice.pa(isLastTrainWave);
```

주의:
- 손님 음성은 `c.archetype`이 필요 → 현재 `order` cue는 손님 객체 없이 호출됨. voice용으로 손님 루프에서 `voice.order(c.archetype)`를 같은 자리에 추가.
- 뮤트: `audio.setMuted()` 토글 시 voice도 따라가야 함 → voice는 `sfx.isMuted()`를 매 호출 확인(위 스케치 반영). 별도 상태 불필요.
- `prefers-reduced-motion`은 음성과 무관(자막은 계속 노출).
