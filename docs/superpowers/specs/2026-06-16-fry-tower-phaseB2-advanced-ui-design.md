# Fryffel Tower — Phase B2: 고급 컨트롤 UI (Design Spec)

**Date:** 2026-06-16
**Status:** Design (autonomous per user delegation) → plan → implement
**Repo:** `Mini-Games` (Fryffel Tower, 5th game)
**Builds on:** Phase A + B1 + B3 (merged + deployed to prod). Phase B remaining piece.

---

## 1. 문제 / 동기

손-오버홀로 컨트롤이 풍부해졌지만(이동·깊이·yaw·**tilt**·**높이**·**카메라**·놓기·**보정(assist)**·**리셋**), 게임 내에 **전체 컨트롤 레퍼런스가 없다.** 시작 메뉴의 기본 4개 힌트 + 모바일 1회 힌트가 전부라 고급 키(Z/X tilt, W/S 높이, [ ] 카메라, A 보정, R 리셋)는 미문서. 특히 **보정(assist)은 상태 표시가 전혀 없고** 'A' 키로만 토글된다(있는지조차 모름). Phase B의 "고급(advanced)" 축 = 이 고급 컨트롤들을 **노출·문서화**한다.

## 2. 설계 (확정)

**컨트롤 도움말 오버레이 + 보정 토글 + 도움말 중 일시정지.**

- **`#help-btn` (❔):** 항상 접근 가능(우상단, 음소거 버튼 왼쪽). 탭하면 도움말 오버레이 토글.
- **`#help-overlay` (`.overlay`/`.panel` 재사용):**
  - **전체 컨트롤 2열 그리드** — 데스크톱: `← →` 좌우 · `↑ ↓` 앞뒤(깊이) · `Q/E` 회전 · `Z/X` 기울이기 · `W/S` 높이 · `[ ]` 카메라 · `Space` 놓기 · `A` 보정 · `R` 리셋. 모바일: 드래그=이동 · 탭=놓기 · `⟲⟳`=회전 · `🔄`=시점.
  - **보정(assist) 토글 버튼** — 현재 상태(ON/OFF) 표시 + 탭하면 `session.assist` 반전. (보정 = 놓을 때 모멘텀을 줄여 정밀 배치; 데스크톱 'A'와 동기화.)
  - **닫기:** `✕` 버튼 · 오버레이 바깥 탭 · `Esc`.
- **일시정지:** 도움말이 열려 있는 동안 `session.paused = true` → `Session.update`가 조기 반환(스티어링·물리·타이머 정지). 닫으면 해제. 읽는 동안 시간 손해/타워 붕괴 없음. (씬은 그대로 렌더되어 뒤에 보임.)
- **스타일:** 기존 `.overlay`/`.panel`/`.controls`/`.btn-primary` 카툰 스타일 재사용. `#help-btn`은 `#mute-btn` 패턴(원형, 우상단). coarse-pointer 반응형.

## 3. 보존 / 비범위

- **불변:** 게임 메커닉·점수·B1 모바일 코어(드래그/탭/⟲⟳/🔄)·B3 흔들림·MP 로직.
- **모바일 tilt/높이 버튼은 추가하지 않음**(B1의 깔끔한 코어 유지; 고급 키는 도움말에 문서화로 충분, 모바일은 aim-then-tap이라 tilt/높이 니즈 낮음).
- **비범위:** 설정/옵션 패널(볼륨 등은 기존 mute로 충분), 키 리바인딩, 모바일 고급 제스처.

## 4. 통합 대상

- `index.html`: `#help-btn` + `#help-overlay`(컨트롤 그리드 + 보정 토글 + 닫기) 마크업.
- `style.css`: `#help-btn`(mute 패턴) + 오버레이 내부 스타일 + coarse 반응형.
- `src/play/Session.js`: `this.paused = false` + `update()` 조기 반환(`if (this.paused) return;`).
- `src/main.js`: 도움말 열기/닫기 배선(`session.paused` 토글), 보정 토글 버튼 배선(+상태 라벨), Esc/바깥탭 닫기.
- `src/ui/HUD.js`: (선택) 보정 버튼 라벨을 `session.assist`로 매 프레임 동기화('A' 키로 바뀌어도 반영).
- `e2e/fry-tower-game.spec.ts`: 도움말 열기→오버레이 보임·일시정지(타이머 정지)·보정 토글·닫기, 0 에러.

## 5. 테스트

- **e2e:** 솔로 시작 → `#help-btn` 탭 → `#help-overlay` 보임 + `session.round.timeLeft`가 잠시 후에도 동일(일시정지) + 보정 토글 탭 시 `session.assist` 반전 + 닫기 → 게임 재개(타이머 다시 감소). 0 콘솔 에러.
- 전체 게이트(lint/type/unit/e2e) 그린.

## 6. 미해결 / 후속

- 도움말에 짧은 전략 팁(교차=안정/수직=고득점) 추가 여부(후순위).
- Phase C: MP 재검증·손 메시·색·흔들림 튜닝.
