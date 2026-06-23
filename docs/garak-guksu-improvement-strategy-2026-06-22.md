# 역전국수(garak-guksu) 전반 개선 전략 — 2026-06-22

## 배경
사용자 요청(원문 요지): ① 시야 시점이 너무 확대된 느낌 → 자연스럽게, ② 구현된 3D 에셋끼리 닿았을 때 관통하지 않도록, ③ 손·행동 모션 추가, ④ 전반적 게임 자유도 상향, ⑤ 식당 창고 구역 신설, ⑥ Three.js로만 만든 바닥·식탁을 3D 에셋으로 자연스럽게.

가용 파이프라인: **음성**(voice-studio MCP → 원격 RTX 4080, `design_voice`), **3D**(3d-asset-studio, 로컬 ComfyUI-3D `:8189`, `submit_text_to_3d.ps1 -Texture`).
불변 지침: **복잡한 물건·벽·인프라 = 3d-asset-studio(AI), 아주 간단한 것만 Three.js 직접.**

검토 방식: **Workflow 병렬 6차원 코드리뷰**(카메라/충돌/모션/자유도/창고/바닥·식탁) + 전략 합성. (카메라·충돌 2개는 rate-limit으로 별도 재실행.)

## 진단 (6차원, 코드 근거)
| 차원 | 핵심 발견 | 근거 |
|------|-----------|------|
| 🎥 카메라/시야 | FOV가 **46°(수직) 단일값**으로 4모드 공유 → 1인칭에도 그대로. 1인칭 표준(60–75°)보다 좁아 원근 압축 = "확대" 느낌 | `scene.js:88` |
| 🧱 에셋 충돌 | `movePlayer`가 주방 박스 경계만 clamp, **충돌 코드 0줄**. 외곽(기차·기둥·손님)은 박스가 이미 차단 → **막을 내부 에셋은 8개뿐**(작업대4+화덕1+진열대3) | `logic.js:128-133` |
| 🙌 손·행동 모션 | 액션 모션 전부가 `cookBump` 스칼라 1개 — 4조리 동작이 똑같은 까딱, **1인칭에서만** 보임. 손은 관절 없는 구 2개, idle/걷기 흔들림 없음 | `scene.js:166/313/316` |
| 🎮 게임 자유도 | z=-1.5 한 줄 조리대를 왕복하는 단일 차선. 1손·선형 파이프라인·단일 양념축. 미리만들기는 구현됐으나 보상 없어 死기능 | `logic.js:16-21` |
| 📦 창고 | 재고 개념 자체가 코드에 없음(무한 재료). +z·-z 다 막혀 창고는 우측(+x) 확장이 유일 | `logic.js:58-81` |
| 🏠 바닥·식탁 | 전부 단색 BoxGeometry(스토브만 AI). 바닥 텍스처 0, 작업대 평면 박스 | `models.js:85-99` |

## 결정사항 (2026-06-22, 사용자 선택)
1. **착수 범위 = Phase 0 먼저** (구현→배포→검증 후 나머지 결정)
2. **자유도 방향 = 편의 위주부터** (미리만들기 버퍼·동선 개선 → 추후 양손/쟁반 검토; 주문 다축화는 후순위/보류)
3. **창고 = 별도 창고 공간** (독립 구역/미니루프, 범위 큼 — `restock`을 별도 씬 진입점으로 승격)
4. **손 = 현재 손 + 모션만** (절차적 손가락 분리·AI 3D 손 둘 다 안 함 — 구 형태 유지, 동작 제스처로 생동감)

## 로드맵
- **Phase 0 — 즉효 수정** (저위험, 파이프라인 거의 불필요) ⭐ 사용자 2대 불만 직결 ← **현재 착수**
- **Phase 1 — 모션 완성** (code-only): 서빙 내미는/놓기 제스처 + 실화면 시각QA
- **Phase 2 — 주방 공간 1회 재설계**: 조리대 2단 + KITCHEN 경계 +x 확장(창고 자리) + 바닥/그림자 카메라. ⚠ Phase 0 충돌 blocker 좌표 동반 갱신
- **Phase 3 — AI 에셋 인프라화** (asset3d, 폴백 위 → 회귀 0): 작업대 .glb + 창고 가구 + 등 뒤 주방 벽 + 톤 통일
- **Phase 4 — 게임 깊이 & 창고 메커니즘** (최고 위험·마지막): 별도 창고 + 재고 소진→보충 + (편의 위주) 미리만들기/쟁반 + 음성 + 밸런스 재튜닝

## Phase 0 상세 (현재 착수)
### 0-1 카메라 FOV (사용자 불만 ①) — S/high/risk낮음/none
- `MODE_FOV = { fixed:46, orbit:46, chase:52, first:64 }`; `applyCamMode(mode)`에서 `camera.fov` 세팅 + `camera.updateProjectionMatrix()`.
- (선택) 1인칭 걷기 헤드밥: `moving`일 때 눈높이에 `sin(t*9)*0.025` 더함, **RM 가드**(멀미 방지, 수직만).
- (선택) 모바일 세로 수평-FOV 보정(Hor+): 1인칭에서 목표 수평 fov 고정.

### 0-2 에셋 충돌 (사용자 불만 ②) — S/high/risk낮음/none
- `PLAYER_RADIUS = 0.32`, `BLOCKERS`(원형) 8개. `movePlayer`가 경계 clamp 후 각 blocker 침투를 법선 방향 push(슬라이드).
- **반경 0.8** (조리대): `0.8 + 0.32 = 1.12 < REACH 1.2` → 조리 판정 보존(핵심 부등식). 진열대 r=0.45.

| # | 대상 | center (x, z) | r |
|---|------|---------------|---|
| 1-4 | 조리대(setting/blancher/broth/garnish) | (-3,-1.5)(-1,-1.5)(1,-1.5)(3,-1.5) | 0.8 |
| 5 | 화덕 | (4.0,-1.5) | 0.6 |
| 6-8 | 진열대(PLACE_SLOTS) | (-2.5,2.3)(0,2.3)(2.5,2.3) | 0.45 |

- 유닛테스트: blocker 중심으로 걸어가 stopDist에 막히는지 + 기존 movePlayer 회귀(원점/경계는 blocker 비충돌).

### 0-3 손·행동 모션 (사용자 요청 ③, 손은 현행 유지) — M/high/none
- `cookMotion()` → `cookMotion(kind)`로 `{kind, t0}` 모션토큰. `main.js` 4호출부: `'noodle'/'blanch'/'pour'/'spice'`.
- `sync`에서 `a=clamp((t-t0)/0.5,0,1)` 진행도 → kind별 sin 궤적(blanch=좌우흔들기, pour=손목기울임, spice=톡톡, noodle=담그기). **1인칭+3인칭 양쪽** 적용. RM이면 스냅.
- `fpHands` idle 호흡(`sin(t*2)*0.012`) + 걷기 bob(`|sin(t*9)|*0.03`, x `sin(t*4.5)*0.02`), 기존 `moving` 재사용, RM이면 0.

### 0-4 미리만들기 보상 (자유도, 편의 위주) — S/med/none
- `serve()`가 근접 진열대(`placed`)의 주문일치 `done` 그릇에서도 서빙 허용(또는 `serveFromShelf`). 死기능 부활 + W5 막차 버퍼 전략.

### 0-5 바닥 텍스처 (사용자 요청 ⑥ 1차) — S/high/asset3d
- ComfyUI-3D `:8189` 재가동 + seamless tileable 콘크리트/테라조 텍스처 1장 → `public/garak-guksu/img/floor.jpg`.
- `createFloor` 머티리얼에 `map`+`RepeatWrapping`(repeat ~3×2), `onError` 시 단색 폴백. 풀 .glb 아님(slab-clean 회피).

## 리스크 / QA
- **충돌 REACH 함정**: 조리대 blocker `r+0.32 < 1.2` 필수(r≤0.8). 신규 유닛테스트로 고정.
- **모션·시각·음성 자동검증 불가**: garak 유닛=logic만, e2e=`__garak` 상태 API만. 헤드리스 무음·무모션 → **Playwright MCP 스크린샷 + 실기기 청취** 필요.
- **AI(asset3d)는 ComfyUI 재가동 선행**. 모든 AI 항목은 폴백 위 → 미생성이어도 게임 동작(회귀 0).
- 게이트: eslint 0 / vitest green / 실화면 콘솔 0. 배포는 검증 통과 시 자동승인(`feat/garak-guksu`→`main`).

## 워크플로 산출물
- 6차원 리뷰 결과(JSON): 세션 task `w2wzm2e9f` output. 합성 phases/openQuestions/risks 포함.
