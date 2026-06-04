# Tantrum Tower 확장 — S1–S3 (경제 · AI 관리자 · 난이도) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v1 Tantrum Tower 위에 ① 자금 경제(층 완공→자금, 관리자 월급 지출), ② 고용 가능한 AI 관리자 4종(개성·자동 관리·외형 차별화), ③ 난이도 모드(Easy/Normal/Hard) 를 추가한다 — 첫 확장 스토리.

**Architecture:** v1 구조 그대로 — THREE-free 순수 로직(`public/construction-game/src/logic/`)은 Vitest로 단위 테스트, 엔진/UI는 브라우저·Playwright e2e로 검증. 신규 순수 로직 3종(`economy.js`/`difficulty.js`/`managers.js`)을 추가하고, 엔진에 `entities/Manager.js`·`ui/HireMenu.js`를 추가한다. **핵심 리팩터:** 난이도는 메뉴에서 선택 후 월드를 구성해야 하므로 `main.js`의 로드시 월드 생성을 `startGame(mode)` 함수로 이동한다. v1의 `applyTactic`/`rage`/`production`/`scoring`/`DioramaCamera` 등은 재사용한다.

**Tech Stack:** Vanilla ES Modules(.js, 빌드 없음) · Three.js 0.184 (importmap, v1과 동일) · Vitest(jsdom) · Playwright. 브랜치 `feat/tantrum-tower-expansion` (v1 위). 스토리 파일: `docs/superpowers/specs/2026-06-04-tantrum-tower-expansion-design.md`.

---

## 인터페이스 & 데이터 계약 (모든 태스크 준수)

**신규 순수 로직 API:**
- `economy.js` → `createEconomy(startFunds)`, `earn(econ,amount)`, `canAfford(econ,cost)`, `spend(econ,cost)→bool`, `payrollPerSec(managers)→number`, `tickEconomy(econ,managers,dt)→fireIndex(-1=none)`
- `difficulty.js` → `DIFFICULTY_MODES`, `applyDifficulty(config,mode)→config(mutates)`
- `managers.js` → `MANAGER_ARCHETYPES`, `MANAGER_LIST`, `getManagerArchetype(id)`, `pickManagerTarget(managerPos,archetype,workers)→index(-1=none)`

**관리자 인스턴스 필드(엔진 Manager가 보유, economy/일부 로직이 읽음):** `{ id, archetypeId, salary, position(THREE.Vector3), cooldownTimer }`.

**`pickManagerTarget`의 `workers` 인자 형태:** `[{ x, z, state, escaped }]` (엔진이 Worker 엔티티에서 매핑해 전달 — 순수 함수는 평문 데이터만 받음).

**CONFIG 신규 필드:** `slackMult`(기본 1), `economy:{startFunds,floorReward,buildingBonus,fireCooldownSec,managerCap}`. 관리자 수치는 `managers.js`의 `MANAGER_ARCHETYPES`에 둔다.

**게임 상태(`game`) 신규:** `game.economy`(경제 객체), `game.managers`(Manager 엔티티 배열), `game.difficulty`(선택된 모드 문자열).

---

## 파일 구조 맵

```
public/construction-game/src/logic/
├── config.js            (수정) economy 블록 + slackMult
├── difficulty.js        (신규) 난이도 모드 + applyDifficulty
├── economy.js           (신규) 자금/페이롤/해고
├── managers.js          (신규) 관리자 아키타입 + 타깃 선정
└── workerState.js       (수정) createWorker에 slackMult 반영
public/construction-game/src/entities/
└── Manager.js           (신규) 관리자 아바타(차별화 외형)+순찰+자동행동+패시브
public/construction-game/src/ui/
├── HUD.js               (수정) 자금·페이롤 표시
├── HireMenu.js          (신규) 관리자 고용 로스터 UI
└── Menu.js              (수정) 난이도 선택 → startGame(mode)
public/construction-game/
├── index.html           (수정) 난이도 선택·자금 HUD·고용 UI DOM
├── style.css            (수정) 위 DOM 스타일
└── src/main.js          (수정) startGame(mode) 리팩터 + 경제·관리자·난이도 와이어링
__tests__/unit/construction-game/
├── difficulty.test.ts   (신규)
├── economy.test.ts      (신규)
└── managers.test.ts     (신규)
e2e/construction-game.spec.ts  (수정) 난이도 선택·고용 스모크
docs/superpowers/specs/2026-06-04-tantrum-tower-expansion-design.md  (수정) S1–S3 상태 ✅
README.md                (수정) 확장 내용 한 줄
```

---

# Phase E1 — 설정 + 순수 로직 (TDD)

### Task 1: config.js 확장 + difficulty.js (TDD)

**Files:**
- Modify: `public/construction-game/src/logic/config.js`
- Create: `public/construction-game/src/logic/difficulty.js`
- Test: `__tests__/unit/construction-game/difficulty.test.ts`

- [ ] **Step 1: config.js에 economy 블록 + slackMult 추가** — `CONFIG` 객체의 `scoring` 항목 다음(닫는 `}` 앞)에 추가:

```js
  slackMult: 1.0, // difficulty multiplier on slack timer (applyDifficulty가 설정)
  economy: {
    startFunds: 4000,    // 난이도가 덮어씀
    floorReward: 1000,   // 난이도가 덮어씀
    buildingBonus: 2000,
    fireCooldownSec: 3,
    managerCap: 6,
  },
```

- [ ] **Step 2: 실패 테스트 작성**

```ts
// __tests__/unit/construction-game/difficulty.test.ts
import { describe, it, expect } from "vitest";
import { DIFFICULTY_MODES, applyDifficulty } from "../../../public/construction-game/src/logic/difficulty.js";

const baseConfig = () => ({ workerCount: 0, shiftSeconds: 0, targetFloors: 0, slackMult: 1, rage: { decayPerSec: 0 }, economy: { startFunds: 0, floorReward: 0 } });

describe("difficulty", () => {
  it("exposes easy/normal/hard modes", () => {
    expect(Object.keys(DIFFICULTY_MODES).sort()).toEqual(["easy", "hard", "normal"]);
  });
  it("applyDifficulty('easy') sets the easy values", () => {
    const c = applyDifficulty(baseConfig(), "easy");
    expect(c.workerCount).toBe(6);
    expect(c.shiftSeconds).toBe(240);
    expect(c.targetFloors).toBe(4);
    expect(c.rage.decayPerSec).toBeCloseTo(5.2, 5);
    expect(c.slackMult).toBeCloseTo(1.25, 5);
    expect(c.economy.startFunds).toBe(6000);
    expect(c.economy.floorReward).toBe(1500);
  });
  it("applyDifficulty('hard') sets the hard values", () => {
    const c = applyDifficulty(baseConfig(), "hard");
    expect(c.workerCount).toBe(10);
    expect(c.shiftSeconds).toBe(150);
    expect(c.targetFloors).toBe(6);
    expect(c.slackMult).toBeCloseTo(0.8, 5);
    expect(c.economy.startFunds).toBe(2500);
  });
  it("throws on unknown mode", () => {
    expect(() => applyDifficulty(baseConfig(), "nope")).toThrow();
  });
});
```

- [ ] **Step 3: 테스트 실행 → 실패 확인** — Run: `npm run test -- difficulty` · Expected: FAIL (module missing)

- [ ] **Step 4: difficulty.js 구현**

```js
// public/construction-game/src/logic/difficulty.js
export const DIFFICULTY_MODES = {
  easy:   { workerCount: 6,  shiftSeconds: 240, targetFloors: 4, rageDecayPerSec: 5.2, slackMult: 1.25, startFunds: 6000, floorReward: 1500 },
  normal: { workerCount: 8,  shiftSeconds: 180, targetFloors: 5, rageDecayPerSec: 4.0, slackMult: 1.0,  startFunds: 4000, floorReward: 1000 },
  hard:   { workerCount: 10, shiftSeconds: 150, targetFloors: 6, rageDecayPerSec: 3.2, slackMult: 0.8,  startFunds: 2500, floorReward: 700 },
};

// Mutates config in place (modules read the live CONFIG singleton) and returns it.
export function applyDifficulty(config, mode) {
  const d = DIFFICULTY_MODES[mode];
  if (!d) throw new Error(`unknown difficulty: ${mode}`);
  config.workerCount = d.workerCount;
  config.shiftSeconds = d.shiftSeconds;
  config.targetFloors = d.targetFloors;
  config.rage.decayPerSec = d.rageDecayPerSec;
  config.slackMult = d.slackMult;
  config.economy.startFunds = d.startFunds;
  config.economy.floorReward = d.floorReward;
  return config;
}
```

> 참고: `slackMult`는 **슬랙 타이머 배수**다. Easy=1.25(타이머 길어짐=농땡이 덜함), Hard=0.8(짧아짐=농땡이 잦음). 스토리표의 "빈도"와 역수 관계이며 효과(Easy가 덜 농땡이)는 일치.

- [ ] **Step 5: 테스트 통과 + 커밋** — Run: `npm run test -- difficulty` (PASS).

```bash
git add public/construction-game/src/logic/config.js public/construction-game/src/logic/difficulty.js __tests__/unit/construction-game/difficulty.test.ts
git commit -m "feat(construction): economy config + difficulty modes" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: economy.js (TDD)

**Files:**
- Create: `public/construction-game/src/logic/economy.js`
- Test: `__tests__/unit/construction-game/economy.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// __tests__/unit/construction-game/economy.test.ts
import { describe, it, expect } from "vitest";
import { createEconomy, earn, canAfford, spend, payrollPerSec, tickEconomy } from "../../../public/construction-game/src/logic/economy.js";
import { CONFIG } from "../../../public/construction-game/src/logic/config.js";

describe("economy", () => {
  it("createEconomy starts with funds and no fire cooldown", () => {
    const e = createEconomy(4000);
    expect(e.funds).toBe(4000);
    expect(e.fireCooldown).toBe(0);
  });
  it("earn / canAfford / spend", () => {
    const e = createEconomy(4000);
    earn(e, 1000);
    expect(e.funds).toBe(5000);
    expect(canAfford(e, 1200)).toBe(true);
    expect(canAfford(e, 6000)).toBe(false);
    expect(spend(e, 1200)).toBe(true);
    expect(e.funds).toBe(3800);
    expect(spend(e, 9999)).toBe(false);
    expect(e.funds).toBe(3800);
  });
  it("payrollPerSec sums manager salaries", () => {
    expect(payrollPerSec([{ salary: 6 }, { salary: 12 }, { salary: 3 }])).toBe(21);
  });
  it("tickEconomy deducts payroll; no fire while solvent", () => {
    const e = createEconomy(100);
    const fi = tickEconomy(e, [{ salary: 6 }], 1);
    expect(e.funds).toBeCloseTo(94, 5);
    expect(fi).toBe(-1);
  });
  it("tickEconomy fires the highest-salary manager when insolvent, then respects cooldown", () => {
    const e = { funds: -5, fireCooldown: 0 };
    const fi = tickEconomy(e, [{ salary: 6 }, { salary: 12 }, { salary: 3 }], 1);
    expect(fi).toBe(1); // highest salary (12) at index 1
    expect(e.fireCooldown).toBeCloseTo(CONFIG.economy.fireCooldownSec, 5);
    const fi2 = tickEconomy(e, [{ salary: 6 }, { salary: 3 }], 1);
    expect(fi2).toBe(-1); // cooldown active
  });
});
```

- [ ] **Step 2: 실행 → 실패** — Run: `npm run test -- economy` · Expected: FAIL

- [ ] **Step 3: economy.js 구현**

```js
// public/construction-game/src/logic/economy.js
import { CONFIG } from './config.js';

export function createEconomy(startFunds) {
  return { funds: startFunds, fireCooldown: 0 };
}

export function earn(econ, amount) { econ.funds += amount; return econ; }

export function canAfford(econ, cost) { return econ.funds >= cost; }

export function spend(econ, cost) {
  if (econ.funds < cost) return false;
  econ.funds -= cost;
  return true;
}

export function payrollPerSec(managers) {
  let sum = 0;
  for (const m of managers) sum += m.salary;
  return sum;
}

// Deduct payroll; when insolvent and off cooldown, return the index of the
// highest-salary manager to fire (engine removes it). -1 = fire nobody.
export function tickEconomy(econ, managers, dt) {
  econ.funds -= payrollPerSec(managers) * dt;
  if (econ.fireCooldown > 0) econ.fireCooldown = Math.max(0, econ.fireCooldown - dt);
  if (econ.funds < 0 && econ.fireCooldown === 0 && managers.length > 0) {
    let best = 0;
    for (let i = 1; i < managers.length; i++) {
      if (managers[i].salary > managers[best].salary) best = i;
    }
    econ.fireCooldown = CONFIG.economy.fireCooldownSec;
    return best;
  }
  return -1;
}
```

- [ ] **Step 4: 통과 + 커밋** — Run: `npm run test -- economy` (PASS).

```bash
git add public/construction-game/src/logic/economy.js __tests__/unit/construction-game/economy.test.ts
git commit -m "feat(construction): economy logic (funds/payroll/auto-fire)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: managers.js (TDD)

**Files:**
- Create: `public/construction-game/src/logic/managers.js`
- Test: `__tests__/unit/construction-game/managers.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// __tests__/unit/construction-game/managers.test.ts
import { describe, it, expect } from "vitest";
import { MANAGER_ARCHETYPES, MANAGER_LIST, getManagerArchetype, pickManagerTarget } from "../../../public/construction-game/src/logic/managers.js";

const wk = (x: number, z: number, state: string, escaped = false) => ({ x, z, state, escaped });

describe("managers", () => {
  it("has 4 archetypes with required fields", () => {
    expect(MANAGER_LIST).toHaveLength(4);
    expect(getManagerArchetype("drill").tactic).toBe("bark");
    expect(getManagerArchetype("drill").salary).toBe(12);
    expect(getManagerArchetype("vibe").passive).toBe(true);
    expect(() => getManagerArchetype("nope")).toThrow();
  });
  it("pickManagerTarget returns nearest slacking/sabotage worker in radius", () => {
    const arche = getManagerArchetype("veteran"); // radius 7
    const workers = [wk(0, 0, "working"), wk(2, 0, "slacking"), wk(1, 0, "slacking")];
    expect(pickManagerTarget({ x: 0, z: 0 }, arche, workers)).toBe(2); // nearest slacker
  });
  it("pickManagerTarget ignores working/escaped and out-of-range", () => {
    const arche = getManagerArchetype("intern"); // radius 4
    expect(pickManagerTarget({ x: 0, z: 0 }, arche, [wk(0, 0, "working"), wk(1, 0, "slacking", true)])).toBe(-1);
    expect(pickManagerTarget({ x: 0, z: 0 }, arche, [wk(99, 0, "slacking")])).toBe(-1);
  });
  it("sabotage workers are eligible targets", () => {
    const arche = getManagerArchetype("veteran");
    expect(pickManagerTarget({ x: 0, z: 0 }, arche, [wk(1, 0, "sabotage")])).toBe(0);
  });
});
```

- [ ] **Step 2: 실행 → 실패** — Run: `npm run test -- managers`

- [ ] **Step 3: managers.js 구현**

```js
// public/construction-game/src/logic/managers.js
export const MANAGER_ARCHETYPES = {
  veteran: { id: 'veteran', label: '김 베테랑', icon: '🧓', tactic: 'soothe', radius: 7,   cooldown: 2.5, hireCost: 1200, salary: 6,  successRate: 1.0, passive: false, color: 0x8a8f96, helmet: 0xb0b6bd },
  drill:   { id: 'drill',   label: '박 군기',   icon: '🪖', tactic: 'bark',   radius: 4.5, cooldown: 2.0, hireCost: 2000, salary: 12, successRate: 1.0, passive: false, color: 0x9a4a3a, helmet: 0xc0392b },
  vibe:    { id: 'vibe',    label: '이 인싸',   icon: '😎', tactic: null,     radius: 8,   cooldown: 1.0, hireCost: 1000, salary: 5,  successRate: 1.0, passive: true,  color: 0x3a8a6a, helmet: 0x2ecc71 },
  intern:  { id: 'intern',  label: '최 인턴',   icon: '🧑‍🎓', tactic: 'soothe', radius: 4,   cooldown: 3.0, hireCost: 500,  salary: 3,  successRate: 0.7, passive: false, color: 0x9a8f5a, helmet: 0xd8c24a },
};

export const MANAGER_LIST = Object.values(MANAGER_ARCHETYPES);

export function getManagerArchetype(id) {
  const a = MANAGER_ARCHETYPES[id];
  if (!a) throw new Error(`unknown manager: ${id}`);
  return a;
}

// workers: [{x,z,state,escaped}] — nearest slacking/sabotage worker within radius, or -1.
export function pickManagerTarget(managerPos, archetype, workers) {
  let best = -1, bestD = archetype.radius * archetype.radius;
  for (let i = 0; i < workers.length; i++) {
    const w = workers[i];
    if (w.escaped) continue;
    if (w.state !== 'slacking' && w.state !== 'sabotage') continue;
    const dx = w.x - managerPos.x, dz = w.z - managerPos.z;
    const d = dx * dx + dz * dz;
    if (d <= bestD) { bestD = d; best = i; }
  }
  return best;
}
```

- [ ] **Step 4: 통과 + 커밋** — Run: `npm run test -- managers` (PASS).

```bash
git add public/construction-game/src/logic/managers.js __tests__/unit/construction-game/managers.test.ts
git commit -m "feat(construction): manager archetypes + target selection" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: createWorker가 slackMult 반영 (v1 로직 수정)

**Files:**
- Modify: `public/construction-game/src/logic/workerState.js`

- [ ] **Step 1: createWorker의 slackTimer에 slackMult 적용** — `workerState.js`에서 `import { CONFIG } from './config.js';`는 이미 있음(v1 minSlackSeconds용). `createWorker` 안의

```js
  const slackTimer = a.slackMeanSeconds + (rng() * 2 - 1) * a.slackVariance;
```
를 다음으로 교체:
```js
  const slackTimer = (a.slackMeanSeconds + (rng() * 2 - 1) * a.slackVariance) * (CONFIG.slackMult ?? 1);
```

- [ ] **Step 2: 기존 단위 테스트 회귀 확인** — `CONFIG.slackMult` 기본값 1이므로 v1 `workerState.test.ts`(slackTimer≈10)는 그대로 통과해야 한다.

Run: `npm run test -- construction-game`
Expected: 모든 기존 + 신규 로직 테스트 PASS (workerState 포함).

- [ ] **Step 3: 커밋**

```bash
git add public/construction-game/src/logic/workerState.js
git commit -m "feat(construction): apply difficulty slackMult in createWorker" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Phase E2 — 난이도 선택 (UI + main.js 리팩터)

이 단계의 핵심은 **월드 생성을 `startGame(mode)`로 이동**하는 리팩터다. 끝나면 메뉴에서 난이도를 고르고 시작하면 해당 난이도로 게임이 구성된다.

### Task 5: index.html 난이도 선택 DOM + main.js startGame 리팩터

**Files:**
- Modify: `public/construction-game/index.html`
- Modify: `public/construction-game/style.css`
- Modify: `public/construction-game/src/main.js`
- Modify: `e2e/construction-game.spec.ts`

- [ ] **Step 1: index.html 메뉴에 난이도 선택 + 시작 버튼 데이터 추가** — `#menu`의 `.panel` 안, `#start-btn` 바로 위에 난이도 선택 행 삽입:

```html
      <div class="difficulty" id="difficulty">
        <button class="diff-btn" data-mode="easy">쉬움</button>
        <button class="diff-btn selected" data-mode="normal">보통</button>
        <button class="diff-btn" data-mode="hard">어려움</button>
      </div>
```
(`#start-btn`은 그대로 둔다.)

- [ ] **Step 2: style.css에 난이도 버튼 스타일 추가** (파일 끝에):

```css
.difficulty { display: flex; gap: 8px; justify-content: center; margin: 4px 0 20px; }
.diff-btn { flex: 1; padding: 10px 0; border-radius: 10px; border: 1px solid rgba(255,200,90,.35);
  background: rgba(0,0,0,.3); color: #ffe0a0; font-weight: 700; cursor: pointer; transition: all .15s; }
.diff-btn.selected { background: linear-gradient(135deg,#ffd24a,#ff9d2e); color: #2a1c08; border-color: transparent; }
```

- [ ] **Step 3: main.js 리팩터 — 정적 셋업은 로드시, 난이도 의존 월드는 `startGame(mode)`로** — `public/construction-game/src/main.js`의 `if (game) { ... }` 블록 전체를 아래로 교체. (기존 import에 difficulty/economy 추가; Site/lights/pipeline/input/HUD/Menu는 로드시 1회, Worker/Building/Foreman/관리자/economy는 `startGame`에서 생성.)

상단 import 블록에 추가:
```js
import { applyDifficulty } from './logic/difficulty.js';
```

`if (game) {` 블록을 다음 구조로 재작성 (Phase E2 시점 — 경제/관리자 와이어링은 E3/E4에서 채움):
```js
if (game) {
  // ---- static setup (once) ----
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556070, 1.0);
  game.scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xfff0d0, 0.7);
  dir.position.set(20, 40, 10);
  game.scene.add(dir);

  game.pipeline = new RetroPipeline(320, 240, 16);

  const input = new Input();
  game.input = input;

  game.add(new Site());

  const foreman = game.add(new Foreman(input));
  game.foreman = foreman;
  const diorama = new DioramaCamera(game.camera, foreman);
  game.systems.push(diorama);
  game.diorama = diorama;

  game.systems.push(new HUD(game));
  const prompt = new ConfrontationPrompt();

  // audio + managers (AudioManager is already imported in v1 main.js)
  const audio = new AudioManager();
  game.audio = audio;
  game.managers = [];

  // difficulty selection on the menu
  let selectedMode = 'normal';
  document.querySelectorAll('#difficulty .diff-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#difficulty .diff-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMode = btn.getAttribute('data-mode');
    });
  });

  // difficulty-dependent world, (re)built on start/restart
  let building = null, workers = [], placed = [];

  function buildWorld() {
    // building
    if (building) { game.scene.remove(building.object3d); }
    building = new Building();
    game.add(building);
    game.building = building;
    applyRetro(game.building.floorMat, { snap: 160, affine: false });

    // workers
    for (const w of workers) game.scene.remove(w.object3d);
    workers = [];
    placed = spawnWorkers(CONFIG.seed, CONFIG.workerCount);
    const rng = mulberry32(CONFIG.seed + 99);
    for (const p of placed) {
      const wk = new Worker(createWorker(p.id, p.archetypeId, rng), p.x, p.z, CONFIG.exit);
      game.add(wk);
      workers.push(wk);
    }
    game.workers = workers;
  }

  function startGame(mode) {
    applyDifficulty(CONFIG, mode);
    game.difficulty = mode;
    game.status = 'playing';
    game.elapsed = 0;
    game.build = { progress: 0, floorsBuilt: 0 };
    game.combo = 0;
    game.incidents = 0;
    game.crewRemaining = CONFIG.workerCount;
    buildWorld();
    applyRetroToObject(game.scene, { snap: 160, affine: false });
    menuEl.classList.add('hidden');
    hudEl.classList.remove('hidden');
    game.start();
  }

  const menu = new Menu(game, () => startGame(game.difficulty || selectedMode));

  game.step = (dt, g) => {
    if (g.status !== 'playing') return;
    g.elapsed += dt;

    // chatter spread
    for (const cw of workers) {
      if (!cw.archetype.spreads || cw.logic.state !== 'slacking' || cw.logic.escaped) continue;
      for (const ow of workers) {
        if (ow === cw || ow.logic.escaped) continue;
        const dx = ow.position.x - cw.position.x, dz = ow.position.z - cw.position.z;
        if (dx * dx + dz * dz <= CONFIG.chatterSpreadRadius ** 2) applySlackPressure(ow.logic, dt, CONFIG.chatterSpreadFactor);
      }
    }

    // riot incitement
    for (const rw of workers) {
      if (rw.logic.state !== 'riot' || rw.logic.escaped) continue;
      for (const ow of workers) {
        if (ow === rw || ow.logic.escaped) continue;
        const dx = ow.position.x - rw.position.x, dz = ow.position.z - rw.position.z;
        if (dx * dx + dz * dz <= CONFIG.riotInciteRadius ** 2) addRage(ow.logic, CONFIG.riotIncitePerSec * dt, ow.archetype.rageSensitivity);
      }
    }

    // confrontation
    prompt.update(g.foreman, workers);
    const tacticKey = g.input.state.tactic;
    if (tacticKey) {
      const target = prompt.current;
      const tacticId = tacticByKey(tacticKey);
      if (target && tacticId) {
        const wasSlacking = target.logic.state === 'slacking';
        applyTactic(target.logic, tacticId, target.archetype.rageSensitivity);
        target._lastKey = '';
        if (wasSlacking) g.combo += 1;
        if (g.diorama) g.diorama.pushIn(target.object3d, 1.2);
        if (g.audio) { g.audio.shout(tacticId); if (wasSlacking && g.combo >= 2) g.audio.combo(); }
      }
    }

    // production
    const active = workers.filter((w) => !w.logic.escaped);
    const output = crewOutputPerSecond(active.map((w) => w.logic));
    const res = advanceProgress(g.build, output, dt);
    g.build = { progress: res.progress, floorsBuilt: res.floorsBuilt };
    g.building.sync(res.floorsBuilt, res.progress / CONFIG.production.floorProgress);
    if (res.floorsCompletedThisStep > 0 && g.audio) g.audio.floorUp();

    // incidents + combo reset
    for (const w of workers) {
      if (w.justEscaped) { w.justEscaped = false; g.incidents += 1; g.combo = 0; if (g.audio) g.audio.alarm(); }
      if (w.justRiotted) { w.justRiotted = false; g.incidents += 1; g.combo = 0; if (g.audio) g.audio.alarm(); }
    }
    if (active.some((w) => w.logic.state === 'sabotage' || w.logic.state === 'fleeing' || w.logic.state === 'riot')) g.combo = 0;
    g.crewRemaining = active.length;

    // win / lose
    const verdict = evaluate({
      elapsed: g.elapsed, shiftSeconds: CONFIG.shiftSeconds,
      floorsBuilt: g.build.floorsBuilt, targetFloors: CONFIG.targetFloors,
      crewRemaining: g.crewRemaining, crewCollapseThreshold: CONFIG.crewCollapseThreshold,
    });
    if (verdict !== 'playing') { g.status = verdict; menu.showResult(verdict); }
  };

  startBtn.addEventListener('click', () => {
    audio.init();
    audio.resume();
    startGame(selectedMode);
  });

  console.log('[construction-game] ready');
}
```

> 주의(명칭/중복): `audio`와 `game.managers`는 위 정적 셋업에서 생성한다(`AudioManager`는 v1 main.js가 이미 import). DOM 시작 오버레이는 v1대로 `menuEl = document.getElementById('menu')`, `Menu` 인스턴스는 `menu`. **v1의 기존 `resetState`·로드시 월드 생성(Site 제외)·기존 `startBtn` 핸들러·기존 `game.step` 정의는 이 `startGame`/`buildWorld`/새 `game.step`으로 대체되므로 삭제**한다(중복 정의 금지). `index.html`의 `result-restart`/`R` 재시작은 v1 `Menu`가 `onRestart`를 호출 → 여기 `() => startGame(game.difficulty || selectedMode)`로 연결된다.

- [ ] **Step 4: e2e에 난이도 선택 스모크 추가** — `e2e/construction-game.spec.ts`의 세 번째 테스트(게임플레이 스모크) 시작부의 `await page.locator("#start-btn").click();` **앞에** 난이도 선택을 추가:

```ts
    await page.locator('#difficulty .diff-btn[data-mode="easy"]').click();
```

- [ ] **Step 5: 검증** — Run: `npm run test:e2e -- construction-game` (3/3, 콘솔 에러 0). `npm run lint`, `npm run test -- construction-game`(통과). 브라우저 수동: 난이도 버튼 선택 → 시작 시 해당 난이도(예: Easy=일꾼 6/240초/4층)로 게임 구성.

- [ ] **Step 6: 커밋**

```bash
git add public/construction-game/index.html public/construction-game/style.css public/construction-game/src/main.js e2e/construction-game.spec.ts
git commit -m "feat(construction): difficulty selection + startGame world refactor" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Phase E3 — 경제 (자금/페이롤/수입) + HUD

### Task 6: 경제 상태 + 수입 + HUD 자금 표시

**Files:**
- Modify: `public/construction-game/index.html`, `public/construction-game/style.css`
- Modify: `public/construction-game/src/ui/HUD.js`
- Modify: `public/construction-game/src/main.js`

- [ ] **Step 1: index.html HUD에 자금/페이롤 추가** — `#hud-score` 다음에:

```html
    <div id="hud-funds">💰 <span id="funds-val">0</span> <small>(-<span id="payroll-val">0</span>/s)</small></div>
```

- [ ] **Step 2: style.css** (파일 끝):

```css
#hud-funds { position: absolute; top: 86px; left: 16px; background: rgba(0,0,0,.45); padding: 6px 14px; border-radius: 20px; color: #ffd24a; font-weight: 700; }
#hud-funds small { color: #ff9d8a; font-weight: 600; }
```

- [ ] **Step 3: HUD.js에 자금/페이롤 표시 추가** — 생성자에 캐시 추가:
```js
    this.funds = document.getElementById('funds-val');
    this.payroll = document.getElementById('payroll-val');
```
`update(dt)` 본문 끝(combo 처리 다음)에 추가:
```js
    if (g.economy) {
      this.funds.textContent = Math.max(0, Math.floor(g.economy.funds));
      this.payroll.textContent = Math.round((g.managers || []).reduce((s, m) => s + m.salary, 0));
    }
```

- [ ] **Step 4: main.js 경제 와이어링** — import 추가(`AudioManager`는 v1에 이미 있으니 추가 금지):
```js
import { createEconomy, earn, tickEconomy } from './logic/economy.js';
```
(`audio`·`game.managers`는 Task 5의 정적 셋업에서 이미 생성됨 — 중복 생성 금지.)

`startGame(mode)` 안, `buildWorld()` 다음에 경제 생성:
```js
    game.economy = createEconomy(CONFIG.economy.startFunds);
```
`buildWorld()` 안에서 관리자도 초기화 (재시작 시 정리):
```js
    for (const m of (game.managers || [])) game.scene.remove(m.object3d);
    game.managers = [];
```
`game.step`에 경제 처리 추가 — production 블록의 `if (res.floorsCompletedThisStep > 0 ...)` 줄을 다음으로 확장(수입 지급):
```js
    if (res.floorsCompletedThisStep > 0) {
      if (g.economy) earn(g.economy, res.floorsCompletedThisStep * CONFIG.economy.floorReward);
      if (g.audio) g.audio.floorUp();
    }
```
그리고 `g.crewRemaining = active.length;` **다음**에 페이롤 처리 추가:
```js
    if (g.economy) {
      const fireIdx = tickEconomy(g.economy, g.managers, dt);
      if (fireIdx >= 0 && g.managers[fireIdx]) {
        const fired = g.managers.splice(fireIdx, 1)[0];
        game.scene.remove(fired.object3d);
        showToast(`💸 적자 — ${fired.label} 해고`);
      }
    }
```

- [ ] **Step 5: 검증** — Run: `npm run test:e2e -- construction-game`(3/3), `npm run lint`. 수동: 층 완공 시 자금 증가(💰), 관리자 0이라 페이롤 0. 콘솔 에러 0.

- [ ] **Step 6: 커밋**

```bash
git add public/construction-game/index.html public/construction-game/style.css public/construction-game/src/ui/HUD.js public/construction-game/src/main.js
git commit -m "feat(construction): economy state + floor income + funds HUD" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Phase E4 — AI 관리자 (엔티티 + 고용 UI + 통합)

### Task 7: entities/Manager.js (차별화 외형 + 순찰 + 자동 행동)

**Files:**
- Create: `public/construction-game/src/entities/Manager.js`

- [ ] **Step 1: Manager.js 작성**

```js
// public/construction-game/src/entities/Manager.js
import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { getManagerArchetype } from '../logic/managers.js';
import { pickManagerTarget } from '../logic/managers.js';
import { applyTactic } from '../logic/tactics.js';
import { getArchetype } from '../logic/archetypes.js';
import { decayRage } from '../logic/rage.js';

export class Manager {
  constructor(archetypeId) {
    const a = getManagerArchetype(archetypeId);
    this.archetypeId = archetypeId;
    this.archetype = a;
    this.label = a.label;
    this.salary = a.salary;
    this.object3d = new THREE.Group();

    // distinct placeholder look per archetype (color + helmet + a small prop)
    const bodyMat = new THREE.MeshLambertMaterial({ color: a.color, flatShading: true });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.1, 3, 6), bodyMat);
    body.position.y = 1.1;
    this.object3d.add(body);
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: a.helmet, flatShading: true })
    );
    helmet.position.y = 1.95;
    this.object3d.add(helmet);
    // role tag sprite (emoji) so the archetype reads at a glance
    this.object3d.add(makeTagSprite(a.icon));

    this.position = this.object3d.position;
    this.position.set(0, 0, -10 + Math.random() * 4);
    this.cooldownTimer = 0;
    this._wander = Math.random() * 6.28;
  }

  setModel(obj) {
    this.object3d.clear();
    obj.position.y = 0;
    this.object3d.add(obj);
  }

  update(dt, game) {
    const a = this.archetype;
    const p = this.position;
    // gentle patrol around the site centre
    this._wander += dt * 0.6;
    const tx = Math.cos(this._wander) * 10, tz = -4 + Math.sin(this._wander) * 8;
    p.x += (tx - p.x) * Math.min(1, dt * 0.5);
    p.z += (tz - p.z) * Math.min(1, dt * 0.5);
    this.object3d.rotation.y = Math.atan2(tx - p.x, tz - p.z);

    const workers = game.workers || [];
    if (a.passive) {
      // vibe: accelerate rage cooldown + delay slacking for workers in radius
      for (const w of workers) {
        if (w.logic.escaped) continue;
        const dx = w.position.x - p.x, dz = w.position.z - p.z;
        if (dx * dx + dz * dz <= a.radius * a.radius) {
          decayRage(w.logic, dt * 1.5);
          if (w.logic.activity === 'working') w.logic.slackTimer += dt * 0.5;
        }
      }
      return;
    }

    // active managers: auto-apply their tactic on cooldown
    this.cooldownTimer -= dt;
    if (this.cooldownTimer > 0) return;
    const flat = workers.map((w) => ({ x: w.position.x, z: w.position.z, state: w.logic.state, escaped: w.logic.escaped }));
    const idx = pickManagerTarget(p, a, flat);
    if (idx < 0) return;
    this.cooldownTimer = a.cooldown;
    if (a.successRate < 1 && Math.random() > a.successRate) return; // intern sometimes misses
    const target = workers[idx];
    applyTactic(target.logic, a.tactic, getArchetype(target.logic.archetypeId).rageSensitivity);
    target._lastKey = '';
  }
}

function makeTagSprite(emoji) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '44px serif'; ctx.textAlign = 'center'; ctx.fillText(emoji, 32, 46);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(1.4, 1.4, 1); sprite.position.y = 2.7;
  return sprite;
}
```

- [ ] **Step 2: 커밋** (아직 미사용 — 독립 모듈)

```bash
git add public/construction-game/src/entities/Manager.js
git commit -m "feat(construction): AI manager entity (distinct look, patrol, auto-tactic, passive)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: ui/HireMenu.js + 고용 통합

**Files:**
- Create: `public/construction-game/src/ui/HireMenu.js`
- Modify: `public/construction-game/index.html`, `public/construction-game/style.css`
- Modify: `public/construction-game/src/main.js`
- Modify: `e2e/construction-game.spec.ts`

- [ ] **Step 1: index.html에 고용 패널 + 열기 버튼 DOM 추가** — `#toast` 앞에:

```html
  <button id="hire-toggle" class="hidden">👔 관리자 고용 (H)</button>
  <div id="hire-panel" class="hidden">
    <div class="hire-head">관리자 고용 — 자금 💰 <span id="hire-funds">0</span></div>
    <div id="hire-list"></div>
    <button id="hire-close">닫기</button>
  </div>
```

- [ ] **Step 2: style.css** (파일 끝):

```css
#hire-toggle { position: fixed; right: 16px; bottom: 16px; z-index: 6; padding: 10px 16px; border: none; border-radius: 12px;
  background: linear-gradient(135deg,#ffd24a,#ff9d2e); color: #2a1c08; font-weight: 800; cursor: pointer; }
#hire-panel { position: fixed; right: 16px; bottom: 64px; z-index: 7; width: 300px; max-height: 70vh; overflow:auto;
  background: rgba(10,12,16,.95); border: 1px solid rgba(255,200,90,.35); border-radius: 14px; padding: 14px; color: #fff; }
.hire-head { font-weight: 800; color: #ffd24a; margin-bottom: 10px; }
.hire-card { border: 1px solid #2a2e35; border-radius: 10px; padding: 10px; margin-bottom: 8px; }
.hire-card h4 { margin-bottom: 4px; }
.hire-card p { font-size: 12px; opacity: .85; line-height: 1.5; }
.hire-card button { margin-top: 6px; width: 100%; padding: 7px 0; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;
  background: linear-gradient(135deg,#ffd24a,#ff9d2e); color: #2a1c08; }
.hire-card button:disabled { background: #555; color: #999; cursor: not-allowed; }
#hire-close { width: 100%; margin-top: 4px; padding: 8px 0; border: none; border-radius: 8px; background: #444; color: #fff; cursor: pointer; }
```

- [ ] **Step 3: HireMenu.js 작성**

```js
// public/construction-game/src/ui/HireMenu.js
import { MANAGER_LIST } from '../logic/managers.js';
import { CONFIG } from '../logic/config.js';
import { canAfford } from '../logic/economy.js';

export class HireMenu {
  constructor(game, onHire) {
    this.game = game;
    this.onHire = onHire;
    this.toggle = document.getElementById('hire-toggle');
    this.panel = document.getElementById('hire-panel');
    this.fundsEl = document.getElementById('hire-funds');
    this.listEl = document.getElementById('hire-list');
    this.open = false;

    this._renderList();
    this.toggle.addEventListener('click', () => this.setOpen(!this.open));
    document.getElementById('hire-close').addEventListener('click', () => this.setOpen(false));
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH' && this.game.status === 'playing') this.setOpen(!this.open);
    });
  }

  _renderList() {
    this.listEl.innerHTML = '';
    for (const a of MANAGER_LIST) {
      const card = document.createElement('div');
      card.className = 'hire-card';
      card.innerHTML =
        `<h4>${a.icon} ${a.label}</h4>` +
        `<p>${describe(a)}<br>고용비 💰${a.hireCost} · 월급 ${a.salary}/s</p>` +
        `<button data-id="${a.id}">고용</button>`;
      card.querySelector('button').addEventListener('click', () => this.onHire(a.id));
      this.listEl.appendChild(card);
    }
  }

  setOpen(on) {
    this.open = on;
    this.panel.classList.toggle('hidden', !on);
  }

  // call when funds change / panel open to refresh affordability
  refresh() {
    const econ = this.game.economy;
    const cap = (this.game.managers || []).length >= CONFIG.economy.managerCap;
    this.fundsEl.textContent = econ ? Math.max(0, Math.floor(econ.funds)) : 0;
    this.listEl.querySelectorAll('button[data-id]').forEach((btn) => {
      const a = MANAGER_LIST.find((m) => m.id === btn.getAttribute('data-id'));
      btn.disabled = cap || !econ || !canAfford(econ, a.hireCost);
    });
  }

  show() { this.toggle.classList.remove('hidden'); }
  hide() { this.toggle.classList.add('hidden'); this.setOpen(false); }
}

function describe(a) {
  if (a.id === 'veteran') return '순찰 + 자동 달래기(넓은 반경), 빡침 억제';
  if (a.id === 'drill') return '자동 윽박, 생산성↑↑·빡침↑ (다혈질 주의)';
  if (a.id === 'vibe') return '반경 내 빡침 감소 가속 + 농땡이 지연(패시브)';
  return '저렴·느림, 가끔 실수 (가성비)';
}
```

- [ ] **Step 4: main.js 고용 통합** — import 추가:
```js
import { Manager } from './entities/Manager.js';
import { HireMenu } from './ui/HireMenu.js';
import { spend } from './logic/economy.js';
import { getManagerArchetype } from './logic/managers.js';
```
정적 셋업에 HireMenu 생성 (HUD push 다음):
```js
  const hireMenu = new HireMenu(game, (id) => {
    const a = getManagerArchetype(id);
    if ((game.managers.length >= CONFIG.economy.managerCap) || !game.economy || !spend(game.economy, a.hireCost)) return;
    const m = game.add(new Manager(id));
    game.managers.push(m);
    if (game.audio) game.audio.combo();
    hireMenu.refresh();
  });
  game.hireMenu = hireMenu;
```
`startGame(mode)`에서 게임 시작 시 고용 버튼 노출 + 갱신 (hud 표시 줄 다음):
```js
    hireMenu.show();
    hireMenu.refresh();
```
`game.step` 끝(페이롤 처리 다음)에 고용 패널 가용성 주기 갱신:
```js
    if (g.hireMenu && g.hireMenu.open) g.hireMenu.refresh();
```
관리자는 `game.add()`로 systems에 들어가 매 프레임 `update(dt, game)`가 호출된다(Manager.update 시그니처와 일치). 결과/일시정지 시 멈춤은 v1 `game.stop()`이 루프를 멈추므로 자동 처리. 결과 화면 진입 시 고용 버튼 숨김 — `Menu.showResult`는 v1 파일이므로, main.js에서 감싸지 말고 `game.step`의 `if (verdict !== 'playing')` 블록에 추가:
```js
    if (verdict !== 'playing') { g.status = verdict; if (g.hireMenu) g.hireMenu.hide(); menu.showResult(verdict); }
```

- [ ] **Step 5: e2e 고용 스모크** — 게임플레이 스모크 테스트에서 시작 후 키 시퀀스에 고용 흐름 추가. 기존 `for (const key of [...])` 루프 다음에:
```ts
    await page.locator('#hire-toggle').click();
    const firstHire = page.locator('#hire-list .hire-card button:not([disabled])').first();
    if (await firstHire.count()) await firstHire.click();
    await page.waitForTimeout(800);
```
(자금이 부족하면 버튼이 비활성이라 클릭 안 함 — 그래도 패널 열기/렌더가 무오류인지 확인.)

- [ ] **Step 6: 검증** — Run: `npm run test:e2e -- construction-game`(3/3, 콘솔 0). `npm run lint`, `npm run test -- construction-game`. 수동: H 또는 버튼으로 고용 패널 → 자금 충분 시 고용 → 차별화된 관리자가 순찰하며 자동으로 일꾼 관리, 페이롤 차감, 적자 시 해고 토스트.

- [ ] **Step 7: 커밋**

```bash
git add public/construction-game/index.html public/construction-game/style.css public/construction-game/src/ui/HireMenu.js public/construction-game/src/main.js e2e/construction-game.spec.ts
git commit -m "feat(construction): manager hiring UI + integration (spawn/payroll/auto-fire)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Phase E5 — 마감 (밸런스·문서·게이트)

### Task 9: 밸런스 패스 + 문서 갱신 + 최종 게이트

**Files:**
- Modify: `docs/superpowers/specs/2026-06-04-tantrum-tower-expansion-design.md`
- Modify: `README.md`

- [ ] **Step 1: 스토리 파일 §1 상태 갱신** — S1/S2/S3 상태를 `✅ 완료`로, 비고에 "PR/브랜치"를 기입.

- [ ] **Step 2: README** — Tantrum Tower 항목에 "경제·AI 관리자 고용·난이도 모드" 한 줄 추가(기존 양식 유지).

- [ ] **Step 3: 밸런스 수동 점검(육안)** — `npm run dev`:
  - [ ] Easy/Normal/Hard가 체감상 구분되는가(인원·시간·자금·농땡이 빈도)
  - [ ] 관리자 4종이 **외형으로 구분**되고 효과가 다른가(베테랑=안정, 군기=생산↑빡침↑, 인싸=패시브 진정, 인턴=싸고 가끔 실수)
  - [ ] 자금 흐름이 합리적인가(층 보상 vs 월급) — 과도하면 `config.economy`/`managers.js` 수치 조정(이 태스크에서 튜닝 가능)
  - [ ] 적자 시 해고가 동작하고 즉시 패배가 아닌가
  - [ ] 관리자 고용으로 난이도가 실제로 완화되는가

- [ ] **Step 4: 전체 게이트** — Run 모두 통과 확인:
```bash
npm run lint
npm run type-check
npm run test
npm run test:e2e -- construction-game
```
Expected: lint·type-check 클린; 단위 전부(신규 difficulty/economy/managers 포함); e2e 3/3 콘솔 0.

- [ ] **Step 5: 커밋**

```bash
git add docs/superpowers/specs/2026-06-04-tantrum-tower-expansion-design.md README.md
git commit -m "docs(construction): mark S1-S3 done + README; balance pass" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 마감 (구현 완료 후)

`superpowers:finishing-a-development-branch`로 마무리 — PR 생성(권장: 별도 PR, base는 v1 PR #13 머지 여부에 따라 `main` 또는 v1 브랜치) 또는 사용자 선택. 이후 다음 스토리(S4 다중 건물 또는 S5 에셋 패스)로 진행.

---

## 셀프 리뷰 결과 (writing-plans 체크리스트)

**1. 스펙 커버리지:** 스토리파일 §2.1 경제→Task 1(config)·2(economy)·6(수입/HUD/페이롤). §2.2 관리자 4종(동작·비용·외형·퀴크)→Task 3(로직)·7(엔티티 차별화 외형)·8(고용 UI/통합). §2.3 난이도 모드+레버→Task 1(difficulty)·4(slackMult)·5(선택 UI/리팩터). §2.4 튜닝상수→Task 1·3. §2.5 코드영향(신규 로직3·엔진/UI·재사용·CI)→전 태스크. 에셋/오디오(S5/S7)는 본 계획 비범위(스토리파일에 잠금만). **갭 없음.**

**2. 플레이스홀더 스캔:** 모든 코드 단계 완전 코드. Task 5의 "audio 정의 전" 주의는 플레이스홀더가 아니라 **명시된 순서 의존성**(E2↔E3 연속 구현 권장)이며 Task 6에서 audio가 정적 셋업에 추가됨을 정확히 지시. 밸런스 수치 조정은 Task 9의 의도된 튜닝 단계.

**3. 타입 일관성:** economy API(createEconomy/earn/canAfford/spend/payrollPerSec/tickEconomy)·managers API(MANAGER_ARCHETYPES/MANAGER_LIST/getManagerArchetype/pickManagerTarget)·difficulty(DIFFICULTY_MODES/applyDifficulty)를 §계약에 고정하고 전 태스크에서 동일 사용. `pickManagerTarget`은 평문 `{x,z,state,escaped}` 배열을 받고(Manager.update가 매핑), 관리자 인스턴스는 `{archetypeId,salary,position,cooldownTimer,label}`을 보유(economy.payroll/tickEconomy가 `.salary` 읽음, HireMenu가 `.length`/cap). `Manager.update(dt, game)` 시그니처는 v1 systems 루프(`s.update(dt, this)`)와 일치. `game.economy`/`game.managers`/`game.difficulty`/`game.hireMenu` 명칭 일관.
