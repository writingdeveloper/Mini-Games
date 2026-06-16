# Fryffel Tower Phase B2 — 고급 컨트롤 UI Implementation Plan

> REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use `- [ ]`.

**Goal:** 게임 내 컨트롤 도움말 오버레이(`?` 버튼) — 전체 컨트롤(고급 포함) 문서화 + 보정(assist) ON/OFF 토글 + 열려 있는 동안 라운드 일시정지.

**Architecture:** 기존 `.overlay`/`.panel` 모달 패턴 재사용. `#help-btn`(z-index 4 → 플레이 중에만 보이고 메뉴/결과 오버레이 뒤로 가림). `Session.paused`가 `update()`를 조기 반환. main.js가 열기/닫기·일시정지·보정 토글·Esc/바깥탭을 배선.

**Spec:** `docs/superpowers/specs/2026-06-16-fry-tower-phaseB2-advanced-ui-design.md`

---

## Task 1: 마크업 + CSS

**Files:** `public/fry-tower-game/index.html`, `public/fry-tower-game/style.css`

- [ ] **Step 1: index.html — `#mute-btn` 다음에 도움말 버튼 + 오버레이 추가**

`<button id="mute-btn" aria-label="Toggle mute">🔊</button>` 다음 줄에:
```html
  <!-- Help button (controls reference) — visible during play (z-index below menu/result) -->
  <button id="help-btn" aria-label="도움말">❔</button>
```
그리고 `#result` 오버레이 블록 바로 앞에:
```html
  <!-- Controls help overlay (full control reference + assist toggle; pauses the round) -->
  <div id="help-overlay" class="overlay hidden">
    <div class="panel">
      <h1 class="title help-title">조작법</h1>
      <div class="controls help-controls">
        <span>← →</span><span>좌우</span>
        <span>↑ ↓</span><span>앞뒤(깊이)</span>
        <span>Q / E</span><span>회전(교차)</span>
        <span>Z / X</span><span>기울이기</span>
        <span>W / S</span><span>높이</span>
        <span>[ ]</span><span>카메라</span>
        <span>Space</span><span>놓기</span>
        <span>R</span><span>리셋</span>
      </div>
      <p class="subtitle help-mobile">📱 드래그=이동 · 탭=놓기 · ⟲ ⟳=회전 · 🔄=시점</p>
      <button id="assist-toggle">🎯 보정: 끔</button>
      <button id="help-close" class="btn-primary">닫기</button>
    </div>
  </div>
```

- [ ] **Step 2: style.css — `#mute-btn` 블록 뒤(반응형 블록 포함)에 추가**

`#mute-btn`의 coarse 미디어쿼리 블록 다음에:
```css
/* ---- Help button + overlay (Phase B2) ---- */
#help-btn {
  position: fixed; top: 14px; right: 64px; z-index: 4;
  width: 42px; height: 42px; font-size: 22px; line-height: 1;
  background: rgba(255, 246, 223, 0.92); border: 3px solid #2a1b08;
  border-radius: 50%; box-shadow: 0 3px 0 #2a1b08;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  padding: 0; user-select: none; -webkit-user-select: none; touch-action: manipulation;
}
#help-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #2a1b08; }
.help-title { font-size: 30px; }
#help-overlay .help-controls { justify-content: center; margin-top: 4px; }
.help-mobile { margin-top: 14px; font-size: 13px; }
#assist-toggle {
  display: block; margin: 8px auto 0; font-size: 16px; font-weight: 800; color: #2a1b08;
  background: #ffe39a; border: 3px solid #2a1b08; border-radius: 10px; padding: 8px 18px;
  cursor: pointer; box-shadow: 0 4px 0 #2a1b08; user-select: none; -webkit-user-select: none;
  touch-action: manipulation;
}
#assist-toggle.on { background: linear-gradient(#8be36a, #5bc23a); color: #14310a; }
#assist-toggle:active { transform: translateY(2px); box-shadow: 0 2px 0 #2a1b08; }
#help-close { margin-top: 14px; }
@media (max-width: 600px), (pointer: coarse) {
  #help-btn { top: 8px; right: 50px; width: 34px; height: 34px; font-size: 18px; border-width: 2px; box-shadow: 0 2px 0 #2a1b08; }
}
```

- [ ] **Step 3: 커밋** — `git commit -m "feat(fry-tower): help overlay markup + CSS (controls reference + assist toggle)"`

---

## Task 2: Session.paused

**Files:** `public/fry-tower-game/src/play/Session.js`

- [ ] **Step 1: 생성자에 paused 플래그** — `this._wobbleSign = 1;      // alternating sway direction` 다음에:
```js
    this.paused = false;       // help overlay open -> freeze update
```

- [ ] **Step 2: update 조기 반환** — `update(dt, input)`의 `if (isOver(this.round)) return;` 다음에:
```js
    if (this.paused) return;
```

- [ ] **Step 3: 정적 검증** — `npm test` (161) + `npm run type-check` 클린.
- [ ] **Step 4: 커밋** — `git commit -m "feat(fry-tower): Session.paused freezes update (for help overlay)"`

---

## Task 3: main.js 배선 (열기/닫기 + 일시정지 + 보정 토글)

**Files:** `public/fry-tower-game/src/main.js`

- [ ] **Step 1: 요소 참조 + 헬퍼 추가** — `const muteBtn = document.getElementById('mute-btn');` 다음에:
```js
const helpBtn = document.getElementById('help-btn');
const helpOverlay = document.getElementById('help-overlay');
const helpClose = document.getElementById('help-close');
const assistToggle = document.getElementById('assist-toggle');
```

- [ ] **Step 2: 도움말/보정 배선 (mute 버튼 배선 다음, `let game = null;` 앞)**
```js
// ---- Help overlay (controls reference + assist toggle; pauses the round) ----
function refreshAssistToggle() {
  const on = !!window.__fry?.session?.assist;
  if (!assistToggle) return;
  assistToggle.textContent = on ? '🎯 보정: 켬' : '🎯 보정: 끔';
  assistToggle.classList.toggle('on', on);
}
function openHelp() {
  if (!helpOverlay) return;
  helpOverlay.classList.remove('hidden');
  const s = window.__fry?.session;
  if (s) s.paused = true;
  refreshAssistToggle();
}
function closeHelp() {
  if (!helpOverlay) return;
  helpOverlay.classList.add('hidden');
  const s = window.__fry?.session;
  if (s) s.paused = false;
}
if (helpBtn) helpBtn.addEventListener('click', () => {
  if (helpOverlay && helpOverlay.classList.contains('hidden')) openHelp();
  else closeHelp();
});
if (helpClose) helpClose.addEventListener('click', closeHelp);
if (helpOverlay) helpOverlay.addEventListener('click', (e) => {
  if (e.target === helpOverlay) closeHelp(); // backdrop tap
});
if (assistToggle) assistToggle.addEventListener('click', () => {
  const s = window.__fry?.session;
  if (s) { s.assist = !s.assist; refreshAssistToggle(); }
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && helpOverlay && !helpOverlay.classList.contains('hidden')) closeHelp();
});
```

- [ ] **Step 3: 정적 검증** — `npm test` (161) + `npm run type-check` 클린 + ESM 구문(main.js) OK.
- [ ] **Step 4: 커밋** — `git commit -m "feat(fry-tower): wire help overlay (pause + assist toggle + Esc/backdrop close)"`

---

## Task 4: e2e + 전체 게이트

**Files:** `e2e/fry-tower-game.spec.ts`

- [ ] **Step 1: 타입 확장** — session 타입에 `assist?: boolean;`, `round?: { timeLeft: number };`, `paused?: boolean;` 추가:
```ts
      session?: {
        height: number;
        placed?: unknown[];
        azimuth?: number;
        assist?: boolean;
        paused?: boolean;
        round?: { timeLeft: number };
        bodies?: { position: { y: number }; velocity: { x: number } }[];
        _applyWobble?: () => void;
      };
```

- [ ] **Step 2: 테스트 추가** (`multi-mode bootstrap ...` 앞)
```ts
  test("help overlay: opens, pauses the round, toggles assist, closes", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/fry-tower-game/index.html");
    await page.getByRole("button", { name: /쌓기 시작/ }).click();
    await expect(page.locator("#hud")).toBeVisible();
    await page.waitForTimeout(500);

    // Open help -> overlay visible + round paused (timeLeft frozen).
    await page.locator("#help-btn").click();
    await expect(page.locator("#help-overlay")).toBeVisible();
    const t1 = await page.evaluate(() => window.__fry?.session?.round?.timeLeft ?? -1);
    await page.waitForTimeout(700);
    const t2 = await page.evaluate(() => window.__fry?.session?.round?.timeLeft ?? -1);
    expect(t2).toBe(t1); // paused: timer did not advance

    // Toggle assist on.
    await page.locator("#assist-toggle").click();
    const assistOn = await page.evaluate(() => !!window.__fry?.session?.assist);
    expect(assistOn).toBe(true);

    // Close -> overlay hidden + round resumes (timer advances).
    await page.locator("#help-close").click();
    await expect(page.locator("#help-overlay")).toBeHidden();
    await page.waitForTimeout(700);
    const t3 = await page.evaluate(() => window.__fry?.session?.round?.timeLeft ?? -1);
    expect(t3).toBeLessThan(t2);

    expect(errors, errors.join("\n")).toHaveLength(0);
  });
```

- [ ] **Step 3: 전체 게이트** — `npm run lint && npm run type-check && npm test && npm run test:e2e -- fry-tower-game` → lint 0-err · tsc · 161 unit · 9 e2e.
- [ ] **Step 4: 커밋** — `git commit -m "test(fry-tower): help overlay e2e (pause + assist toggle)"`

---

## Self-Review
- 스펙 커버리지: §2 도움말/보정/일시정지 → T1(UI)·T2(pause)·T3(배선) · §5 테스트 → T4. 플레이스홀더 없음. 이름 일관: `#help-btn`/`#help-overlay`/`#help-close`/`#assist-toggle`/`session.paused`/`session.assist`.
- z-index 4로 메뉴/결과 뒤 → 플레이 중에만 노출(세션 존재 보장).
