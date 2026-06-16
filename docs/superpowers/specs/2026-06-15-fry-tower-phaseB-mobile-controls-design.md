# Fryffel Tower — Phase B1: 모바일 컨트롤 (Design Spec)

**Date:** 2026-06-15
**Status:** Draft — pending user review → implementation planning
**Repo:** `Mini-Games` (Fryffel Tower, 5th game)
**Builds on:** Phase A hand-overhaul (branch `fry-tower-hand-overhaul-phaseA`, unmerged) — `2026-06-15-fry-tower-hand-overhaul-design.md`
**Scope:** Phase B decomposes into B1(mobile) · B2(advanced-control UI) · B3(scoring/challenge). **This spec = B1 only.**

---

## 1. 문제 / 동기

Phase A가 솔로를 **3D 손 메커닉**(X·Z·yaw·tilt·높이 + 모멘텀 + 궤도 카메라)으로 바꿨다. 데스크톱 키는 전부 동작하지만, **모바일 터치는 부분 지원만** 남았다:
- 작동: 캔버스 드래그=X/Z 이동, `⟲ ⟳` 버튼=yaw, 탭=놓기.
- **빠짐:** 터치로 **카메라 시점**을 돌릴 방법이 없음(팔-카메라 연동이 Phase A 핵심인데 모바일에선 못 씀 → 3D 더미의 깊이 파악이 어려움).
- 미정: 터치에서 "놓기"의 손맛(모멘텀) 처리.

Mini-Games 허브는 모바일 접근이므로, 새 메커닉이 **폰에서 제대로 플레이되게** 하는 것이 B1의 목표다.

## 2. 제어 모델 (확정)

**코어 전용 · 조준-후-탭 · 한 손가락이면 충분.** ("균형" 포지셔닝의 *접근성* 축.)

| 입력 | 동작 | 현재 |
|---|---|---|
| 캔버스 **드래그** | 손 X/Z 이동 (가로=좌우 X, 세로=앞뒤 Z/깊이) | 작동 (데드존·`preventDefault`·`setPointerCapture` 유지) |
| 캔버스 **탭** | 놓기 | 작동 |
| **⟲ / ⟳** 버튼 | yaw 회전 (교차) | 작동 (`#rot-left`/`#rot-right` → `state.yawL/yawR`) |
| **🔄 시점** 버튼 *(신규)* | 탭마다 카메라 단계 회전(제한 궤도 범위 내 순환), **팔도 따라감** | 신규 |

### 2.1 터치 "놓기" = 모멘텀 없음(정밀)
데스크톱의 모멘텀 스킬(손 속도가 감자튀김에 전달)은 **데스크톱 전용**으로 둔다. 모바일은 *드래그로 조준 → 손 떼고 → 탭으로 놓기*다. 탭 시점엔 손이 능동적으로 움직이지 않으므로 `handVel`이 자연히 ~0으로 감쇠(`CONFIG.momentum.smooth`) → **항상 살포시·정밀**. 별도 코드 분기/입력원 결합 없이 성립. (플레이테스트에서 간헐적 튐이 보이면 그때 명시적 0-모멘텀 가드를 추가; 지금은 자연 감쇠에 의존.)

### 2.2 제외(자동)
- **tilt·높이 미세조정**: 모바일 비노출(자동 hover). (고급 노출은 B2/후순위.)
- **assist 버튼 없음**: 터치는 §2.1로 이미 항상 부드러움 → 불필요. 버튼 수 최소화.
- **reset 버튼 없음**: 조준-후-탭은 리셋 필요가 적음. 시점은 순환에 정면 각도가 포함되어 자연 복귀(§3).

## 3. 신규: 시점(카메라) 단계 회전

데스크톱 `CameraRig`는 `orbit(delta)`로 yaw를 **연속** 변경하고 `[CONFIG.camera.yawMin, yawMax]`(≈`[-0.7, 0.9]rad`, 제한된 3/4 범위)로 클램프한다. 모바일 시점 버튼은 **탭당 한 단계**다.

- `CameraRig`에 **프리셋 각도 순환 + 부드러운 보간** 추가:
  - 프리셋 예: `[-0.5, 0.16, 0.7]`(좌·정면(=startYaw)·우) — 제한 범위 내 3각도.
  - `orbitStep()`: 다음 프리셋을 **목표 yaw**(`_targetYaw`)로 설정, 순환(좌→정면→우→좌…).
  - `update(dt)`는 `yaw`를 `_targetYaw`로 부드럽게 lerp(탭 시 카메라가 스윙).
  - 데스크톱 `orbit(delta)`는 `yaw`와 `_targetYaw`를 **함께** 즉시 설정 → 기존 연속 동작 불변(보간 무효).
- **팔 추종 불변:** azimuth = yaw를 Session/HandRig가 그대로 공유하므로 시점 단계 회전 시 팔도 같이 돈다(Phase A 로직 재사용, 추가 작업 없음).
- 솔로/MP 루프는 `if (input.takeViewStep()) cameraRig.orbitStep();` 한 줄만 추가.

## 4. 입력 인터페이스 추가

`core/Input.js`에 **1회성 시점 액션** 추가(`takeDrop` 패턴과 동일):
- 내부 `_viewQueued`, 공개 `takeViewStep()`(read-and-clear).
- `🔄 시점` DOM 버튼(`#view-btn`) `pointerdown` → `_viewQueued = true`(+`preventDefault`).
- 기존 `state`/`take*`(드롭·assist·reset·yaw 버튼) 전부 불변.

## 5. 레이아웃 / 발견성

- **버튼 배치(터치 전용, coarse-pointer CSS):** 좌하단 `⟲ ⟳`(yaw) · 우하단 `🔄`(시점). `🔊` 음소거는 그대로(우상단). 48px+ 타깃, `env(safe-area-inset-*)` 패딩. 기존 `#touch-controls` 패턴 확장.
- **발견성 — 1회 힌트:** 첫 모바일 플레이 시 짧은 오버레이(자동 ~4초/탭 닫기, `localStorage` 1회): "드래그=이동 · ⟲ ⟳=회전 · 탭=놓기 · 🔄=시점". 깊이=세로 드래그를 한 줄로 안내해 직관성 보완.
- coarse-pointer(터치)에서만 노출(기존 미디어쿼리 패턴).

## 6. 보존 / 비범위

- **불변:** 데스크톱 키 컨트롤, 솔로/MP 게임 로직, Phase A azimuth 공유, 사보타지/점수/라운드.
- **비범위(후순위/타 단계):** 두 손가락 제스처(궤도/yaw), 모바일 tilt·높이 노출(B2), 조준 가이드라인/손 그림자, 정면-리셋 별도 버튼.

## 7. 통합 대상 (예상)

- `render/CameraRig.js`: `_targetYaw` + lerp, `orbitStep()`, 프리셋.
- `core/Input.js`: `_viewQueued` + `takeViewStep()` + `#view-btn` 배선.
- `main.js` + `play/Multiplayer.js`: 루프에 `takeViewStep()→orbitStep()` 한 줄.
- `index.html`: `🔄 #view-btn` 추가, 1회 힌트 오버레이 요소.
- `style.css`: 시점 버튼·힌트 레이아웃·safe-area·coarse-pointer 가시성.
- `main.js`(또는 작은 헬퍼): 1회 힌트 표시 로직(`localStorage`).

## 8. 테스트

- **e2e(Playwright 모바일 컨텍스트, `hasTouch`/`isMobile`):** 기존 touch 케이스 확장 —
  - 드래그 이동 + 탭 드롭으로 `placed>0`(기존).
  - **시점 버튼 탭 → 카메라 시점 변화 확인:** `window.__fry.session.azimuth`(이미 매 프레임 `cameraRig.azimuth`를 미러링 — 새 노출 불필요)를 탭 전후로 읽어 변했는지 + 0 에러. (보간이라 탭 후 몇 프레임 대기.)
  - yaw 버튼 탭 후 0 에러.
- 전체 게이트(lint/type/unit/e2e) 그린.

## 9. 미해결 / 후속

- 시점 프리셋 각도·개수 미세조정(플레이 감).
- 깊이=세로드래그 추가 시각 가이드 필요 여부(플레이테스트 후).
- 모멘텀 명시적 0-가드 필요 여부(간헐적 튐 관찰 시).
- B2(고급 tilt/수동카메라 UI)·B3(점수/도전)는 별도 스펙.
