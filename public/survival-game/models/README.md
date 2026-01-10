# 3D Models for Survival Game

이 폴더에 GLB/GLTF 형식의 3D 모델 파일을 넣으면 게임에서 자동으로 로드됩니다.
모델이 없으면 기본 프리미티브(박스, 실린더 등)가 사용됩니다.

## 필요한 모델 파일

### 나무 (Trees)
- `tree.glb` - 일반 나무
- `tree_pine.glb` - 소나무

### 건물 (Buildings)
- `building_house.glb` - 주택
- `building_apartment.glb` - 아파트
- `building_tower.glb` - 타워/고층건물

### 차량 (Vehicles)
- `car.glb` - 자동차
- `tank.glb` - 탱크
- `helicopter.glb` - 헬리콥터

## 무료 3D 모델 다운로드 사이트

### Poly Pizza (추천 - 무료, 로그인 불필요)
- 웹사이트: https://poly.pizza
- 라이센스: CC0 1.0 또는 CC-BY 3.0
- 추천 모델:
  - Trees by Quaternius: https://poly.pizza/m/bFnUrfbGXT
  - Pine Trees by Quaternius: https://poly.pizza/m/5o1sJXE2kn
  - Car by Quaternius: https://poly.pizza/m/aLEiCXRpN5g
  - Sports Car by Quaternius: https://poly.pizza/m/5Udjn3kLdm
  - SUV by Quaternius: https://poly.pizza/m/3jgYhxb23xC

### Kenney Assets (추천 - 완전 무료)
- 웹사이트: https://kenney.nl/assets
- 라이센스: CC0 (퍼블릭 도메인)
- Nature Pack: https://kenney.nl/assets/nature-kit
- City Kit: https://kenney.nl/assets/city-kit-suburban

### Quaternius (추천 - 게임용 무료 에셋)
- 웹사이트: https://quaternius.com
- 라이센스: CC0
- Ultimate Nature Pack: https://quaternius.com/packs/ultimatenature.html
- Ultimate Vehicles Pack: https://quaternius.com/packs/ultimatevehicles.html
- Ultimate Buildings: https://quaternius.com/packs/ultimatebuildings.html

### Sketchfab
- 웹사이트: https://sketchfab.com
- 검색 필터에서 "Downloadable" + "Free" 선택
- GLB 형식으로 다운로드 가능

### CGTrader
- 웹사이트: https://www.cgtrader.com
- 무료 섹션에서 GLB/GLTF 필터 적용

### TurboSquid
- 웹사이트: https://www.turbosquid.com
- 무료 3D 모델 섹션 참고

## 모델 설정 방법

1. 위 사이트에서 GLB 파일을 다운로드합니다.
2. 파일 이름을 위의 필요한 모델 파일 이름에 맞게 변경합니다.
3. 이 폴더(`/models/`)에 파일을 넣습니다.
4. 게임을 새로고침하면 자동으로 모델이 로드됩니다.

## 권장 사양

- **파일 형식**: GLB (권장) 또는 GLTF
- **폴리곤 수**: Low-poly 권장 (1,000 ~ 10,000 폴리곤)
- **텍스처**: 내장 텍스처 권장 (GLB에 포함)
- **스케일**: 1 unit = 1 meter 기준

## 모델 미리보기

다운로드한 모델은 아래 사이트에서 미리 확인할 수 있습니다:
- https://gltf-viewer.donmccurdy.com/
- https://sandbox.babylonjs.com/

## 커스텀 모델 추가

`ModelManager.js`의 `modelConfigs` 객체를 수정하여 새로운 모델을 추가할 수 있습니다:

```javascript
this.modelConfigs = {
  // 기존 모델들...

  // 새 모델 추가
  my_custom_tree: {
    path: '/survival-game/models/',
    file: 'my_tree.glb',
    scale: 2,      // 모델 크기 배율
    yOffset: 0     // Y축 오프셋
  }
};
```

## 라이센스 참고

다운로드한 모델의 라이센스를 확인하세요:
- **CC0**: 자유롭게 사용 가능
- **CC-BY**: 저작자 표기 필요
- **CC-BY-NC**: 비상업적 용도로만 사용 가능
