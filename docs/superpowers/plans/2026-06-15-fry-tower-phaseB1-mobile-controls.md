# Fryffel Tower Phase B1 — 모바일 컨트롤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 새 3D 손 메커닉을 모바일 터치에서 제대로 플레이되게 한다 — 신규 **🔄 시점 버튼**(탭당 카메라 단계 회전, 팔 추종)을 추가하고, 1회 컨트롤 힌트를 띄운다. (드래그=X/Z·탭=놓기·⟲⟳=yaw 는 Phase A에서 이미 작동.)

**Architecture:** `CameraRig`에 프리셋 순환 + 목표-yaw 보간(`orbitStep`)을 추가하고, `Input`에 1회성 `takeViewStep()`을 추가해 `#view-btn`에 연결, 솔로/MP 루프에서 `if (input.takeViewStep()) cameraRig.orbitStep()` 한 줄로 소비한다. 팔-카메라 연동은 azimuth 공유(Phase A)라 자동. 데스크톱·게임 로직은 불변.

**Tech Stack:** 빌드프리 Three.js r0.184 (importmap) · 기존 `#touch-controls` coarse-pointer CSS 패턴 · Playwright 모바일 컨텍스트 e2e.

**Spec:** `docs/superpowers/specs/2026-06-15-fry-tower-phaseB-mobile-controls-design.md`

---

## File Structure

**Modify**
- `public/fry-tower-game/src/render/CameraRig.js` — 목표-yaw 보간 + `orbitStep()` 프리셋 순환.
- `public/fry-tower-game/index.html` — `#view-btn`(🔄) + `#touch-hint` 요소.
- `public/fry-tower-game/style.css` — 시점 버튼 배치 · 힌트 · coarse 가시성 · safe-area.
- `public/fry-tower-game/src/core/Input.js` — `_viewQueued` + `takeViewStep()` + `#view-btn` 리스너.
- `public/fry-tower-game/src/main.js` — 솔로 루프에 view-step + 1회 힌트(`maybeShowTouchHint`).
- `public/fry-tower-game/src/play/Multiplayer.js` — MP 루프에 view-step 한 줄.
- `e2e/fry-tower-game.spec.ts` — 모바일 시점-버튼 테스트 + `azimuth` 타입.

**Untouched:** Session/HandRig/fryMesh/placement/Fx/Stage/HUD/Game/audio/server. (azimuth 공유로 팔 추종 자동.)

---

## Task 1: CameraRig — 시점 단계 회전(목표-yaw 보간 + 프리셋)

**Files:**
- Modify: `public/fry-tower-game/src/render/CameraRig.js`

- [ ] **Step 1: 생성자에 목표-yaw + 프리셋 추가**

`this.yaw = CONFIG.camera.startYaw;` 바로 다음 줄에 추가:
```js
    this._targetYaw = this.yaw; // yaw smoothly approaches this (instant for desktop)
    // Tap-step view presets for the mobile 🔄 button (within the yaw clamp).
    this._viewPresets = [
      CONFIG.camera.yawMin + 0.2, // left
      CONFIG.camera.startYaw,     // front (default 3/4)
      CONFIG.camera.yawMax - 0.2, // right
    ];
    this._viewIndex = 1; // start on the front preset
```

- [ ] **Step 2: `orbit(delta)`가 목표-yaw도 즉시 맞추게 (데스크톱 연속 동작 불변)**

`orbit(delta)`의 클램프 대입 다음에 한 줄 추가:
```js
  orbit(delta) {
    this.yaw = THREE.MathUtils.clamp(
      this.yaw + delta,
      CONFIG.camera.yawMin,
      CONFIG.camera.yawMax
    );
    this._targetYaw = this.yaw; // continuous desktop orbit: no lerp lag
  }
```

- [ ] **Step 3: `orbitStep()` 추가 (다음 프리셋으로 — update가 부드럽게 보간)**

`orbit(delta)` 메서드 바로 아래에 추가:
```js
  // Mobile view button: advance to the next preset angle (smoothly approached in update()).
  orbitStep() {
    this._viewIndex = (this._viewIndex + 1) % this._viewPresets.length;
    this._targetYaw = THREE.MathUtils.clamp(
      this._viewPresets[this._viewIndex],
      CONFIG.camera.yawMin,
      CONFIG.camera.yawMax
    );
  }
```

- [ ] **Step 4: `update(dt)` 첫 줄에 yaw 보간 추가**

`update(dt) {` 직후, `this._riseY += ...` 앞에 추가:
```js
    // Smoothly approach the target yaw (no-op on desktop where yaw === _targetYaw).
    this.yaw += (this._targetYaw - this.yaw) * Math.min(1, 8 * dt);
```

- [ ] **Step 5: 정적 검증**

Run: `npm test` → 157 통과(회귀 없음). 그리고 `npm run type-check` → 클린.
Run (구문):
```
node --input-type=module -e "import('./public/fry-tower-game/src/render/CameraRig.js').then(()=>console.log('OK')).catch(e=>process.exit(/Cannot find package/.test(e.message)?0:1))"
```
Expected: "Cannot find package 'three'" = 구문 OK.

- [ ] **Step 6: 커밋**

```bash
git add public/fry-tower-game/src/render/CameraRig.js
git commit -m "feat(fry-tower): CameraRig.orbitStep — tap-step view presets (mobile)"
```

---

## Task 2: index.html + style.css — 🔄 시점 버튼 & 힌트

**Files:**
- Modify: `public/fry-tower-game/index.html`
- Modify: `public/fry-tower-game/style.css`

- [ ] **Step 1: index.html — `#touch-controls`에 시점 버튼 추가**

`#touch-controls` 블록을 다음으로 교체:
```html
  <!-- Touch buttons — shown only on coarse-pointer (touch) devices via CSS -->
  <div id="touch-controls">
    <button id="rot-left" class="touch-btn" aria-label="Rotate left">⟲</button>
    <button id="view-btn" class="touch-btn" aria-label="Rotate camera">🔄</button>
    <button id="rot-right" class="touch-btn" aria-label="Rotate right">⟳</button>
  </div>
  <!-- One-time touch control hint (shown once on first mobile play) -->
  <div id="touch-hint" class="hidden">드래그 이동 · ⟲ ⟳ 회전 · 탭 놓기 · 🔄 시점</div>
```

- [ ] **Step 2: style.css — 시점 버튼 배치 + 힌트 + coarse 가시성 + safe-area**

`#rot-right { position: fixed; bottom: 24px; right: 20px; }` 다음에 추가:
```css
/* 🔄 view button — bottom-center, between the rotate buttons (touch only) */
#view-btn { display: none; position: fixed; bottom: calc(24px + env(safe-area-inset-bottom, 0px)); left: calc(50% - 36px); }
#rot-left  { bottom: calc(24px + env(safe-area-inset-bottom, 0px)); }
#rot-right { bottom: calc(24px + env(safe-area-inset-bottom, 0px)); }

/* One-time control hint toast */
#touch-hint {
  position: fixed; left: 50%; transform: translateX(-50%);
  bottom: calc(112px + env(safe-area-inset-bottom, 0px));
  z-index: 7; max-width: 88vw; text-align: center;
  padding: 8px 14px; border-radius: 999px;
  background: rgba(40, 26, 8, 0.88); color: #ffe9c2;
  font-size: 13px; font-weight: 700; border: 2px solid #ffce7a;
  box-shadow: 0 2px 0 #2a1b08; pointer-events: all;
}
#touch-hint.hidden { display: none; }
```

그리고 기존 coarse 블록(`@media (pointer: coarse) { #touch-controls { display: block; } #rot-left, #rot-right { display: block; } }`)에 `#view-btn`을 추가:
```css
@media (pointer: coarse) {
  #touch-controls { display: block; }
  #rot-left, #rot-right, #view-btn { display: block; }
}
```
(`#touch-hint`는 기본 `.hidden`이라 숨김; JS가 coarse + 미열람일 때만 `.hidden` 제거 — Task 4.)

- [ ] **Step 3: 커밋**

```bash
git add public/fry-tower-game/index.html public/fry-tower-game/style.css
git commit -m "feat(fry-tower): add 🔄 view button + one-time touch hint (markup/CSS)"
```

---

## Task 3: Input — `takeViewStep()` + 시점 버튼 리스너

**Files:**
- Modify: `public/fry-tower-game/src/core/Input.js`

- [ ] **Step 1: 1회성 큐 필드 추가**

생성자의 `this._resetQueued = false;` 다음에 추가:
```js
    this._viewQueued = false;
```

- [ ] **Step 2: 시점 버튼 초기화 호출 추가**

생성자 끝의 `this._initRotateButtons();` 다음에 추가:
```js
    this._initViewButton();
```

- [ ] **Step 3: `_initViewButton()` 메서드 추가**

`_initRotateButtons() { ... }` 메서드 바로 다음에 추가:
```js
  _initViewButton() {
    const view = document.getElementById('view-btn');
    if (!view) return;
    view.addEventListener('pointerdown', (e) => {
      this._viewQueued = true;
      e.preventDefault();
    }, { passive: false });
  }
```

- [ ] **Step 4: `takeViewStep()` 공개 메서드 추가**

`takeReset() { ... }` 다음에 추가:
```js
  // Consume a queued camera view-step (🔄 button). Returns true at most once per tap.
  takeViewStep() { const v = this._viewQueued; this._viewQueued = false; return v; }
```

- [ ] **Step 5: 정적 검증**

Run: `npm test` → 157 통과. `npm run type-check` → 클린.
Run (구문): `node --input-type=module -e "import('./public/fry-tower-game/src/core/Input.js').then(()=>console.log('OK')).catch(e=>process.exit(1))"` → `OK`.

- [ ] **Step 6: 커밋**

```bash
git add public/fry-tower-game/src/core/Input.js
git commit -m "feat(fry-tower): Input.takeViewStep + #view-btn listener"
```

---

## Task 4: 루프 배선 + 1회 힌트 (main.js, Multiplayer.js)

**Files:**
- Modify: `public/fry-tower-game/src/main.js`
- Modify: `public/fry-tower-game/src/play/Multiplayer.js`

- [ ] **Step 1: main.js 솔로 루프에 view-step 추가**

솔로 루프(`game.add({ update: (dt) => { ... } })`)의 두 orbit 줄 다음, `session.azimuth = ...` 앞에 추가:
```js
        if (input.takeViewStep()) cameraRig.orbitStep();
```
즉 블록이 다음이 되도록:
```js
    game.add({
      update: (dt) => {
        if (input.state.orbitL) cameraRig.orbit(+CONFIG.camera.yawSpeed * dt);
        if (input.state.orbitR) cameraRig.orbit(-CONFIG.camera.yawSpeed * dt);
        if (input.takeViewStep()) cameraRig.orbitStep();
        session.azimuth = cameraRig.azimuth;
        session.update(dt, input);
        cameraRig.followHeight(session.height);
        cameraRig.update(dt);
      },
    });
```

- [ ] **Step 2: main.js — 1회 터치 힌트 함수 추가 + 호출**

`function startSolo() { ... }` 위에 헬퍼 추가:
```js
  // Show the touch control hint once, on first coarse-pointer (mobile) play.
  function maybeShowTouchHint() {
    const hint = document.getElementById('touch-hint');
    if (!hint) return;
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    let seen = false;
    try { seen = !!localStorage.getItem('fryTowerTouchHintSeen'); } catch { /* private mode */ }
    if (!coarse || seen) return;
    hint.classList.remove('hidden');
    try { localStorage.setItem('fryTowerTouchHintSeen', '1'); } catch { /* ignore */ }
    const dismiss = () => hint.classList.add('hidden');
    setTimeout(dismiss, 4000);
    hint.addEventListener('pointerdown', dismiss, { once: true });
  }
```
그리고 `startSolo()`의 `hud.classList.remove('hidden');` 다음에 호출:
```js
    maybeShowTouchHint();
```

- [ ] **Step 3: Multiplayer.js 루프에 view-step 추가**

MP 드라이버(`game.add({ update: (dt) => { if (session) { ... } } })`)의 두 orbit 줄 다음, `session.azimuth = ...` 앞에 추가:
```js
        if (input.takeViewStep()) cameraRig.orbitStep();
```

- [ ] **Step 4: 정적 검증**

Run: `npm test` → 157 통과. `npm run type-check` → 클린.
Run (구문): `node --input-type=module -e "import('./public/fry-tower-game/src/main.js').then(()=>console.log('OK')).catch(e=>process.exit(/Cannot find package/.test(e.message)?0:1))"` → "Cannot find package" = OK.

- [ ] **Step 5: 커밋**

```bash
git add public/fry-tower-game/src/main.js public/fry-tower-game/src/play/Multiplayer.js
git commit -m "feat(fry-tower): wire view-step into solo+MP loops; one-time touch hint"
```

---

## Task 5: e2e (모바일 시점 버튼) + 전체 게이트

**Files:**
- Modify: `e2e/fry-tower-game.spec.ts`

- [ ] **Step 1: Window 타입에 `azimuth` 추가**

`declare global { interface Window { __fry?: { session?: { height: number; placed?: unknown[] } }; } }` 를 교체:
```ts
declare global {
  interface Window {
    __fry?: {
      session?: { height: number; placed?: unknown[]; azimuth?: number };
    };
  }
}
```

- [ ] **Step 2: 모바일 시점-버튼 테스트 추가**

`multi-mode bootstrap ...` 테스트 앞에 추가:
```ts
  test("touch: 🔄 view button rotates the camera (arm follows via azimuth)", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/fry-tower-game/index.html");
    await page.getByRole("button", { name: /쌓기 시작/ }).click();
    await expect(page.locator("#hud")).toBeVisible();
    await page.waitForTimeout(700); // settle

    const before = await page.evaluate(
      () => window.__fry?.session?.azimuth ?? 0
    );
    await page.locator("#view-btn").tap();
    await page.waitForTimeout(700); // let the camera lerp to the next preset

    const after = await page.evaluate(
      () => window.__fry?.session?.azimuth ?? 0
    );
    expect(
      Math.abs(after - before),
      "view button should change the camera azimuth"
    ).toBeGreaterThan(0.05);
    expect(errors, errors.join("\n")).toHaveLength(0);

    await ctx.close();
  });
```

- [ ] **Step 3: 전체 게이트**

Run: `npm run lint && npm run type-check && npm test && npm run test:e2e -- fry-tower-game`
Expected: lint 0 errors · tsc 클린 · unit 157 · e2e 7/7 (신규 시점 테스트 포함) 통과.

- [ ] **Step 4: 커밋**

```bash
git add e2e/fry-tower-game.spec.ts
git commit -m "test(fry-tower): mobile view-button e2e (camera azimuth changes)"
```

---

## Self-Review (작성자 점검)

- **스펙 커버리지:** §2 제어모델(드래그/탭/yaw 기존 + 시점버튼)→T1~T4 · §2.1 모멘텀-없음(코드 분기 없음, 자연 감쇠)→설계상 무변경 · §2.2 제외(tilt/높이/assist 버튼 없음)→추가 안 함 · §3 orbitStep/프리셋/팔추종→T1(+azimuth 공유 기존) · §4 takeViewStep/#view-btn→T2,T3 · §5 레이아웃/힌트→T2,T4 · §6 보존→데스크톱·로직 무변경 · §8 테스트→T5.
- **플레이스홀더:** 없음 — 모든 코드 블록은 실제 삽입 코드. 삽입 위치는 현재 파일의 정확한 앵커 줄로 지정.
- **타입/이름 일관성:** `orbitStep`(CameraRig) · `takeViewStep`/`_viewQueued`(Input) · `#view-btn`/`#touch-hint`(DOM) · `maybeShowTouchHint`(main) · `window.__fry.session.azimuth`(e2e) — 태스크 간 일치.
- **레이아웃 메모(스펙 대비):** 스펙 §5는 "좌하단 ⟲⟳·우하단 🔄"였으나, 좌우 회전 분리(⟲ 좌·⟳ 우)가 엄지 조작에 더 자연스러워 **🔄를 하단 중앙**에 배치(⟲ 좌 · 🔄 중앙 · ⟳ 우). 기능 동일, 발견성/에르고노믹 개선.

## 미해결(B2/B3 또는 후순위)
- 시점 프리셋 각도·개수 튜닝, 깊이=세로드래그 추가 가이드, 모멘텀 명시적 0-가드(관찰 시), 모바일 tilt/높이(B2), 점수/도전(B3).
