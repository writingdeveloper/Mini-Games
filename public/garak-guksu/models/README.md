# /garak-guksu/models — 3D 에셋 (glTF)

[3d-asset-studio](../../../../3d-asset-studio) (ComfyUI-3D · Hunyuan3D 2.1)로 생성한 게임용 `.glb` 에셋을 둡니다.

- `models.js`가 `preloadModel(key, url, targetSize, opts)`로 프리로드 → `attachModel`이 해당 절차적 메시를 대체. **파일이 없으면 절차적 폴백**(게임은 항상 동작).
- 정규화(`normalizeModel`): 바운딩박스 중심 정렬 + 스케일. `opts.byHeight`=높이(y)를 targetSize에 맞춤(서있는 캐릭터), `opts.ground`=발(min.y)을 y=0에 정렬(바닥 위). 방향 미세조정은 필요 시 회전으로.
- 생성 방법: ComfyUI-3D(:8189) 기동 후 `3d-asset-studio/scripts/submit_text_to_3d.ps1 -Prompt "..." -Output <name> -Texture` → `ComfyUI output\<name>.glb` → QA → 여기로 복사.

현재 에셋:
- `garak_bowl.glb` — 가락국수 한 그릇(들고 있는 그릇). 스타일라이즈드.
- `garak_loco.glb` — 증기기관차(증기 에라, `station.js` `loadLocoModel`). text→3D 생성 후 **trimesh로 바닥 슬래브 제거**(Hunyuan이 product-shot 바닥을 지오메트리로 만드는 아티팩트 → face-centroid Y 마스크로 절단).
- `garak_chef.glb` — 주인장(셰프). 캐릭터라 Hunyuan 난이도↑: text→3D 정면 단독이미지는 납작 빌보드로 실패 → **3/4 시점+프레임 꽉 채운 이미지로 형상 확보** 후 같은 이미지로 **image→3D(텍스처)** 재생성 → **바닥 슬래브 자동 탐지·제거**(y-레이어별 가로폭 ≈1.97 = 슬래브). `models.js` `preloadModel('chef', …, {ground:true, byHeight:true})`로 바닥정렬·키기준(≈1.5) 부착. 정면 얼굴은 단일이미지 한계로 약간 뭉개지나 게임 카메라는 뒷면을 봄.
