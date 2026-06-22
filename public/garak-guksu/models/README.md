# /garak-guksu/models — 3D 에셋 (glTF)

[3d-asset-studio](../../../../3d-asset-studio) (ComfyUI-3D · Hunyuan3D 2.1)로 생성한 게임용 `.glb` 에셋을 둡니다.

- `models.js`가 `preloadModel(key, url, targetSize, opts)`로 프리로드 → `attachModel`이 해당 절차적 메시를 대체. **파일이 없으면 절차적 폴백**(게임은 항상 동작).
- 정규화(`normalizeModel`): 바운딩박스 중심 정렬 + 스케일. `opts.byHeight`=높이(y)를 targetSize에 맞춤(서있는 캐릭터), `opts.ground`=발(min.y)을 y=0에 정렬(바닥 위), `opts.rotateY`=Y회전(생성 정면을 게임 기준에 맞춤; 손님은 카메라를 마주봐야 해 `Math.PI`).
- 생성 방법: ComfyUI-3D(:8189) 기동 후 `3d-asset-studio/scripts/submit_text_to_3d.ps1 -Prompt "..." -Output <name> -Texture` → `ComfyUI output\<name>.glb` → QA → 여기로 복사.

현재 에셋:
- `garak_bowl.glb` — 가락국수 한 그릇(들고 있는 그릇). 스타일라이즈드.
- `garak_loco.glb` — 증기기관차(증기 에라, `station.js` `loadLocoModel`). text→3D 생성 후 **trimesh로 바닥 슬래브 제거**(Hunyuan이 product-shot 바닥을 지오메트리로 만드는 아티팩트 → face-centroid Y 마스크로 절단).
- `garak_chef.glb` — 주인장(셰프). 캐릭터라 Hunyuan 난이도↑: text→3D 정면 단독이미지는 납작 빌보드로 실패 → **3/4 시점+프레임 꽉 채운 이미지로 형상 확보** 후 같은 이미지로 **image→3D(텍스처)** 재생성 → **바닥 슬래브 자동 탐지·제거**(y-레이어별 가로폭 ≈1.97 = 슬래브). `models.js` `preloadModel('chef', …, {ground:true, byHeight:true})`로 바닥정렬·키기준(≈1.5) 부착. 정면 얼굴은 단일이미지 한계로 약간 뭉개지나 게임 카메라는 뒷면을 봄.
- `garak_cust_<arche>.glb` — 손님 5아키타입(`soldier`/`worker`/`student`/`couple`/`granny`). `createCustomer`가 절차적 몸통+소품을 `procCust`로 감싸고 아키타입별 `ai_<arche>` 홀더에 GLB 클론을 주입; `scene.js` sync가 해당 손님 아키타입의 GLB가 로드돼 있으면 AI를 쓰고 절차적은 숨김(없으면 폴백). 모두 `{ground, byHeight, rotateY:π}`(키≈1.7, 카메라 응시). 손님 하반신은 조리대에 가려져 작은 받침판은 무시 가능(큰 1.97 슬래브만 `_slabclean` threshold 1.3으로 제거). **단일 인물(군인/회사원/통학생/할머니)은 text→3D -Texture로 안정 생성**. **연인은 2인 나란히 구성이 Hunyuan에서 납작 빌보드로 실패** → 남/여 단일 인물을 따로 생성 후 **trimesh로 나란히 배치해 한 glTF 씬에 2메시로 병합**(텍스처 보존).
- `garak_st_<kind>.glb` — 조리대 4종 장비(`setting` 면트레이 / `blancher` 데치기 솥 / `broth` 멸치육수 가마솥 / `garnish` 고명 캐디). `createStation`이 절차적을 `procStation`으로 감싸고 `attachModel('station_<kind>')`로 대체; `{ground:true}`(카운터 위 바닥정렬, 키≈1.2). ⚠ **slab 자동제거 주의**: setting/blancher/broth는 진짜 바닥 슬래브가 있어 제거(threshold 1.3)했으나, **garnish는 넓은 캐디 본체가 슬래브로 오인돼 과다절단** → **raw 그대로 사용**(객체 자체가 넓으면 slab 휴리스틱이 오작동하므로 렌더로 검수 필수).
