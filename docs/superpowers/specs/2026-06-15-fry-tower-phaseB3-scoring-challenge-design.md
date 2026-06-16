# Fryffel Tower — Phase B3: 도전 장치(높이 비례 흔들림) (Design Spec)

**Date:** 2026-06-15
**Status:** Draft — pending user review → implementation planning
**Repo:** `Mini-Games` (Fryffel Tower, 5th game)
**Builds on:** Phase A hand-overhaul + B1 mobile (branch `fry-tower-hand-overhaul-phaseA`, unmerged)
**Scope:** Phase B3 = 도전 장치 + 점수. (B1 mobile 완료, B2 advanced-UI 별도.)

---

## 1. 문제 / 동기

스펙의 전략축은 **"교차=안정·느림 ↔ 수직=고득점·불안정"**이다. 그런데 현재 솔로엔 *수직을 불안정하게 만드는 힘*이 없다 — 타이머만 압박하고, 높은 탑도 가만두면 안 무너진다. 점수는 이미 높이 지배적(`height×100 + stableCount×25 + combo×10 + secondsLeft×2`)이라 "수직=고득점"은 성립하지만, "수직=불안정"이 빠져 전략적 긴장이 약하다.

**목표:** 높이가 곧 리스크가 되는 **도전 장치(높이 비례 흔들림)**를 더해 전략축을 완성한다. 점수 공식은 그대로 둔다(흔들림이 리스크를 만들고, 교차는 더 높이 안정적으로 쌓게 해 암묵적으로 보상됨).

## 2. 도전 장치 — 높이 비례 흔들림(전단) (확정)

- **주기:** `CONFIG.challenge.interval`초마다 1회 흔들림.
- **전단(shear) 스케일:** 흔들림은 **각 감자튀김 바디에 수평 임펄스**를 가하되, 세기를 **그 조각의 트레이 위 높이에 비례**시킨다 → 위쪽 조각이 더 밀려 타워가 *기운다(전단)*. 결과: **낮은 탑은 거의 안 흔들리고, 높은 탑일수록 기울어 무너질 위험.** 곧 높이=리스크.
- **임계 높이:** 타워 높이가 `CONFIG.challenge.startHeight` 미만이면 흔들지 않음(초반 평온).
- **세기 캡:** 바디당 임펄스는 `CONFIG.challenge.maxImpulse`로 상한.
- **방향:** 매 흔들림마다 좌우 번갈아(sway) + 깊이(Z) 약간 무작위.
- **피드백:** 흔들림마다 `cameraRig.shake(작은 값)` 펄스로 체감(기존 재사용). *UI 경고(telegraph)·오디오 큐는 후순위.*
- **적용 위치:** `Session.update`의 물리 step 직전(솔로+MP 공통 — 같은 Session). **B3는 솔로 검증**, MP 밸런스 재검증은 Phase C.

## 3. 점수 (변경 없음 — 확정)

`logic/scoring.js`·`logic/combo.js` 그대로. `roundScore = round(height×perMeter + stableCount×stableBonus + combo×comboStep + secondsLeft×timeBonus)` 유지. 교차/오버행 명시 보너스는 채택하지 않음(암묵 보상으로 충분, 복잡도 회피).

## 4. 순수 로직 분리 + TDD

흔들림 세기 계산은 물리/THREE 비의존 순수 함수로 분리해 유닛 테스트한다.

`public/fry-tower-game/src/logic/challenge.js`:
```js
// Per-body horizontal impulse magnitude for the height-scaled wobble (shear).
// 0 while the tower is below the start height (calm early game); otherwise
// scales with the body's own height above the tray, capped at maxImpulse.
export function wobbleImpulse(bodyHeight, towerHeight, cfg) {
  if (towerHeight < cfg.startHeight) return 0;
  const mag = Math.max(0, bodyHeight) * cfg.perMeter;
  return Math.min(mag, cfg.maxImpulse);
}
```
유닛 테스트(`__tests__/unit/fry-tower-game/challenge.test.ts`): ① 타워가 임계 미만이면 0 ② 임계 이상이면 bodyHeight×perMeter ③ 음수 bodyHeight는 0 ④ maxImpulse로 캡.

## 5. Config 추가

```js
challenge: { interval: 5, startHeight: 1.5, perMeter: 0.6, maxImpulse: 2.5 },
```
(시작값 — 플레이로 튜닝 전제: 너무 가혹/미약하면 interval·perMeter·startHeight 조정.)

## 6. Session 통합 (요지)

- 생성자: `this._wobbleT = 0; this._wobbleSign = 1;`
- `update(dt, input)`: 물리 step 직전에 `this._wobbleT += dt; if (this._wobbleT >= CONFIG.challenge.interval) { this._wobbleT = 0; this._applyWobble(); }`
- `_applyWobble()`: `top = towerHeight(bodies, trayTopY)`; 임계 미만이면 return; `_wobbleSign *= -1`; 각 바디에 `mag = wobbleImpulse(b.y - trayTopY, top, CONFIG.challenge)`(>0면) `b.wakeUp()` + `applyImpulse((sign*mag, 0, jitterZ))`; 끝에 `cameraRig?.shake(0.12)`.
- 점수/콤보/라운드/사보타지/_resolveSettles/dispose/height 전부 불변.

## 7. 보존 / 비범위

- **불변:** 점수·콤보·라운드·사보타지·손 메커닉·카메라·입력.
- **비범위(후순위/타 단계):** 흔들림 사전 경고(telegraph) UI, 흔들림 오디오 큐, 교차/오버행 점수 보너스, MP 밸런스 재검증(Phase C), B2 고급 UI.

## 8. 테스트

- **Unit(Vitest):** `challenge.test.ts` — `wobbleImpulse` 임계/스케일/캡/음수.
- **e2e(Playwright):** 솔로 라운드가 흔들림 활성 상태에서 0 콘솔 에러로 진행(기존 솔로 라운드 케이스가 커버; 흔들림은 `Session.update` 내부라 자동 활성). 추가로, 충분히 쌓은 뒤 일정 시간 경과 시 바디 위치가 변함(흔들림 작용)을 라이트하게 확인 가능하나 물리 비결정성으로 **0-에러 + 라운드 완료**를 주 게이트로 둔다.
- 전체 게이트(lint/type/unit/e2e) 그린.

## 9. 미해결 / 후속

- 흔들림 주기·세기·임계 튜닝(플레이).
- 사전 경고(telegraph)·오디오 큐 채택 여부.
- MP에서 흔들림+사보타지 동시 밸런스(Phase C).
- B2(고급 tilt/수동카메라 UI) 별도.
