# 가락국수 Plan 6: 폴리시 (무드·조명·애니·코미디·모바일·a11y) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`). 폴리시는 시각 미감이 핵심이라 각 Task는 "구현 → E2E 회귀(기존 green 유지) → 시각 QA(컨트롤러)"로 검증한다. 단위테스트는 era helper 등 순수 부분만.

**Goal:** 코어 게임(Plan 1~5) 위에 시각·체감 폴리시를 입힌다 — 시대별 무드·조명 강화(어두움 개선), 절차적 애니(생동감), 코미디 레이어(콤보 환호·이탈 절규·코믹 결과), 모바일 조이스틱+액션 + HUD overflow 정리, a11y.

**Architecture:** `scene.js`에 조명을 강화하고 시대별 무드를 `sync(state, t)`에서 반영, 절차적 애니(주인장 bob·손님 idle·스팀)를 더한다. `main.js`/`index.html`에 코미디 팝업, 모바일 터치 컨트롤, HUD wrap, aria-live, `prefers-reduced-motion`을 더한다. `logic.js`는 거의 안 건드린다(시대 무드는 WAVES.era로 이미 있음).

**Tech Stack:** 기존과 동일. **음성은 Plan 7.**

**작업 트리:** worktree `Mini-Games-garak`(브랜치 `feat/garak-guksu`).

**현재 상태(Plan 5 완료):** scene.js — HemisphereLight(0.5)+PointLight(1.4), 4스테이션, 손님 슬롯풀+게이지. main.js — WASD 액션/Digit 마감/HUD 7칸/결과화면. index.html — HUD 7 spans, 시작/결과 오버레이. 입력은 input.js(WASD)+main(Digit). 47 유닛 + 6 E2E green.

> ⚠️ 매 Task 끝에 기존 게이트(6 E2E + 47 vitest)가 green이어야 한다. 폴리시가 게임 로직/HUD id를 깨면 안 된다.

---

### Task 1: 조명 강화 + 시대별 무드 (scene)

어두움을 걷어내고, 증기→디젤→막차 시대마다 무드가 바뀌게 한다.

**Files:** Modify `public/garak-guksu/src/scene.js`

- [ ] **Step 1: 조명 강화 + DirectionalLight 그림자 캐스터**

`scene.js`의 조명 블록(22-27행)을 교체:
```js
  const hemi = new THREE.HemisphereLight(0x7889b0, 0x241e2c, 0.95); // brighter ambient
  scene.add(hemi);
  // warm incandescent lamp over the counter (fill, no shadow)
  const lamp = new THREE.PointLight(0xffcf6a, 2.6, 30, 1.3);
  lamp.position.set(0, 6, 0.5);
  scene.add(lamp);
  // a single directional sun as the cheap shadow caster (ppopgi pattern — 1 pass vs point light's 6)
  const sun = new THREE.DirectionalLight(0xfff0e0, 0.85);
  sun.position.set(5, 13, -3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(LOW ? 512 : 1024, LOW ? 512 : 1024);
  sun.shadow.camera.left = -7; sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -5;
  sun.shadow.camera.near = 2; sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0006;
  sun.target.position.set(0, 0, 0.5);
  scene.add(sun); scene.add(sun.target);
```
(`lamp.castShadow=true`는 제거됨 — sun이 캐스터.)

- [ ] **Step 2: 시대별 무드 (sync에서 적용)**

`scene.js` 상단(import 아래)에 추가하고 `WAVES`를 import에 더한다(`import { STATIONS, CUSTOMER_SLOTS, ARCHETYPES, slotProgress, patienceProgress, BLANCH_SLOTS, WAVES } from './logic.js';`):
```js
  const ERA_MOOD = {
    '증기': { bg: 0x161b2a, amb: 0.95, lamp: 2.6, fogN: 16, fogF: 34 },
    '디젤': { bg: 0x1a1f2c, amb: 1.05, lamp: 2.9, fogN: 18, fogF: 38 }, // brighter, busier
    '막차': { bg: 0x0a0c14, amb: 0.75, lamp: 2.3, fogN: 11, fogF: 25 }, // darkest, tense
  };
  let curEra = null;
```
`sync(state, t)` 안 맨 위에 무드 적용(era가 바뀔 때만):
```js
    const era = WAVES[Math.min(state.wave, WAVES.length - 1)].era;
    if (era !== curEra) {
      curEra = era;
      const m = ERA_MOOD[era];
      scene.background.setHex(m.bg);
      scene.fog.color.setHex(m.bg);
      scene.fog.near = m.fogN; scene.fog.far = m.fogF;
      hemi.intensity = m.amb;
      lamp.intensity = m.lamp;
    }
```

- [ ] **Step 3: E2E 회귀 + 컨트롤러 시각 QA**

Run: `npx playwright test e2e/garak-guksu.spec.ts --project=chromium` → 6 pass. (조명은 렌더만 바꾸므로 로직 무관.)
컨트롤러가 스크린샷으로 밝기·시대 무드를 확인하고 필요 시 값 미세조정.

- [ ] **Step 4: 커밋**
```bash
git add public/garak-guksu/src/scene.js
git commit -m "polish(garak-guksu): brighter lighting + directional shadow + era mood"
```

---

### Task 2: 절차적 애니 (주인장 bob · 손님 idle · 스팀) (scene)

**Files:** Modify `public/garak-guksu/src/scene.js`, `public/garak-guksu/src/main.js`

- [ ] **Step 1: sync에 시간 인자 + 애니**

`main.js`의 loop에서 `scene.sync(state)` 호출을 `scene.sync(state, now / 1000)`로 바꾼다(시간 초). (scene.sync 시그니처에 t를 더한다 — Task 1에서 이미 `sync(state, t)`로 받았다면 OK.)

`scene.js` `sync(state, t)`에 애니 추가:
```js
    // chef: gentle idle bob, stronger when moving
    const moving = Math.hypot(state.player.x - chef.position.x, state.player.z - chef.position.z) > 0.001;
    chef.position.set(state.player.x, moving ? Math.abs(Math.sin(t * 10)) * 0.08 : Math.sin(t * 2) * 0.03, state.player.z);
    chef.rotation.z = moving ? Math.sin(t * 10) * 0.06 : 0;
```
(기존 `chef.position.set(state.player.x, 0, state.player.z)`를 위로 교체.)
손님 idle(있을 때 살짝 흔들) — slotCustomers.forEach 안 `if (c)` 블록에:
```js
        sc.mesh.position.y = Math.sin(t * 2.5 + i) * 0.04;
        const pp2 = patienceProgress(c);
        sc.mesh.rotation.z = pp2 > 0.7 ? Math.sin(t * 14) * 0.12 : 0; // 초조하면 떨림
```
(REDUCE_MOTION일 땐 애니 끔 — `const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;` 를 createScene 상단에 두고, 위 식에 `RM ? 0 : ...` 적용.)

- [ ] **Step 2: 스팀 파티클(데치기 슬롯 위)** — 선택적, 간단히

데치기 슬롯이 차 있을 때 작은 반투명 평면/스프라이트가 위로 떠오르게(`slotGauges` 옆). 구현이 무거우면 SKIP하고 DONE_WITH_CONCERNS로 보고. (필수 아님.)

- [ ] **Step 3: E2E 회귀 + 시각 QA**

Run: `npx playwright test ... --project=chromium` → 6 pass. 컨트롤러 시각 QA(움직임 생동감).

- [ ] **Step 4: 커밋**
```bash
git add public/garak-guksu/src/scene.js public/garak-guksu/src/main.js
git commit -m "polish(garak-guksu): procedural chef bob + customer idle/anxious anim"
```

---

### Task 3: 코미디 레이어 (콤보 환호 · 이탈 절규 · 코믹 결과) (main + index)

**Files:** Modify `public/garak-guksu/src/main.js`, `public/garak-guksu/index.html`

- [ ] **Step 1: index.html — 팝업/플래시 요소 + 스타일**

`<body>` 안(canvas 뒤)에 추가:
```html
  <div id="pop" aria-live="polite"></div>
  <div id="flash"></div>
```
`<style>`에 추가:
```css
    #pop{position:fixed;left:50%;top:34%;transform:translateX(-50%);pointer-events:none;opacity:0;
      font-size:34px;font-weight:900;color:#ffd34d;text-shadow:0 2px 0 #7a3a00,0 0 14px rgba(255,200,60,.7);white-space:nowrap;z-index:8;}
    #pop.show{animation:popUp .9s ease-out;}
    @keyframes popUp{0%{opacity:0;transform:translateX(-50%) translateY(10px) scale(.6);}
      20%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.1);}
      100%{opacity:0;transform:translateX(-50%) translateY(-40px) scale(1);}}
    #flash{position:fixed;inset:0;pointer-events:none;opacity:0;transition:opacity .12s;z-index:7;
      background:radial-gradient(circle,rgba(255,200,60,0) 45%,rgba(255,170,40,.4) 100%);}
    @media (prefers-reduced-motion: reduce){#pop.show{animation-duration:.3s;}}
```

- [ ] **Step 2: main.js — 코미디 트리거**

팝업 헬퍼 + 트리거. `renderHud` 위에:
```js
const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
function popup(text) {
  const el = $('pop'); el.textContent = text; el.classList.remove('show');
  void el.offsetWidth; el.classList.add('show');
}
function flash() {
  if (RM) return;
  const f = $('flash'); f.style.opacity = '1';
  setTimeout(() => (f.style.opacity = '0'), 130);
}
```
콤보 환호: `action()`에서 serve 호출을 감싸 콤보 변화 감지. 단순화 — `action()`을 수정해서 serve 전후 combo를 비교:
```js
  } else {
    const before = state.combo;
    serve(state);
    if (state.combo > before) {
      const cheers = ['좋았어!', '척척!', '신들렸다!', '오늘 장사 대박!'];
      if (state.combo >= 3) { popup(cheers[Math.min(state.combo - 3, cheers.length - 1)]); flash(); }
    }
  }
```
이탈 절규: loop에서 customers 수가 줄고 missed가 늘면. loop에 `prevMissed`를 두고:
```js
  // (loop 안, tickCustomers 뒤)
  if (state.missed > prevMissed) { prevMissed = state.missed; popup('아이고 기차!'); }
```
(`let prevMissed = 0;`를 모듈 상단에, `start()`에서 `prevMissed = 0;` 리셋.)
결과 코믹: endGame의 result-sub에 이미 grade가 코믹(역전의 명인/기차 도살자 등). 추가로 놓침 0이면 "단 한 명도 못 놓쳤다!" 같은 한 줄 — endGame의 result-sub를 grade 보조 멘트로.

- [ ] **Step 3: E2E 회귀 + 시각 QA**

Run E2E → 6 pass. (팝업은 게임 로직 무관.) 시각 QA로 콤보 팝업·플래시 확인.

- [ ] **Step 4: 커밋**
```bash
git add public/garak-guksu/src/main.js public/garak-guksu/index.html
git commit -m "polish(garak-guksu): comedy layer — combo cheers, walkout cry, flash"
```

---

### Task 4: 모바일 조이스틱+액션 + HUD 정리 + a11y (index + main + input)

**Files:** Modify `index.html`, `main.js`, `input.js`

- [ ] **Step 1: index.html — 모바일 컨트롤 + HUD wrap + a11y**

`#hud`에 `flex-wrap:wrap;justify-content:center;max-width:96vw;` 추가(7칸 overflow 방지). `#hud`의 `aria-live`는 `off` 유지(빈번 갱신).
`<body>`에 모바일 컨트롤 추가(데스크톱 숨김):
```html
  <div id="touch" aria-hidden="true">
    <div id="joy"><div id="knob"></div></div>
    <button id="act">담기</button>
    <div id="spicebtns"><button data-s="none">안맵게</button><button data-s="normal">기본</button><button data-s="extra">많이</button></div>
  </div>
```
`<style>`:
```css
    #touch{display:none;}
    @media (pointer:coarse){#touch{display:block;}}
    #joy{position:fixed;left:calc(18px + env(safe-area-inset-left));bottom:calc(20px + env(safe-area-inset-bottom));
      width:120px;height:120px;border-radius:50%;background:radial-gradient(circle at 50% 40%,rgba(120,90,60,.5),rgba(20,16,28,.75));
      border:3px solid var(--amber);touch-action:none;z-index:6;}
    #knob{position:absolute;left:50%;top:50%;width:54px;height:54px;border-radius:50%;transform:translate(-50%,-50%);
      background:radial-gradient(circle at 42% 36%,#ffe9c0,#ffae5c 60%,#c8801a);border:2px solid #ffe3c0;}
    #act{position:fixed;right:calc(20px + env(safe-area-inset-right));bottom:calc(40px + env(safe-area-inset-bottom));
      width:104px;height:104px;border-radius:50%;border:4px solid #ffe14a;font-size:22px;font-weight:900;color:#2a160a;z-index:6;
      background:radial-gradient(circle at 42% 34%,#fff3b0,#ffd23d 55%,#f2a400);touch-action:manipulation;}
    #spicebtns{position:fixed;right:calc(16px + env(safe-area-inset-right));bottom:calc(150px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:6px;z-index:6;}
    #spicebtns button{padding:7px 10px;border-radius:10px;border:2px solid #c23b3b;background:rgba(20,16,28,.8);color:#ffd;font-weight:700;font-size:12px;touch-action:manipulation;}
```

- [ ] **Step 2: main.js — 터치 입력 배선**

조이스틱 → 이동 방향, 액션 버튼 → action(), spice 버튼 → garnish(주방 garnish 근처). `input.js`의 `createInput`은 WASD만 주므로, main에서 조이스틱 dir을 input에 합류시킨다. 간단한 방법: `input.js`에 `setTouchDir(x,z)`/`getMoveDir`이 키 + 터치를 합치게 확장(아래 Step 3). main:
```js
const joy = $('joy'), knob = $('knob');
if (joy) {
  let jid = null, cx = 0, cy = 0;
  const start = (e) => { jid = e.pointerId; const r = joy.getBoundingClientRect(); cx = r.left + r.width/2; cy = r.top + r.height/2; joy.setPointerCapture(jid); };
  const move = (e) => {
    if (e.pointerId !== jid) return;
    let dx = e.clientX - cx, dy = e.clientY - cy; const len = Math.hypot(dx, dy) || 1; const cl = Math.min(1, len / 48);
    knob.style.transform = `translate(calc(-50% + ${dx/len*cl*36}px), calc(-50% + ${dy/len*cl*36}px))`;
    input.setTouchDir(dx/len*cl, dy/len*cl); // x = right, screen y down = +z away? map: forward = -z
  };
  const end = (e) => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = 'translate(-50%,-50%)'; input.setTouchDir(0,0); };
  joy.addEventListener('pointerdown', start); joy.addEventListener('pointermove', move);
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
}
$('act')?.addEventListener('click', action);
document.querySelectorAll('#spicebtns button').forEach((b) => b.addEventListener('click', () => {
  const p = state.player;
  if (near(p.x, p.z, STATIONS.garnish.x, STATIONS.garnish.z)) { garnish(state, b.dataset.s); renderHud(); }
}));
```
> NOTE on joystick→world mapping: screen-up should move the chef AWAY from camera. Camera looks from -z toward +z, so screen-up (dy negative) = chef -z? Test in visual QA and flip the z sign if movement feels inverted. Document the chosen sign.

- [ ] **Step 3: input.js — 터치 방향 합류**

`createInput`이 키보드 + 터치를 합치도록:
```js
export function createInput(onAction) {
  const keys = new Set();
  let touch = { x: 0, z: 0 };
  const MOVE = { KeyW:[0,-1],KeyS:[0,1],KeyA:[-1,0],KeyD:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0] };
  addEventListener('keydown', (e) => { if (e.code==='KeyE'||e.code==='Space'){e.preventDefault();onAction();return;} if (MOVE[e.code]){e.preventDefault();keys.add(e.code);} });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  function getMoveDir() {
    let x = 0, z = 0;
    for (const k of keys) { const m = MOVE[k]; if (m){ x+=m[0]; z+=m[1]; } }
    if (touch.x || touch.z) { x += touch.x; z += touch.z; }
    const len = Math.hypot(x, z);
    return len > 0 ? { x: x/len, z: z/len } : { x: 0, z: 0 };
  }
  function setTouchDir(x, z) { touch = { x, z }; }
  return { getMoveDir, setTouchDir };
}
```

- [ ] **Step 4: 게이트 + 모바일 시각 QA**

Run: `npx playwright test ... --project=chromium` → 6 pass. `npx vitest run ...` → 47 pass. 컨트롤러가 모바일 뷰포트(iPhone)로 시각 QA(조이스틱·액션·HUD wrap).

- [ ] **Step 5: 커밋**
```bash
git add public/garak-guksu/src/main.js public/garak-guksu/src/input.js public/garak-guksu/index.html
git commit -m "polish(garak-guksu): mobile joystick+action+spice buttons, HUD wrap, a11y"
```

---

## Plan 6 완료 기준

- 게임이 충분히 밝고, 시대(증기→디젤→막차)마다 무드가 바뀐다.
- 주인장·손님이 살아있게 움직인다(bob/idle/초조 떨림), `prefers-reduced-motion` 존중.
- 콤보에 환호 팝업+플래시, 이탈에 "아이고 기차!" 절규, 코믹 결과 등급.
- 모바일에서 조이스틱+액션+양념 버튼으로 플레이, HUD가 넘치지 않음, aria-live.
- 유닛 47 + E2E 6 green 유지.

**다음:** Plan 7(음성 — voice-studio 자산 + 재생 통합). 음성은 voice-studio 진행 상황에 맞춰 맨 마지막.
