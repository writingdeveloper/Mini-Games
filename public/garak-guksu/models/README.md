# /garak-guksu/models — 3D 에셋 (glTF)

[3d-asset-studio](../../../../3d-asset-studio) (ComfyUI-3D · Hunyuan3D 2.1)로 생성한 게임용 `.glb` 에셋을 둡니다.

- `models.js`가 `preloadModel(key, url, targetSize)`로 프리로드 → `attachModel`이 해당 절차적 메시를 대체. **파일이 없으면 절차적 폴백**(게임은 항상 동작).
- 정규화: 로드 시 바운딩박스 중심 정렬 + maxDim→targetSize 스케일(`normalizeModel`). 방향/스케일 미세조정은 호출부 `targetSize`·필요 시 회전으로.
- 생성 방법: ComfyUI-3D(:8189) 기동 후 `3d-asset-studio/scripts/submit_text_to_3d.ps1 -Prompt "..." -Output <name> -Texture` → `ComfyUI output\<name>.glb` → QA → 여기로 복사.

현재 에셋:
- `garak_bowl.glb` — 가락국수 한 그릇(들고 있는 그릇). 스타일라이즈드.
