# Fryffel Tower 손 조작 오버홀 — Phase A (솔로 코어) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 솔로 게임의 "좌우 이동 + 드롭" 메커닉을 검증된 **셰프 손(IK) + 모멘텀 + 입체(X·Z·yaw·tilt) 배치 + 궤도 카메라 + 다양한 사진 기반 감자튀김**으로 교체한다. 타이머/점수/콤보/붕괴는 유지.

**Architecture:** 검증된 프로토타입(`public/fry-tower-game/proto/hand-proto.js`)을 레퍼런스로, 순수 수학은 `logic/placement.js`(유닛 테스트), 비주얼은 `render/HandRig.js`·`render/CameraRig.js`·`render/fryMesh.js`, 오케스트레이션은 `play/Session.js`, 입력은 `core/Input.js`로 이식한다. 카메라 방위(azimuth)를 Session→HandRig→CameraRig가 공유해 "팔이 카메라를 따라 회전"한다. 멀티/사보타지 코드 경로는 건드리지 않는다(Phase C에서 재검증).

**Tech Stack:** 빌드프리 Three.js r0.184 (importmap CDN) + cannon-es 0.20 + `three/addons` RoundedBoxGeometry. 테스트: Vitest(jsdom) 유닛, Playwright e2e. 멀티 서버는 기존 socket.io.

**Reference (read first):** `public/fry-tower-game/proto/hand-proto.{html,js}` — 모든 메커닉이 동작하는 검증된 스파이크. 이 계획의 다수 코드는 여기서 이식한다.

---

## File Structure

**Create**
- `public/fry-tower-game/src/logic/placement.js` — 순수 수학: 2본 IK, 리치 클램프, 모멘텀 속도. THREE/물리 비의존(`{x,y,z}` 평이 객체 입출력), 유닛 테스트.
- `public/fry-tower-game/src/render/HandRig.js` — IK 셰프 손(어깨/팔/손 메시 + 손가락 그립). `placement.js` 사용.
- `public/fry-tower-game/src/render/CameraRig.js` — 궤도 + 높이추적 + 셰이크. azimuth 노출.
- `__tests__/unit/fry-tower-game/placement.test.ts` — placement 유닛 테스트.

**Modify**
- `public/fry-tower-game/src/logic/config.js` — hand/placement/momentum/camera/fry 튜너블 추가.
- `public/fry-tower-game/src/render/fryMesh.js` — `makeFryMesh`를 다양한 변형 사진기반 감자튀김으로 교체(트레이 유지).
- `public/fry-tower-game/src/play/Session.js` — 스폰/드롭/조작 → 손 리그 + 입체 배치 + 모멘텀. round/score/combo/collapse 로직 재사용.
- `public/fry-tower-game/src/core/Input.js` — 새 컨트롤 스킴(데스크톱/포인터).
- `public/fry-tower-game/src/render/Fx.js` — 카메라 소유를 CameraRig로 이관(먼지+셰이크 진폭만 유지).
- `public/fry-tower-game/src/main.js` — CameraRig 와이어링 + azimuth 공유.
- `public/fry-tower-game/index.html` — 데스크톱 조작 힌트 갱신(메뉴 controls).
- `e2e/fry-tower-game.spec.ts` — 새 컨트롤로 e2e 갱신.

**Untouched (보존):** `logic/{round,scoring,combo,sabotage,tower,rng,standings}.js`, `physics/world.js`, `play/Multiplayer.js`, `net/`, `ui/`, `audio/`, 서버.

---

## Task 1: 설정 튜너블 추가 (config)

**Files:**
- Modify: `public/fry-tower-game/src/logic/config.js`

- [ ] **Step 1: config.js에 블록 추가** (기존 객체에 키 추가, 기존 키 유지)

```js
export const CONFIG = {
  round: { duration: 90 },
  fry: { length: 1.6, thickness: 0.18, mass: 0.2, variants: 7 },
  spawn: { y: 9, xRange: 2.4 }, // (구 메커닉 잔재 — Session 교체 후 제거 가능)
  scoring: { perMeter: 100, stableBonus: 25, comboStep: 10, timeBonus: 2 },
  combo: { chargePerStable: 1, max: 10 },
  sabotage: { grantCost: 3 },
  stability: { settleSpeed: 0.25, settleTime: 0.6 },

  // ---- hand-overhaul (Phase A) ----
  hand: { shoulder: { x: 3.0, y: 8.8, z: 1.2 }, upperLen: 4.4, foreLen: 4.3, pole: { x: 0.25, y: 1, z: 0.35 } },
  placement: {
    xRange: 2.2, zRange: 2.2, hoverGap: 1.4,
    heightOffMin: -0.6, heightOffMax: 3.5, hoverYMin: 1.2, hoverYMax: 7.8,
    moveSpeed: 3.2, yawSpeed: 2.4, tiltSpeed: 1.8, tiltMax: 0.9, heightSpeed: 2.4, smoothK: 9,
  },
  momentum: { smooth: 0.5, max: 7, assistScale: 0.18, upClamp: 0.5 },
  camera: { radius: 10.4, height: 6.7, targetY: 2.5, yawSpeed: 1.2, yawMin: -0.7, yawMax: 0.9, startYaw: 0.16 },
};
```

- [ ] **Step 2: 기존 유닛 테스트가 깨지지 않는지 확인**

Run: `npm test`
Expected: PASS (기존 테스트 전부 그린 — config는 추가만 함)

- [ ] **Step 3: 커밋**

```bash
git add public/fry-tower-game/src/logic/config.js
git commit -m "feat(fry-tower): add hand-overhaul config tunables"
```

---

## Task 2: 순수 배치 수학 + 유닛 테스트 (IK · 리치 · 모멘텀)

**Files:**
- Create: `public/fry-tower-game/src/logic/placement.js`
- Test: `__tests__/unit/fry-tower-game/placement.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// __tests__/unit/fry-tower-game/placement.test.ts
import { describe, it, expect } from 'vitest';
import { solveElbow, clampToReach, releaseVelocity } from '../../../public/fry-tower-game/src/logic/placement.js';

const len = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('solveElbow', () => {
  it('places the elbow so both bone lengths are preserved when reachable', () => {
    const S = { x: 0, y: 5, z: 0 }, T = { x: 0, y: 0, z: 0 };
    const L1 = 3, L2 = 3, pole = { x: 0, y: 1, z: 0.3 };
    const e = solveElbow(S, T, L1, L2, pole);
    expect(len(S, e)).toBeCloseTo(L1, 4);
    expect(len(e, T)).toBeCloseTo(L2, 4);
  });
  it('keeps the upper-bone length even when the target is out of reach', () => {
    const S = { x: 0, y: 5, z: 0 }, T = { x: 0, y: -50, z: 0 };
    const e = solveElbow(S, T, 3, 3, { x: 0, y: 1, z: 0.3 });
    expect(len(S, e)).toBeCloseTo(3, 4);
    expect(Number.isFinite(e.x + e.y + e.z)).toBe(true);
  });
});

describe('clampToReach', () => {
  it('returns the target unchanged when within reach', () => {
    const S = { x: 0, y: 5, z: 0 };
    const out = clampToReach(S, { x: 0, y: 2, z: 0 }, 8);
    expect(out).toEqual({ x: 0, y: 2, z: 0 });
  });
  it('pulls the target onto the reach sphere when too far', () => {
    const S = { x: 0, y: 0, z: 0 };
    const out = clampToReach(S, { x: 100, y: 0, z: 0 }, 8);
    expect(len(S, out)).toBeCloseTo(8, 4);
    expect(out.y).toBeCloseTo(0, 4);
  });
});

describe('releaseVelocity', () => {
  const cfg = { max: 7, assistScale: 0.18, upClamp: 0.5 };
  it('passes hand velocity through, clamped to max magnitude', () => {
    const v = releaseVelocity({ x: 20, y: 0, z: 0 }, false, cfg);
    expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(7, 4);
  });
  it('damps strongly when assist is on', () => {
    const v = releaseVelocity({ x: 5, y: 0, z: 0 }, true, cfg);
    expect(v.x).toBeCloseTo(0.9, 4); // 5 * 0.18
  });
  it('clamps upward velocity so fries are not flung up', () => {
    const v = releaseVelocity({ x: 0, y: 5, z: 0 }, false, cfg);
    expect(v.y).toBeLessThanOrEqual(0.5 + 1e-9);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- placement`
Expected: FAIL ("Cannot find module .../placement.js")

- [ ] **Step 3: placement.js 구현** (THREE 비의존 순수 함수; 프로토 `solveElbow` 로직과 동일하되 평이 객체로)

```js
// public/fry-tower-game/src/logic/placement.js
// Pure vector math for the hand rig — no THREE / no physics. Unit tested.
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (a) => Math.hypot(a.x, a.y, a.z);
const norm = (a) => { const l = length(a) || 1; return scale(a, 1 / l); };
const clampNum = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 2-bone analytic IK. Returns elbow position with |S-elbow|=L1, |elbow-T|=L2.
export function solveElbow(S, T, L1, L2, pole) {
  const to = sub(T, S);
  let d = clampNum(length(to), Math.abs(L1 - L2) + 0.05, L1 + L2 - 0.05);
  const dir = length(to) > 1e-6 ? norm(to) : { x: 0, y: -1, z: 0 };
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  let perp = sub(pole, scale(dir, dot(pole, dir)));
  if (length(perp) < 1e-6) perp = sub({ x: 0, y: 1, z: 0 }, scale(dir, dir.y));
  perp = norm(perp);
  return add(add(S, scale(dir, a)), scale(perp, h));
}

// Pull a target onto the reach sphere if it is beyond maxReach.
export function clampToReach(S, T, maxReach) {
  const to = sub(T, S);
  if (length(to) <= maxReach) return { x: T.x, y: T.y, z: T.z };
  return add(S, scale(norm(to), maxReach));
}

// Map hand velocity to the velocity the released fry inherits.
export function releaseVelocity(handVel, assist, cfg) {
  let v = { x: handVel.x, y: handVel.y, z: handVel.z };
  if (assist) v = scale(v, cfg.assistScale);
  const l = length(v);
  if (l > cfg.max) v = scale(v, cfg.max / l);
  v.y = Math.min(v.y, cfg.upClamp);
  return v;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- placement`
Expected: PASS (전부)

- [ ] **Step 5: 커밋**

```bash
git add public/fry-tower-game/src/logic/placement.js __tests__/unit/fry-tower-game/placement.test.ts
git commit -m "feat(fry-tower): pure IK/reach/momentum math with unit tests"
```

---

## Task 3: 다양한 사진 기반 감자튀김 메시 (fryMesh)

**Files:**
- Modify: `public/fry-tower-game/src/render/fryMesh.js`
- Reference: `proto/hand-proto.js` (`buildFryVariant`, `fryAssets`, `makeProtoFry`, `stepGrad`)

- [ ] **Step 1: fryMesh.js에 변형 시스템 이식**

`proto/hand-proto.js`의 `stepGrad`/`buildFryVariant`/`fryAssets`/`makeProtoFry`를 그대로 가져와 `fryMesh.js`에 넣고, **`makeFryMesh`가 변형 중 하나를 반환**하도록 교체한다. 핵심 사항:
- import 추가: `import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';`
- 변형 개수는 `CONFIG.fry.variants` 사용: `for (let i = 0; i < CONFIG.fry.variants; i++) ...`
- `makeFryMesh()` 시그니처 유지(인자 없이 호출 가능) → 내부에서 `fryAssets()` 후 무작위 변형 그룹 반환.
- `makeTrayMesh()`는 **그대로 유지**.
- 기존 공유 지오메트리 풀(`getFryShared`)은 제거(변형 시스템으로 대체).

`makeFryMesh` 최종형:
```js
export function makeFryMesh() {
  fryAssets();
  const geo = _fryVariants[(Math.random() * _fryVariants.length) | 0];
  const g = new THREE.Group();
  const o = new THREE.Mesh(geo, _fryOutline); o.scale.multiplyScalar(1.07);
  g.add(o);
  g.add(new THREE.Mesh(geo, _fryFill));
  return g;
}
```
(변형/색 파라미터는 프로토의 최종값 사용: tone lerp `0xdf9a22→0xb06c0d`, pale `0xddb46a`, crisp `0x8a4c08`, deep `0x5d3304`, gradient `[60,115,175,230]`, L `1.42+0.46r`, T `0.22+0.06r`.)

- [ ] **Step 2: 렌더 스모크 e2e — 0 에러 + 캔버스 마운트**

Run: `npm run test:e2e -- fry-tower-game`
Expected: 기존 "canvas mounts, 0 console errors" 류 테스트 PASS (Task 9에서 컨트롤까지 갱신 전이라 배치 관련은 아직). 만약 기존 e2e가 구 컨트롤에 의존해 실패하면 Task 9까지 그 케이스는 `test.fixme`로 임시 표시하고 0-에러 케이스만 통과시킨다.

- [ ] **Step 3: 커밋**

```bash
git add public/fry-tower-game/src/render/fryMesh.js
git commit -m "feat(fry-tower): varied photo-based fry meshes (7 variants)"
```

---

## Task 4: HandRig — IK 셰프 손 렌더 컴포넌트

**Files:**
- Create: `public/fry-tower-game/src/render/HandRig.js`
- Reference: `proto/hand-proto.js` (`outlined`, `makeLimb`, `spanY`, `buildHand`, 그리고 `HandProto`의 팔/손 갱신부)

- [ ] **Step 1: HandRig 작성** (프로토의 손/팔 빌드 + 갱신을 클래스로, IK는 `logic/placement.solveElbow` 사용)

인터페이스:
```js
// public/fry-tower-game/src/render/HandRig.js
import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { solveElbow } from '../logic/placement.js';
// outlined()/makeLimb()/spanY()/buildHand()는 proto/hand-proto.js에서 이식

export class HandRig {
  constructor(scene) { /* 어깨/팔/손 메시 생성 + scene.add (프로토 constructor의 메시부 이식) */ }
  // azimuth(카메라 방위)로 어깨/pole 회전; 월드 손목 타깃으로 IK 풀고 메시 배치.
  // 반환: 이 프레임의 손목 월드 좌표(그립 계산용은 gripWorldPos가 담당).
  solve(worldTarget, azimuth) { /* S=baseShoulder.rotateY(azi); pole 회전; clampToReach; solveElbow; spanY; hand.position/quaternion */ }
  setGrip(g) { /* 프로토 setGrip */ }
  gripWorldPos(out) { out.set(0, -0.52, 0.30).applyQuaternion(this.hand.quaternion).add(this.hand.position); return out; }
}
```
세부:
- `baseShoulder`/`basePole`는 `CONFIG.hand`에서 읽음; `solve()`에서 `azi`로 `applyAxisAngle(Y, azi)`.
- 리치 클램프는 `clampToReach`(Task 2) 사용 또는 동등 로직.
- 손 메시/그립/손가락 곡률은 프로토와 동일.

- [ ] **Step 2: 렌더 확인용 임시 점검(선택)** — 개발 중에는 `proto`로 시각 확인이 끝났으므로, 통합 e2e(Task 7~8)에서 검증. 별도 단계 없음.

- [ ] **Step 3: 커밋**

```bash
git add public/fry-tower-game/src/render/HandRig.js
git commit -m "feat(fry-tower): HandRig (IK chef hand) render component"
```

---

## Task 5: CameraRig — 궤도 + 높이추적 + 셰이크

**Files:**
- Create: `public/fry-tower-game/src/render/CameraRig.js`
- Modify: `public/fry-tower-game/src/render/Fx.js`

- [ ] **Step 1: CameraRig 작성** (카메라 위치 단일 소유: 궤도 azimuth + 높이추적 + 셰이크)

```js
// public/fry-tower-game/src/render/CameraRig.js
import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = CONFIG.camera.startYaw;
    this.target = new THREE.Vector3(0, CONFIG.camera.targetY, 0);
    this._riseY = 0; this._targetRise = 0; this._shake = 0;
  }
  orbit(delta) { this.yaw = THREE.MathUtils.clamp(this.yaw + delta, CONFIG.camera.yawMin, CONFIG.camera.yawMax); }
  followHeight(h) { this._targetRise = Math.min(h * 0.9, 18); }
  shake(a) { this._shake = Math.max(this._shake, a); }
  get azimuth() { return this.yaw; }
  update(dt) {
    this._riseY += (this._targetRise - this._riseY) * Math.min(1, 3 * dt);
    const R = CONFIG.camera.radius, H = CONFIG.camera.height;
    const ty = this.target.y + this._riseY;
    let px = Math.sin(this.yaw) * R, pz = Math.cos(this.yaw) * R, py = H + this._riseY;
    if (this._shake > 0.001) { px += (Math.random() - 0.5) * this._shake; py += (Math.random() - 0.5) * this._shake; this._shake *= Math.pow(0.001, dt); }
    this.camera.position.set(px, py, pz);
    this.camera.lookAt(this.target.x, ty, this.target.z);
  }
}
```

- [ ] **Step 2: Fx에서 카메라 소유 제거** — `Fx`는 먼지 버스트만 유지. `followHeight()`/`update()`의 카메라 위치 조작 제거, `shake(a)`는 CameraRig로 위임(생성자에 cameraRig 주입) 또는 `burst`만 남기고 셰이크는 Session이 CameraRig.shake 직접 호출. 권장: `new Fx(scene)`(먼지 전용), 셰이크는 `cameraRig.shake()`로 일원화.

Fx 수정 요지:
```js
export class Fx {
  constructor(scene) { /* sprites만 (camera 인자 제거) */ }
  burst(x, y, z) { /* 동일 */ }
  update(dt) { /* sprites 수명만 — 카메라 코드 전부 제거 */ }
}
```

- [ ] **Step 3: 유닛/타입 확인**

Run: `npm test && npm run type-check`
Expected: PASS (기존 로직 테스트 유지, 타입 그린)

- [ ] **Step 4: 커밋**

```bash
git add public/fry-tower-game/src/render/CameraRig.js public/fry-tower-game/src/render/Fx.js
git commit -m "feat(fry-tower): CameraRig (orbit+follow+shake); Fx becomes dust-only"
```

---

## Task 6: Input — 새 컨트롤 스킴

**Files:**
- Modify: `public/fry-tower-game/src/core/Input.js`

- [ ] **Step 1: Input 재작성** — 상태와 액션 노출(Session/Camera가 읽음). 키: `←→`=moveX, `↑↓`=moveZ, `Q/E`=yaw, `Z/X`=tilt, `W/S`=height, `[ ]`=camOrbit, `Space`=drop, `A`=assist 토글, `R`=reset(요청). 포인터: 드래그=X/Z, 탭=drop.

노출 인터페이스(예):
```js
export class Input {
  state = { left:false,right:false,fwd:false,back:false, yawL:false,yawR:false, tiltUp:false,tiltDown:false, up:false,down:false, orbitL:false,orbitR:false };
  takeDrop() { /* 1회성 */ }
  takeAssistToggle() { /* 1회성 */ }
  takeReset() { /* 1회성 */ }
  // 포인터 드래그 누적 → state.left/right/fwd/back 또는 직접 dx/dz 제공
}
```
(프로토 `_initInput`의 키/포인터 매핑을 이식하되, assist/reset은 1회성 take* 로.)

- [ ] **Step 2: 통합 시 검증** — Input은 DOM 이벤트라 유닛테스트 대신 Task 8 e2e에서 시뮬레이트 키로 검증.

- [ ] **Step 3: 커밋**

```bash
git add public/fry-tower-game/src/core/Input.js
git commit -m "feat(fry-tower): new control scheme (X/Z + yaw/tilt + camera + drop)"
```

---

## Task 7: Session — 손 리그 + 입체 배치 + 모멘텀 통합

**Files:**
- Modify: `public/fry-tower-game/src/play/Session.js`
- Reference: `proto/hand-proto.js` (`HandProto.update`/`_release`/`_spawnHeld`/`_resolveSettles`는 기존 Session 것 유지)

- [ ] **Step 1: Session 재작성** — 기존의 `_spawnActive/steer/drop`을 손 기반으로 교체. 보존: `_resolveSettles`, round/score/combo, 사보타지 메서드(`applyGust/nudgeRandomFry/greaseNextFry`), `dispose`, `get height`.

핵심 변경:
- 생성자에서 `this.hand = new HandRig(scene)`; 조작 상태(`aimX,aimZ,heightOff,yaw,tilt,grip,handVel,prevGrip,held`) 추가; `this.azimuth=CONFIG.camera.startYaw`(외부 CameraRig와 동기화 — main에서 매 프레임 주입).
- `update(dt, input)`:
  1. `isOver`면 return.
  2. input → aim/yaw/tilt/height (프로토 update 입력부), 드롭은 `input.takeDrop()`.
  3. `azi = this.azimuth`; `desired = rotateY((aimX, hoverY, aimZ), azi)`; `hoverY = clamp(towerTop+hoverGap+heightOff, ...)`; smooth lerp.
  4. `this.hand.solve(wrist, azi)`; grip 계산; `handVel` 갱신(궤도 중이면 0).
  5. held 추적/그립 애니메이션/리스폰(프로토와 동일), held fry yaw = `yaw + azi`.
  6. `world.step`; `placed.sync`; `_resolveSettles`(그대로); 점수/라운드 갱신(그대로); `onEnd`.
- `drop/_release`: `makeFryBody` + `releaseVelocity(handVel, assist, CONFIG.momentum)`; 쿼터니언 = `Euler(tilt, yaw+azi, 0, 'YXZ')`; held → placed; 오디오 `place()`.
- 충돌체는 `CONFIG.fry`(박스) 그대로. 비주얼만 변형.

- [ ] **Step 2: 통합 e2e 작성/실행 (임시 스크립트)** — `proto/_proto-verify.mjs` 패턴으로 실제 라우트 점검: `/fry-tower-game/?` 로드 → 메뉴 "쌓기 시작" 클릭 → Space로 배치 → 0 에러 + `window.__fry.session.placed.length>0`.

Run (개발용): 임시 노드 스크립트 또는 `npm run test:e2e -- fry-tower-game`
Expected: 0 콘솔 에러, 감자튀김 배치됨.

- [ ] **Step 3: 기존 로직 유닛 회귀**

Run: `npm test`
Expected: PASS (combo/round/scoring/tower/sabotage/standings 유지)

- [ ] **Step 4: 커밋**

```bash
git add public/fry-tower-game/src/play/Session.js
git commit -m "feat(fry-tower): Session uses hand rig + 3D placement + momentum"
```

---

## Task 8: main.js 와이어링 + azimuth 공유 + 힌트 갱신

**Files:**
- Modify: `public/fry-tower-game/src/main.js`, `public/fry-tower-game/index.html`

- [ ] **Step 1: main.js 와이어링** — `Fx(scene)`(먼지) + `new CameraRig(game.camera)` 추가. 솔로 루프:
```js
const cameraRig = new CameraRig(game.camera);
game.add(cameraRig);
function startSolo() {
  /* ... */
  const session = new Session(game.scene, { fx, audio, onEnd });
  game.add({ update: (dt) => {
    // 카메라 궤도 입력 → cameraRig.orbit; azimuth를 session에 주입
    if (input.state.orbitL) cameraRig.orbit(+CONFIG.camera.yawSpeed * dt);
    if (input.state.orbitR) cameraRig.orbit(-CONFIG.camera.yawSpeed * dt);
    session.azimuth = cameraRig.azimuth;
    session.update(dt, input);
    cameraRig.followHeight(session.height);
  }});
  game.add(new HUD(session));
  game.start();
  window.__fry = { get session() { return session; } };
}
```
(셰이크: Session 내부에서 `this.fx`로 burst, 카메라 셰이크는 `cameraRig.shake` 참조를 Session에 주입하거나 onCollapse 콜백으로 처리 — 간단히 Session 생성 옵션에 `cameraRig` 추가해 `cameraRig.shake(0.25)` 호출.)

- [ ] **Step 2: index.html 메뉴 컨트롤 힌트 갱신** — `<div class="controls">`를 새 키로:
```html
<div class="controls">
  <span>← →</span><span>좌우</span>
  <span>↑ ↓</span><span>앞뒤(깊이)</span>
  <span>Q / E</span><span>회전</span>
  <span>Space</span><span>놓기</span>
</div>
```

- [ ] **Step 3: 전체 솔로 e2e**

Run: `npm run test:e2e -- fry-tower-game`
Expected: 메뉴→플레이→배치→타이머 종료 흐름 PASS, 0 에러.

- [ ] **Step 4: 커밋**

```bash
git add public/fry-tower-game/src/main.js public/fry-tower-game/index.html
git commit -m "feat(fry-tower): wire CameraRig + share azimuth (arm follows camera)"
```

---

## Task 9: e2e 갱신 + 전체 게이트

**Files:**
- Modify: `e2e/fry-tower-game.spec.ts`

- [ ] **Step 1: e2e 스펙을 새 컨트롤로 갱신** — 구 컨트롤(좌우+Space 단순 드롭) 가정 케이스를 새 흐름으로: 캔버스 0 에러 / "쌓기 시작" 후 `Space`로 1개 이상 배치 / `↑`(깊이)·`Q`(yaw) 입력 후에도 에러 없음 / 라운드 종료 결과 패널 노출. (Task 3에서 `fixme`로 둔 케이스 복구.)

예시 보강:
```ts
test('places fries with the hand and shows a result', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/fry-tower-game/');
  await page.getByRole('button', { name: '쌓기 시작' }).click();
  await page.waitForTimeout(1500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  const placed = await page.evaluate(() => window.__fry?.session?.placed?.length ?? 0);
  expect(placed).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: 전체 게이트 그린 확인**

Run: `npm run lint && npm run type-check && npm test && npm run test:e2e -- fry-tower-game`
Expected: 전부 PASS.

- [ ] **Step 3: 커밋**

```bash
git add e2e/fry-tower-game.spec.ts
git commit -m "test(fry-tower): e2e for hand-based 3D placement (Phase A)"
```

---

## Task 10: 프로토 정리(선택) + 플레이 검증

**Files:**
- (선택) Remove: `public/fry-tower-game/proto/`, 루트 임시파일 `_proto-verify.mjs`, `proto-*.png`

- [ ] **Step 1: 실제 라우트 수동 플레이 검증** — `npm run dev` → `http://localhost:3000/fry-tower-game/` 에서 손 조작·교차·카메라·감자튀김·라운드 종료 확인.
- [ ] **Step 2: 프로토/임시파일 정리 여부 결정** — 레퍼런스로 남길지(Phase B에서 활용) 사용자에게 확인 후 처리.
- [ ] **Step 3: 커밋(정리 시)**

```bash
git rm -r public/fry-tower-game/proto && git rm _proto-verify.mjs proto-*.png
git commit -m "chore(fry-tower): remove hand-overhaul prototype after Phase A landing"
```

---

## Self-Review (작성자 점검 완료)

- **스펙 커버리지:** §3 손/모멘텀→T2,T4,T7 · §4 입체배치/yaw/tilt→T7 · §5 카메라/팔연동→T5,T7,T8 · §6 손룩→T4 / 감자튀김+변형→T3 · §7 컨트롤→T6,T8 · §8 점수/규칙→T7(기존 로직 재사용) · §9 통합/보존→T5~T8 · §12 테스트→T2,T9. 모바일/고급(tilt UI)/MP 재검증/도전장치는 **Phase B·C**(별도 계획).
- **플레이스홀더:** 순수 로직(T2)·config(T1)·CameraRig(T5)·와이어링(T8)·e2e(T9)는 실제 코드 포함. 비주얼 이식(T3,T4,T6,T7)은 **검증된 프로토 파일을 명시적 레퍼런스**로 지정(코드 중복 대신 출처+인터페이스+적응사항 명시).
- **타입/이름 일관성:** `solveElbow/clampToReach/releaseVelocity`(placement), `HandRig.solve/setGrip/gripWorldPos`, `CameraRig.orbit/followHeight/shake/azimuth`, `Session.azimuth` — 태스크 간 일치.

## 미해결(Phase B/C로 이월)
- 모바일 터치 컨트롤 재작성, 고급(tilt/수동카메라 UI), 점수 가중치·교차 보너스, 도전 장치(흔들림/약풍), 손 메시 업그레이드, MP/사보타지 재검증, 감자튀김 색 최종.
