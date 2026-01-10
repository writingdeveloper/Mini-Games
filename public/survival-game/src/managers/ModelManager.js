// ModelManager - 3D 모델 로딩 및 캐싱 관리

export class ModelManager {
  constructor(game) {
    this.game = game;
    this.modelCache = new Map();
    this.loadingPromises = new Map();

    // 모델 설정 - 여기서 모델 경로와 스케일을 관리
    this.modelConfigs = {
      // 나무 모델들
      tree: {
        path: '/survival-game/models/',
        file: 'tree.glb',
        scale: 2,
        yOffset: 0
      },
      tree_pine: {
        path: '/survival-game/models/',
        file: 'tree_pine.glb',
        scale: 2,
        yOffset: 0
      },

      // 건물 모델들
      building_house: {
        path: '/survival-game/models/',
        file: 'building_house.glb',
        scale: 1,
        yOffset: 0
      },
      building_apartment: {
        path: '/survival-game/models/',
        file: 'building_apartment.glb',
        scale: 1,
        yOffset: 0
      },
      building_tower: {
        path: '/survival-game/models/',
        file: 'building_tower.glb',
        scale: 1,
        yOffset: 0
      },

      // 차량 모델들
      vehicle_car: {
        path: '/survival-game/models/',
        file: 'car.glb',
        scale: 1,
        yOffset: 0
      },
      vehicle_tank: {
        path: '/survival-game/models/',
        file: 'tank.glb',
        scale: 1,
        yOffset: 0
      },
      vehicle_helicopter: {
        path: '/survival-game/models/',
        file: 'helicopter.glb',
        scale: 1,
        yOffset: 0
      }
    };

    // 모델 사용 활성화 플래그
    this.useModels = {
      trees: true,
      buildings: true,
      vehicles: true
    };
  }

  get scene() {
    return this.game.scene;
  }

  /**
   * 모델을 로드하고 캐시합니다
   * @param {string} modelKey - modelConfigs의 키
   * @returns {Promise<BABYLON.AssetContainer|null>}
   */
  async loadModel(modelKey) {
    const config = this.modelConfigs[modelKey];
    if (!config) {
      console.warn(`모델 설정을 찾을 수 없습니다: ${modelKey}`);
      return null;
    }

    // 이미 캐시에 있으면 반환
    if (this.modelCache.has(modelKey)) {
      return this.modelCache.get(modelKey);
    }

    // 이미 로딩 중이면 해당 Promise 반환
    if (this.loadingPromises.has(modelKey)) {
      return this.loadingPromises.get(modelKey);
    }

    // 새로 로딩 시작
    const loadPromise = this._loadModelAsync(modelKey, config);
    this.loadingPromises.set(modelKey, loadPromise);

    try {
      const container = await loadPromise;
      this.modelCache.set(modelKey, container);
      this.loadingPromises.delete(modelKey);
      return container;
    } catch (error) {
      this.loadingPromises.delete(modelKey);
      console.warn(`모델 로드 실패 (${modelKey}): ${error.message}`);
      return null;
    }
  }

  async _loadModelAsync(modelKey, config) {
    try {
      const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
        config.path,
        config.file,
        this.scene
      );
      console.log(`모델 로드 성공: ${modelKey}`);
      return container;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 캐시된 모델의 인스턴스를 생성합니다
   * @param {string} modelKey - modelConfigs의 키
   * @param {BABYLON.Vector3} position - 위치
   * @param {number} rotationY - Y축 회전 (라디안)
   * @param {number} customScale - 커스텀 스케일 (선택사항)
   * @param {object} options - 추가 옵션 { pickRandom: boolean, meshIndex: number }
   * @returns {Promise<BABYLON.TransformNode|null>}
   */
  async createModelInstance(modelKey, position, rotationY = 0, customScale = null, options = {}) {
    const container = await this.loadModel(modelKey);
    if (!container) {
      return null;
    }

    const config = this.modelConfigs[modelKey];
    const scale = customScale || config.scale;

    // 컨테이너에서 인스턴스 생성
    const entries = container.instantiateModelsToScene(
      (name) => `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );

    if (entries.rootNodes.length === 0) {
      console.warn(`모델에 루트 노드가 없습니다: ${modelKey}`);
      return null;
    }

    const root = entries.rootNodes[0];

    // 팩에 여러 모델이 있을 경우 랜덤 또는 특정 인덱스로 하나만 선택
    if (options.pickRandom) {
      // 모든 메시 가져오기
      const allMeshes = root.getChildMeshes();

      // 디버그: 모델 구조 출력
      console.log(`모델 구조 (${modelKey}):`, {
        rootNodes: entries.rootNodes.length,
        allMeshes: allMeshes.length,
        meshNames: allMeshes.map(m => m.name)
      });

      if (allMeshes.length > 1) {
        // 메시 이름으로 그룹화 (예: Tree_1, Tree_2 등)
        const meshGroups = new Map();
        allMeshes.forEach(mesh => {
          // 메시 이름에서 기본 이름 추출 (예: "Tree_1_primitive0" -> "Tree_1")
          const baseName = mesh.name.split('_primitive')[0].split('_instance')[0];
          const groupKey = baseName.replace(/_\d+$/, ''); // 숫자 제거

          if (!meshGroups.has(baseName)) {
            meshGroups.set(baseName, []);
          }
          meshGroups.get(baseName).push(mesh);
        });

        const groupKeys = Array.from(meshGroups.keys());
        console.log('메시 그룹:', groupKeys);

        if (groupKeys.length > 1) {
          // 하나의 그룹만 선택
          const selectedIndex = options.meshIndex !== undefined
            ? options.meshIndex % groupKeys.length
            : Math.floor(Math.random() * groupKeys.length);

          const selectedKey = groupKeys[selectedIndex];
          console.log(`선택된 그룹: ${selectedKey} (인덱스: ${selectedIndex})`);

          // 선택되지 않은 그룹 숨기기
          groupKeys.forEach((key, idx) => {
            if (idx !== selectedIndex) {
              meshGroups.get(key).forEach(mesh => {
                mesh.setEnabled(false);
              });
            }
          });
        }
      }
    }

    root.position = position.clone();
    root.rotation.y = rotationY;
    root.scaling = new BABYLON.Vector3(scale, scale, scale);

    // 모델의 바운딩 박스를 계산하여 바닥에 맞춤
    const enabledMeshes = root.getChildMeshes().filter(m => m.isEnabled());
    if (enabledMeshes.length > 0) {
      // 전체 바운딩 박스 계산
      let minY = Infinity;
      enabledMeshes.forEach(mesh => {
        mesh.computeWorldMatrix(true);
        const boundingInfo = mesh.getBoundingInfo();
        const worldMin = boundingInfo.boundingBox.minimumWorld;
        if (worldMin.y < minY) {
          minY = worldMin.y;
        }
      });

      // 모델이 지면에 닿도록 Y 오프셋 조정
      if (minY !== Infinity) {
        const yAdjust = position.y - minY;
        root.position.y += yAdjust + config.yOffset;
      }
    } else {
      root.position.y += config.yOffset;
    }

    // 그림자 캐스터 추가
    if (this.game.shadowGenerator) {
      root.getChildMeshes().forEach(mesh => {
        if (mesh.isEnabled()) {
          this.game.shadowGenerator.addShadowCaster(mesh);
          mesh.receiveShadows = true;
        }
      });
    }

    return root;
  }

  /**
   * 모델이 존재하는지 확인합니다 (로드를 시도하지 않고)
   * @param {string} modelKey
   * @returns {boolean}
   */
  hasModelConfig(modelKey) {
    return this.modelConfigs.hasOwnProperty(modelKey);
  }

  /**
   * 모델이 로드되었는지 확인합니다
   * @param {string} modelKey
   * @returns {boolean}
   */
  isModelLoaded(modelKey) {
    return this.modelCache.has(modelKey);
  }

  /**
   * 모든 모델을 미리 로드합니다
   * @param {string[]} modelKeys - 로드할 모델 키 배열
   */
  async preloadModels(modelKeys) {
    const promises = modelKeys.map(key => this.loadModel(key));
    await Promise.allSettled(promises);
    console.log('모델 프리로드 완료');
  }

  /**
   * 모델 설정을 동적으로 추가합니다
   * @param {string} key - 모델 키
   * @param {object} config - 모델 설정
   */
  addModelConfig(key, config) {
    this.modelConfigs[key] = {
      path: config.path || '/survival-game/models/',
      file: config.file,
      scale: config.scale || 1,
      yOffset: config.yOffset || 0
    };
  }

  /**
   * 캐시를 정리합니다
   */
  clearCache() {
    this.modelCache.forEach((container) => {
      container.dispose();
    });
    this.modelCache.clear();
  }
}
