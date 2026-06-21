# 역전국수 컨셉 오버홀 설계 (Addendum)

> 기존 `2026-06-20-garak-guksu-design.md`(설계 LOCKED)를 잇는 오버홀. 게임 코드: `public/garak-guksu/` (빌드 없는 ESM, THREE는 index.html importmap의 three@0.184.0).

## 1. 문제 (실측 진단)

1. **WASD·조이스틱 전(全) 축 반전.** `scene.js`에서 `camera.position=(0,7.5,-7)`, `lookAt=(0,0.5,1.5)` — 카메라가 −z에서 **+z를 바라봄**. 따라서 "화면 위 = 월드 +z", "화면 오른쪽 = 월드 −x". 그러나 `input.js` `MOVE`는 `W=[0,-1]`, `A=[-1,0]` … 로 **정확히 반대로** 매핑(조이스틱 동일). 코드 주석의 "no inversion needed" 단정이 오진의 원인.
2. **체인소맨(레제·마키마) 합성 음성 11종.** 1980년대 한국 기차역 가락국수 컨셉과 정면 충돌(몰입 파괴). `audio.js` `VOICE_FILES` → `/garak-guksu/audio/*.wav`.
3. **비주얼이 컨셉 부재.** 기차·플랫폼·증기·역 사인 전무. 어두운 추상 주방만 렌더 → "역전 가락국수"가 와닿지 않음.

## 2. 결정 (사용자 승인)

- **음성**: 분위기 사운드(WebAudio 합성)로 전면 교체. 인물 음성 없음. 진짜 한국어 인물 음성은 별도 스펙(`docs/garak-guksu-voice-spec.md`)으로 추후 voice-studio 생성 → 옵셔널 드롭인.
- **비주얼**: 풀 플랫폼 장면. **실사 사진 배경(매트페인팅) + 절차적 전경**.
- **배경 에셋**: Pexels 30068944 "vintage night train station, warm lighting"(İrem Yılmaztürk, Pexels License) → `public/garak-guksu/img/platform-bg.jpg` (2400×1350). 무드는 사진으로, **한국 특정성은 전경의 한글 역명판·가락국수 간판·역 안내 PA**로 확보.

## 3. 작업 항목

### A. 컨트롤 정상화
- `input.js` `MOVE` 부호 반전 → `W[0,1] S[0,-1] A[1,0] D[-1,0]` (+ Arrow 동일). 오해 주석 정정.
- `main.js` 조이스틱: `input.setTouchDir(-dx/len*cl, -dy/len*cl)` (knob 비주얼은 손가락 방향 유지). "no inversion" 주석 교체.
- 회귀 테스트: 고정 매핑에서 KeyW→z>0, KeyD→x<0 검증.

### B. 플랫폼 장면 (`scene.js` + 신규 `station.js`)
- **배경판**: `TextureLoader('/garak-guksu/img/platform-bg.jpg')`, 대형 평면 z≈+12·카메라 향함, 웜 틴트+약간 어둡게+fog 인지, 하단 그라데이션으로 바닥 블렌드(텍스처 실패 시 폴백 컬러).
- **전경 소품**(절차적, models.js 스타일): 근경 기둥, 매달린 백열등(PointLight+emissive 갓), 플랫폼 가장자리+노란 안전선, 캐노피 빔.
- **역 사인**: CanvasTexture 역명판 "대전 / DAEJEON"(고전 청색판), 발차 안내판(가능하면 `dwellLeft` 미러).
- **가락국수 포장마차 간판**(전경 한글 "역전 가락국수") — 컨셉 못박기.
- **증기 파티클**: `THREE.Points` 상승+페이드, 웨이브별 농도(증기 진→막차 옅), reduced-motion 존중.
- `ERA_MOOD` 확장: 배경 틴트/스팀농도/등 밝기. **막차에도 플레이영역 가독**(현 어두움 지적 반영). result 크래시 회귀 확인.

### C. 오디오 (신규 `sfx.js`, `audio.js` 대체)
- `createSfx()` WebAudio: master gain=뮤트, `cue(name)` = order/serve/combo/leave/pa/start/cook(전부 osc+noise+env 합성), `ambience(era)` 베드(스팀 히스+먼 기적), `resume()`(첫 제스처).
- `main.js` 호출 치환: chefReady→`cue('start')`+ambience, leave→`cue('leave')`, 주문(r%4 블록)→`cue('order')` 단일, pa→`cue('pa')`+화면 안내 텍스트, combo→`cue('combo')`, happy→`cue('serve')`.
- 11 CSM wav 로딩/파일 제거. `MUTE_KEY 'garak-guksu-muted'` 유지.
- 보너스: `docs/garak-guksu-voice-spec.md`(주인장·손님5·역안내 대사/길이/톤) + 옵셔널 voice 레이어 훅.

### D. 폴리시 & 검증
- HUD 모바일 반응형(7칸 겹침/뮤트·홈 간섭 수정).
- a11y: PA aria-live, 스팀 `prefers-reduced-motion`, mute `aria-pressed`.
- `window.__garak`에 QA용 `get playerX/playerZ`(또는 player) 노출.
- 게이트: 가락 유닛(현 47)+방향·모듈 스모크 테스트, E2E(현 6) 유지. 콘솔 0 에러.

## 4. 실행 (Ultracode 워크플로우)
- **P1**(병렬, 디스조인트 파일): `station.js` / `sfx.js` / `input.js`.
- **P2**(순차, 단일 통합자): `scene.js`·`main.js`·`audio.js`·`index.html` 배선.
- **P3**(병렬): 테스트 · 적대적 리뷰 · voice-spec.
- → 메인루프에서 **실제 화면 QA**(Playwright 정적 서빙, WASD 4방향·플랫폼·스팀 스크린샷 전/후, 콘솔 에러 0), 시각 반복 폴리시.
- 배포: QA 통과 후 **사용자 승인 시** `feat/garak-guksu` → `origin/main`.

## 5. 비목표 (YAGNI)
- co-op(구조만), 인물 음성(이번엔 스펙만), 신규 기믹/웨이브 밸런스 변경 없음. 공간 배치(조리대 앞·손님/기차 뒤)·카메라 구도 보존.
