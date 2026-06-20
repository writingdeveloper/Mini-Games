# 마키마 says Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-player "Simon says" reaction game at `/makima-says` where 마키마(obey) and 레제(resist) alternate directional voice commands.

**Architecture:** Static ESM game under `public/makima-says/` (matches ppopgi/desert/escape): pure logic in `src/logic.js` (unit-tested), audio in `src/audio.js`, wiring/render in `src/main.js`, markup/styles in `index.html`. A thin client route (`app/makima-says/page.tsx`) iframes it; a hub card links to it. Voice WAVs are pre-synthesized via voice-studio MCP and served statically (no runtime MCP).

**Tech Stack:** Next.js (thin route), vanilla ESM + DOM/CSS for the game, Vitest (unit), Playwright (e2e), voice-studio MCP (build-time audio).

---

### Task 1: Pre-synthesize voice clips (MCP, build-time)

**Files:**
- Create: `public/makima-says/audio/*.wav` (14 clips)

- [ ] **Step 1: Create the audio dir**

Run: `mkdir -p public/makima-says/audio`

- [ ] **Step 2: Synthesize 마키마 clips** (voice `마키마-v2`, lang `ko`)

Call `mcp__voice-studio__synthesize_voice` once per line, `output_path` under `public/makima-says/audio/`:

| output file | text | speed |
|---|---|---|
| `makima-left.wav` | `왼쪽.` | 1.0 |
| `makima-right.wav` | `오른쪽.` | 1.0 |
| `makima-up.wav` | `위.` | 1.0 |
| `makima-down.wav` | `아래.` | 1.0 |
| `makima-intro.wav` | `나에게 복종해. 시작할게.` | 1.0 |
| `makima-good.wav` | `좋아. 잘했어.` | 1.0 |
| `makima-fail.wav` | `실망이야.` | 1.0 |

- [ ] **Step 3: Synthesize 레제 clips** (voice `레제`, lang `ko`)

| output file | text | speed |
|---|---|---|
| `reze-left.wav` | `왼쪽이야~` | 1.05 |
| `reze-right.wav` | `오른쪽~` | 1.05 |
| `reze-up.wav` | `위로!` | 1.05 |
| `reze-down.wav` | `아래로~` | 1.05 |
| `reze-intro.wav` | `나랑 놀자, 응?` | 1.05 |
| `reze-tempt.wav` | `눌러봐~ 괜찮아.` | 1.05 |
| `reze-laugh.wav` | `걸려들었네. 펑!` | 1.05 |

- [ ] **Step 4: Verify all 14 files exist**

Run: `ls public/makima-says/audio | wc -l`
Expected: `14`

- [ ] **Step 5: Commit**

```bash
git add public/makima-says/audio
git commit -m "feat(makima-says): pre-synthesized 마키마/레제 voice clips"
```

---

### Task 2: Pure game logic + unit tests

**Files:**
- Create: `public/makima-says/src/logic.js`
- Test: `__tests__/unit/makima-says/logic.test.ts`
- Modify: `vitest.config.ts` (add coverage include)

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/makima-says/logic.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  DIRS, mulberry32, reactionWindow, rezeChance, comboMult, scoreFor,
  nextCommand, judge,
} from "../../../public/makima-says/src/logic.js";

describe("makima-says logic", () => {
  it("reactionWindow shrinks with round, floored at 0.55", () => {
    expect(reactionWindow(0)).toBeCloseTo(1.4);
    expect(reactionWindow(5)).toBeLessThan(reactionWindow(2));
    expect(reactionWindow(100)).toBeCloseTo(0.55);
  });

  it("rezeChance rises with round, capped at 0.45", () => {
    expect(rezeChance(0)).toBeCloseTo(0.25);
    expect(rezeChance(100)).toBeCloseTo(0.45);
    expect(rezeChance(10)).toBeGreaterThan(rezeChance(2));
  });

  it("comboMult ramps from 1 and caps at 4", () => {
    expect(comboMult(0)).toBe(1);
    expect(comboMult(1)).toBe(1);
    expect(comboMult(3)).toBeCloseTo(2);
    expect(comboMult(100)).toBe(4);
  });

  it("scoreFor multiplies base 100 by comboMult", () => {
    expect(scoreFor(1)).toBe(100);
    expect(scoreFor(3)).toBe(200);
  });

  it("judge: makima → must input the shown direction", () => {
    expect(judge({ speaker: "makima", dir: "left" }, "left")).toBe("hit");
    expect(judge({ speaker: "makima", dir: "left" }, "right")).toBe("miss");
    expect(judge({ speaker: "makima", dir: "left" }, null)).toBe("miss");
  });

  it("judge: reze → must NOT input anything", () => {
    expect(judge({ speaker: "reze", dir: "up" }, null)).toBe("hit");
    expect(judge({ speaker: "reze", dir: "up" }, "up")).toBe("miss");
    expect(judge({ speaker: "reze", dir: "up" }, "down")).toBe("miss");
  });

  it("nextCommand is deterministic for a given seed and emits valid shape", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c1 = nextCommand(0, a);
    const c2 = nextCommand(0, b);
    expect(c1).toEqual(c2);
    expect(["makima", "reze"]).toContain(c1.speaker);
    expect(DIRS).toContain(c1.dir);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/makima-says/logic.test.ts`
Expected: FAIL — cannot resolve `logic.js`.

- [ ] **Step 3: Write the implementation**

Create `public/makima-says/src/logic.js`:

```js
// Pure, dependency-free logic for /makima-says (unit-testable; no DOM/audio).

export const DIRS = ["up", "down", "left", "right"];

// Deterministic RNG so round sequences are reproducible in tests/QA.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Reaction window (seconds): starts forgiving, tightens each round, never below 0.55.
export function reactionWindow(round) {
  return Math.max(0.55, 1.4 - round * 0.06);
}

// Probability the temptress 레제 (not 마키마) gives this round's command.
export function rezeChance(round) {
  return Math.min(0.45, 0.25 + round * 0.01);
}

// Consecutive-success multiplier: 1 → ×1, then +0.5 per streak step, capped ×4.
export function comboMult(combo) {
  return Math.min(4, 1 + Math.max(0, combo - 1) * 0.5);
}

// Points for landing a round at the given (post-increment) combo.
export function scoreFor(combo) {
  return Math.round(100 * comboMult(combo));
}

// Build the next command from the round index and an RNG.
export function nextCommand(round, rng) {
  const speaker = rng() < rezeChance(round) ? "reze" : "makima";
  const dir = DIRS[Math.floor(rng() * DIRS.length) % DIRS.length];
  return { speaker, dir };
}

// Verdict for a finished round. input = direction string, or null if nothing was pressed.
//   마키마 → obey: press the shown direction.
//   레제   → resist: press nothing.
export function judge(command, input) {
  if (command.speaker === "makima") return input === command.dir ? "hit" : "miss";
  return input === null ? "hit" : "miss";
}
```

- [ ] **Step 4: Add coverage include**

Modify `vitest.config.ts` — add to the `include` array under `coverage`:

```ts
        'public/makima-says/src/**',
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/makima-says/logic.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add public/makima-says/src/logic.js __tests__/unit/makima-says/logic.test.ts vitest.config.ts
git commit -m "feat(makima-says): pure round/judge/combo logic + unit tests"
```

---

### Task 3: Audio module

**Files:**
- Create: `public/makima-says/src/audio.js`

- [ ] **Step 1: Write the implementation**

Create `public/makima-says/src/audio.js`. Preloads the 14 clips, plays one at a time, supports mute (persisted), and synthesizes SFX (correct ding / explosion) via WebAudio so no extra clips are needed.

```js
// Audio for /makima-says: voice clip playback (preloaded) + WebAudio SFX + mute.

const VOICE_FILES = {
  "makima-up": "up", "makima-down": "down", "makima-left": "left", "makima-right": "right",
  "makima-intro": "intro", "makima-good": "good", "makima-fail": "fail",
  "reze-up": "up", "reze-down": "down", "reze-left": "left", "reze-right": "right",
  "reze-intro": "intro", "reze-tempt": "tempt", "reze-laugh": "laugh",
};

const MUTE_KEY = "makima-says-muted";

export function createAudio() {
  const clips = {};
  for (const name of Object.keys(VOICE_FILES)) {
    const a = new Audio(`/makima-says/audio/${name}.wav`);
    a.preload = "auto";
    clips[name] = a;
  }
  let muted = localStorage.getItem(MUTE_KEY) === "1";
  let current = null;
  let ctx = null;

  const audioCtx = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

  function playVoice(speaker, key) {
    if (muted) return;
    const clip = clips[`${speaker}-${key}`];
    if (!clip) return;
    if (current && !current.paused) { current.pause(); current.currentTime = 0; }
    clip.currentTime = 0;
    current = clip;
    clip.play().catch(() => {});
  }

  function tone(freq, dur, type = "sine", gain = 0.2) {
    if (muted) return;
    const c = audioCtx();
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }

  function ding() { tone(880, 0.12, "triangle", 0.18); tone(1320, 0.14, "triangle", 0.12); }

  function boom() {
    if (muted) return;
    const c = audioCtx();
    const buf = c.createBuffer(1, c.sampleRate * 0.4, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.setValueAtTime(0.5, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.4);
    src.connect(g); g.connect(c.destination); src.start();
  }

  function setMuted(m) { muted = m; localStorage.setItem(MUTE_KEY, m ? "1" : "0"); }
  function isMuted() { return muted; }

  return { playVoice, ding, boom, setMuted, isMuted, resume: () => audioCtx().resume() };
}
```

- [ ] **Step 2: Commit**

```bash
git add public/makima-says/src/audio.js
git commit -m "feat(makima-says): audio module (voice clips + WebAudio SFX + mute)"
```

---

### Task 4: Game shell (HTML + styles)

**Files:**
- Create: `public/makima-says/index.html`

- [ ] **Step 1: Write the markup + styles**

Create `public/makima-says/index.html`. Two character panels (마키마 left, 레제 right), center target glyph + countdown ring, HUD (combo/score/lives/best), on-screen direction pad, mute button, start/result overlays, aria-live caption. Loads `src/main.js` as a module.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>마키마 says</title>
  <style>
    :root { --makima:#d9b44a; --reze:#ff5fae; --bg:#0c0712; }
    html,body{margin:0;height:100%;overflow:hidden;background:var(--bg);color:#fff;
      font-family:system-ui,sans-serif;-webkit-user-select:none;user-select:none;}
    #stage{position:fixed;inset:0;display:flex;flex-direction:column;}
    #panels{flex:1;display:flex;}
    .panel{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:10px;opacity:.35;transition:opacity .12s,filter .12s;filter:grayscale(.5);}
    .panel.active{opacity:1;filter:none;}
    .panel .face{font-size:84px;line-height:1;}
    .panel .who{font-weight:900;font-size:20px;letter-spacing:1px;}
    #m-panel{background:radial-gradient(circle at 50% 40%,rgba(217,180,74,.18),transparent 70%);}
    #m-panel .who{color:var(--makima);}
    #r-panel{background:radial-gradient(circle at 50% 40%,rgba(255,95,174,.18),transparent 70%);}
    #r-panel .who{color:var(--reze);}
    #center{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;}
    #glyph{font-size:120px;font-weight:900;line-height:1;text-shadow:0 0 24px rgba(255,255,255,.5);}
    #ring{width:160px;height:160px;margin:8px auto 0;border-radius:50%;
      border:8px solid rgba(255,255,255,.15);border-top-color:#fff;}
    #caption{position:fixed;left:50%;bottom:170px;transform:translateX(-50%);
      font-size:18px;font-weight:800;background:rgba(0,0,0,.55);padding:8px 16px;border-radius:12px;
      text-align:center;max-width:90vw;}
    #hud{position:fixed;top:10px;left:50%;transform:translateX(-50%);display:flex;gap:14px;
      background:rgba(0,0,0,.5);padding:8px 16px;border-radius:14px;font-weight:800;font-size:15px;z-index:5;}
    #hud .lives{color:#ff6b6b;letter-spacing:2px;}
    #hud #combo.hot{color:#ffb14d;text-shadow:0 0 10px rgba(255,160,60,.7);}
    #mute{position:fixed;top:10px;right:12px;z-index:6;background:rgba(0,0,0,.5);border:0;color:#fff;
      font-size:20px;width:42px;height:42px;border-radius:12px;cursor:pointer;}
    #home{position:fixed;top:10px;left:12px;z-index:6;background:rgba(0,0,0,.5);color:#fff;
      text-decoration:none;font-size:13px;font-weight:700;padding:10px 12px;border-radius:12px;}
    #pad{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);display:grid;
      grid-template-columns:repeat(3,64px);grid-template-rows:repeat(3,64px);gap:8px;z-index:5;}
    #pad button{border:2px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;
      font-size:26px;border-radius:14px;cursor:pointer;touch-action:manipulation;}
    #pad button:active{background:rgba(255,255,255,.25);}
    #pad .up{grid-area:1/2;} #pad .left{grid-area:2/1;} #pad .right{grid-area:2/3;} #pad .down{grid-area:3/2;}
    .overlay{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:18px;background:rgba(8,4,16,.92);z-index:10;text-align:center;padding:24px;}
    .overlay.off{display:none;}
    .overlay h1{font-size:40px;margin:0;}
    .overlay p{margin:0;opacity:.85;max-width:520px;line-height:1.6;}
    .overlay button{font-size:20px;font-weight:900;padding:14px 32px;border:0;border-radius:16px;cursor:pointer;
      background:linear-gradient(135deg,var(--makima),var(--reze));color:#1a0f10;}
    #flash{position:fixed;inset:0;pointer-events:none;opacity:0;transition:opacity .1s;
      background:radial-gradient(circle,rgba(255,40,40,0) 40%,rgba(255,30,30,.55) 100%);}
    .shake{animation:sh .3s;}
    @keyframes sh{0%,100%{transform:translate(0,0)}25%{transform:translate(-8px,4px)}75%{transform:translate(8px,-4px)}}
    @media (prefers-reduced-motion: reduce){#ring{animation:none!important}.shake{animation:none}}
  </style>
</head>
<body>
  <a id="home" href="/">← 홈</a>
  <button id="mute" aria-label="음소거 토글">🔊</button>
  <div id="stage">
    <div id="hud" role="status" aria-live="off">
      <span>점수 <span id="score">0</span></span>
      <span id="combo">콤보 <span id="combo-n">0</span></span>
      <span class="lives" id="lives" aria-label="라이프">💣💣💣</span>
      <span>최고 <span id="best">0</span></span>
    </div>
    <div id="panels">
      <div class="panel" id="m-panel"><div class="face">🔴</div><div class="who">마키마 · 복종</div></div>
      <div class="panel" id="r-panel"><div class="face">💣</div><div class="who">레제 · 거부</div></div>
    </div>
    <div id="center"><div id="glyph"></div><div id="ring"></div></div>
    <div id="caption" aria-live="polite"></div>
    <div id="pad" role="group" aria-label="방향 입력">
      <button class="up" data-dir="up" aria-label="위">⬆️</button>
      <button class="left" data-dir="left" aria-label="왼쪽">⬅️</button>
      <button class="right" data-dir="right" aria-label="오른쪽">➡️</button>
      <button class="down" data-dir="down" aria-label="아래">⬇️</button>
    </div>
  </div>
  <div id="flash"></div>
  <div class="overlay" id="start">
    <h1>마키마 <span style="color:var(--reze)">says</span></h1>
    <p><b style="color:var(--makima)">마키마</b>가 말하면 그 방향을 누르세요(복종).<br>
       <b style="color:var(--reze)">레제</b>가 말하면 <b>아무것도 누르지 마세요</b>(유혹 거부).<br>
       방향키 ← ↑ ↓ → 또는 화면 버튼. 라이프 3개.</p>
    <button id="startbtn">시작</button>
  </div>
  <div class="overlay off" id="result">
    <h1 id="result-title">게임 오버</h1>
    <p id="result-sub"></p>
    <button id="replaybtn">다시 하기</button>
  </div>
  <script type="module" src="./src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/makima-says/index.html
git commit -m "feat(makima-says): game shell (panels, HUD, pad, overlays)"
```

---

### Task 5: Game wiring (main.js)

**Files:**
- Create: `public/makima-says/src/main.js`

- [ ] **Step 1: Write the implementation**

Create `public/makima-says/src/main.js`. State machine: idle → round (show command, play voice, open reaction window) → judge → next/gameover. Binds keyboard + pad, exposes `window.__makima` for e2e/QA.

```js
import { DIRS, mulberry32, reactionWindow, rezeChance, comboMult, scoreFor, nextCommand, judge } from "./logic.js";
import { createAudio } from "./audio.js";

const GLYPH = { up: "⬆️", down: "⬇️", left: "⬅️", right: "➡️" };
const $ = (id) => document.getElementById(id);
const audio = createAudio();

let rng, round, score, combo, best = 0, lives, command, accepting, inputLocked, timer, raf, ringStart;

const state = { running: false };
window.__makima = {
  get command() { return command; },
  get combo() { return combo; },
  get lives() { return lives; },
  get score() { return score; },
  get running() { return state.running; },
  // test hook: force a deterministic command and resolve a given input
  _forceInput(dir) { handleInput(dir); },
};

function setActivePanel(speaker) {
  $("m-panel").classList.toggle("active", speaker === "makima");
  $("r-panel").classList.toggle("active", speaker === "reze");
}

function renderHud() {
  $("score").textContent = score;
  $("combo-n").textContent = combo;
  $("combo").classList.toggle("hot", combo >= 3);
  $("best").textContent = best;
  $("lives").textContent = "💣".repeat(Math.max(0, lives)) || "—";
}

function start() {
  audio.resume();
  rng = mulberry32(((performance.now() | 0) ^ 0x9e3779b9) >>> 0);
  round = 0; score = 0; combo = 0; lives = 3;
  state.running = true;
  $("start").classList.add("off");
  $("result").classList.add("off");
  renderHud();
  nextRound();
}

function nextRound() {
  command = nextCommand(round, rng);
  accepting = true; inputLocked = false;
  setActivePanel(command.speaker);
  $("glyph").textContent = GLYPH[command.dir];
  $("caption").textContent = `${command.speaker === "makima" ? "마키마" : "레제"}: ${labelDir(command.dir)}`;
  audio.playVoice(command.speaker, command.dir);

  const win = reactionWindow(round) * 1000;
  ringStart = performance.now();
  animateRing(win);
  timer = setTimeout(() => resolve(null), win);
}

function labelDir(d) { return { up: "위", down: "아래", left: "왼쪽", right: "오른쪽" }[d]; }

function animateRing(win) {
  cancelAnimationFrame(raf);
  const tick = () => {
    const p = Math.min(1, (performance.now() - ringStart) / win);
    $("ring").style.borderTopColor = `hsl(${(1 - p) * 120}, 90%, 60%)`;
    $("ring").style.transform = `rotate(${p * 360}deg)`;
    if (accepting && p < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

function handleInput(dir) {
  if (!state.running || !accepting || inputLocked) return;
  inputLocked = true;
  clearTimeout(timer);
  resolve(dir);
}

function resolve(input) {
  if (!accepting) return;
  accepting = false;
  cancelAnimationFrame(raf);
  const verdict = judge(command, input);
  if (verdict === "hit") {
    combo += 1;
    score += scoreFor(combo);
    best = Math.max(best, combo);
    audio.ding();
    flashOk();
    renderHud();
    round += 1;
    setTimeout(nextRound, 420);
  } else {
    combo = 0;
    lives -= 1;
    audio.boom();
    if (command.speaker === "reze") audio.playVoice("reze", "laugh");
    else audio.playVoice("makima", "fail");
    flashBad();
    renderHud();
    if (lives <= 0) return setTimeout(gameOver, 700);
    round += 1;
    setTimeout(nextRound, 800);
  }
}

function flashOk() { $("glyph").style.color = "#5dff8f"; setTimeout(() => ($("glyph").style.color = "#fff"), 200); }
function flashBad() {
  const f = $("flash"); f.style.opacity = "1"; setTimeout(() => (f.style.opacity = "0"), 160);
  $("stage").classList.add("shake"); setTimeout(() => $("stage").classList.remove("shake"), 300);
}

function gameOver() {
  state.running = false;
  setActivePanel(null);
  $("glyph").textContent = "";
  $("result-title").textContent = "💥 게임 오버";
  $("result-sub").textContent = `점수 ${score} · 최고 콤보 ${best} · ${round}라운드 버팀`;
  $("result").classList.remove("off");
}

// ---- input bindings ----
const KEYMAP = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
window.addEventListener("keydown", (e) => {
  if (KEYMAP[e.key]) { e.preventDefault(); handleInput(KEYMAP[e.key]); }
});
$("pad").querySelectorAll("button").forEach((b) =>
  b.addEventListener("click", () => handleInput(b.dataset.dir)));
$("startbtn").addEventListener("click", start);
$("replaybtn").addEventListener("click", start);
$("mute").addEventListener("click", () => {
  audio.setMuted(!audio.isMuted());
  const btn = $("mute");
  btn.textContent = audio.isMuted() ? "🔇" : "🔊";
  btn.setAttribute("aria-pressed", String(audio.isMuted()));
});
$("mute").textContent = audio.isMuted() ? "🔇" : "🔊";
```

- [ ] **Step 2: Commit**

```bash
git add public/makima-says/src/main.js
git commit -m "feat(makima-says): game wiring (round loop, input, judge, gameover)"
```

---

### Task 6: Route + hub card

**Files:**
- Create: `app/makima-says/page.tsx`
- Modify: `app/page.tsx` (add card after the ppopgi card, ~line 140)

- [ ] **Step 1: Create the route**

Create `app/makima-says/page.tsx` (mirror `app/ppopgi/page.tsx`):

```tsx
"use client";

import { useState } from "react";
import { LoadingOverlay } from "@/app/_components/LoadingOverlay";

export default function MakimaSaysGame() {
  const [loading, setLoading] = useState(true);
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {loading && <LoadingOverlay />}
      <iframe
        src="/makima-says/index.html"
        className="h-full w-full border-0"
        title="마키마 says"
        allow="autoplay; fullscreen"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
```

(The in-game `← 홈` link handles navigation back; no extra overlay link needed.)

- [ ] **Step 2: Add the hub card**

In `app/page.tsx`, after the ppopgi `</Link>` (before the closing `</div>` of the grid), insert:

```tsx
          {/* 마키마 says 카드 */}
          <Link href="/makima-says" aria-label="마키마 says 복종 게임 플레이하기">
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-600 to-amber-500 p-8 shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-rose-500/50 cursor-pointer">
              <div aria-hidden="true" className="absolute -right-8 -top-8 text-9xl opacity-20">
                💣
              </div>
              <div className="relative z-10">
                <h2 className="mb-3 text-3xl font-bold text-white">마키마 says</h2>
                <p className="mb-4 text-white/90">
                  마키마에겐 복종, 레제의 유혹은 거부하세요!
                </p>
                <ul className="mb-6 space-y-2 text-sm text-white/80">
                  <li>✓ 두 악마의 음성 명령</li>
                  <li>✓ 사이먼 says 반응 게임</li>
                  <li>✓ 방향키 · 터치 조작</li>
                </ul>
                <div className="inline-block rounded-full bg-white/20 px-6 py-2 font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-white/30">
                  플레이하기 →
                </div>
              </div>
            </div>
          </Link>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/makima-says/page.tsx app/page.tsx
git commit -m "feat(makima-says): route + hub card"
```

---

### Task 7: e2e test

**Files:**
- Create: `e2e/makima-says.spec.ts`

- [ ] **Step 1: Write the e2e spec**

Create `e2e/makima-says.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type M = any;

test.describe("마키마 says", () => {
  test("hub has a card linking to /makima-says", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /마키마 says/ })).toHaveAttribute("href", "/makima-says");
  });

  test("the route embeds the game", async ({ page }) => {
    await page.goto("/makima-says");
    await expect(page.locator('iframe[title="마키마 says"]')).toBeVisible();
  });

  test("game mounts and a round starts without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/makima-says/index.html");
    await page.waitForFunction(() => !!(window as unknown as { __makima?: M }).__makima, null, { timeout: 8000 });
    await page.getByRole("button", { name: "시작" }).click();
    await page.waitForFunction(() => !!(window as unknown as { __makima: M }).__makima.command, null, { timeout: 4000 });
    expect(await page.evaluate(() => (window as unknown as { __makima: M }).__makima.running)).toBe(true);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("obeying 마키마 scores; obeying 레제 costs a life", async ({ page }) => {
    await page.goto("/makima-says/index.html");
    await page.waitForFunction(() => !!(window as unknown as { __makima?: M }).__makima);
    await page.getByRole("button", { name: "시작" }).click();

    // Drive ~8 rounds: obey makima (press shown dir), resist reze (press nothing).
    for (let i = 0; i < 8; i++) {
      const cmd = await page.evaluate(() => (window as unknown as { __makima: M }).__makima.command);
      if (cmd && cmd.speaker === "makima") {
        await page.evaluate((d) => (window as unknown as { __makima: M }).__makima._forceInput(d), cmd.dir);
        await page.waitForTimeout(500);
      } else {
        await page.waitForTimeout(900); // let reze's window elapse untouched
      }
    }
    const st = await page.evaluate(() => {
      const m = (window as unknown as { __makima: M }).__makima;
      return { score: m.score, lives: m.lives };
    });
    expect(st.score).toBeGreaterThan(0);
    expect(st.lives).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run e2e**

Run: `npx playwright test e2e/makima-says.spec.ts --workers=2`
Expected: 4 passed. (Use `--workers=2`; 8-worker runs flake per project history.)

- [ ] **Step 3: Commit**

```bash
git add e2e/makima-says.spec.ts
git commit -m "test(makima-says): e2e — hub card, mount, obey/resist round flow"
```

---

### Task 8: Full gate + local verification

- [ ] **Step 1: Run unit suite**

Run: `npx vitest run`
Expected: all pass (existing 99 + new 7).

- [ ] **Step 2: Lint + type-check**

Run: `npx eslint . && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Build**

Run: `npx next build`
Expected: succeeds; `/makima-says` route listed.

- [ ] **Step 4: Manual smoke (optional, recommended)**

Run `npx next dev`, open `/makima-says`, click 시작, verify: voices play, makima-obey scores, reze-resist holds, wrong input flashes red + boom, 3 misses → game over → replay.

---

## Notes for the implementer
- Voice files MUST exist before e2e/build that references them — Task 1 first.
- `window.__makima._forceInput` is the test seam; keep it.
- Keep `logic.js` DOM/audio-free so unit tests stay fast and deterministic.
- Do NOT `git add -A` (project has local `.mcp.json` that must not be committed) — add explicit paths as shown.
- Deployment to prod (push to `main`) is a SEPARATE, user-approved step — this plan stops at a green local branch.
