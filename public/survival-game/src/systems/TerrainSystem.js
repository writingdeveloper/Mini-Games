// TerrainSystem - 지형 및 월드 오브젝트 관리

export class TerrainSystem {
  constructor(game) {
    this.game = game;
    this.groundMeshes = [];
    this.ammoPickups = [];
    this.healthPickups = [];
    this.explosiveBarrels = [];
    this.coverObjects = [];
    this.jumpPads = [];
    this.turrets = [];
    this.buildings = [];
    this.trees = []; // 나무 추적용
    this.loadedChunks = new Set();
    this.chunkSize = 50;
  }

  get modelManager() {
    return this.game.modelManager;
  }

  get scene() {
    return this.game.scene;
  }

  noise(x, z) {
    const sin1 = Math.sin(x * 0.1) * Math.cos(z * 0.1);
    const sin2 = Math.sin(x * 0.05 + 1.5) * Math.cos(z * 0.07 + 2.1);
    const sin3 = Math.sin(x * 0.02) * Math.sin(z * 0.02);
    return (sin1 * 0.5 + sin2 * 0.3 + sin3 * 0.2) * 3;
  }

  createProceduralTerrain() {
    this.updateTerrainChunks(new BABYLON.Vector3(0, 0, 0));
  }

  updateTerrainChunks(playerPos) {
    const chunkX = Math.floor(playerPos.x / this.chunkSize);
    const chunkZ = Math.floor(playerPos.z / this.chunkSize);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cx = chunkX + dx;
        const cz = chunkZ + dz;
        const key = `${cx},${cz}`;

        if (!this.loadedChunks.has(key)) {
          this.createTerrainChunk(cx, cz);
          this.loadedChunks.add(key);
        }
      }
    }
  }

  createTerrainChunk(chunkX, chunkZ) {
    const offsetX = chunkX * this.chunkSize;
    const offsetZ = chunkZ * this.chunkSize;

    const ground = BABYLON.MeshBuilder.CreateGround(
      `ground_${chunkX}_${chunkZ}`,
      {
        width: this.chunkSize,
        height: this.chunkSize,
        subdivisions: 20,
        updatable: true
      },
      this.scene
    );

    ground.position = new BABYLON.Vector3(offsetX, 0, offsetZ);

    const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    for (let i = 0; i < positions.length; i += 3) {
      const worldX = positions[i] + offsetX;
      const worldZ = positions[i + 2] + offsetZ;
      positions[i + 1] = this.noise(worldX, worldZ);
    }
    ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    ground.refreshBoundingInfo();

    new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.MESH, { mass: 0, restitution: 0.2, friction: 0.8 }, this.scene);

    // UV 좌표를 월드 좌표 기반으로 변경하여 청크 경계가 보이지 않게 함
    const uvs = ground.getVerticesData(BABYLON.VertexBuffer.UVKind);
    for (let i = 0; i < uvs.length / 2; i++) {
      const worldX = positions[i * 3] + offsetX;
      const worldZ = positions[i * 3 + 2] + offsetZ;
      // 월드 좌표를 UV로 변환 (타일링 스케일 적용)
      uvs[i * 2] = worldX / 6;     // U 좌표
      uvs[i * 2 + 1] = worldZ / 6; // V 좌표
    }
    ground.updateVerticesData(BABYLON.VertexBuffer.UVKind, uvs);

    // 잔디 텍스처 로드
    const grassTexture = new BABYLON.Texture("/survival-game/textures/grass_path_2_diff_4k.jpg", this.scene);
    grassTexture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    grassTexture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;

    const roughnessTexture = new BABYLON.Texture("/survival-game/textures/grass_path_2_rough_4k.jpg", this.scene);
    roughnessTexture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    roughnessTexture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;

    const groundMat = new BABYLON.PBRMaterial(`groundMat_${chunkX}_${chunkZ}`, this.scene);
    groundMat.albedoTexture = grassTexture;
    groundMat.metallicTexture = roughnessTexture;
    groundMat.useRoughnessFromMetallicTextureGreen = true;
    groundMat.roughness = 1;
    groundMat.metallic = 0;
    ground.material = groundMat;
    ground.receiveShadows = true;

    this.groundMeshes.push(ground);

    this.createChunkObjects(offsetX, offsetZ);
    this.createChunkAmmo(offsetX, offsetZ, chunkX, chunkZ);
  }

  createChunkObjects(offsetX, offsetZ) {
    const seed = offsetX * 1000 + offsetZ;
    const random = (i) => {
      const x = Math.sin(seed + i * 127.1) * 43758.5453;
      return x - Math.floor(x);
    };

    // 나무 생성
    const treeCount = 5 + Math.floor(random(0) * 5);
    for (let i = 0; i < treeCount; i++) {
      const x = offsetX + (random(i * 3) - 0.5) * this.chunkSize * 0.9;
      const z = offsetZ + (random(i * 3 + 1) - 0.5) * this.chunkSize * 0.9;
      const y = this.noise(x, z);

      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;

      // 3D 모델 사용 시도
      this.createTree(new BABYLON.Vector3(x, y, z), random(i * 3 + 2), i);
    }

    // 바위 생성
    const rockCount = 3 + Math.floor(random(50) * 4);
    for (let i = 0; i < rockCount; i++) {
      const x = offsetX + (random(i * 5 + 100) - 0.5) * this.chunkSize * 0.9;
      const z = offsetZ + (random(i * 5 + 101) - 0.5) * this.chunkSize * 0.9;
      const y = this.noise(x, z);

      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;

      const rockSize = 0.5 + random(i * 5 + 102) * 1.5;
      const rock = BABYLON.MeshBuilder.CreatePolyhedron(`rock_${x}_${z}`, {
        type: Math.floor(random(i * 5 + 103) * 3),
        size: rockSize,
      }, this.scene);
      rock.position = new BABYLON.Vector3(x, y + rockSize * 0.4, z);
      rock.rotation = new BABYLON.Vector3(random(i) * 0.3, random(i + 1) * Math.PI * 2, random(i + 2) * 0.3);

      const rockMat = new BABYLON.PBRMaterial(`rockMat_${x}_${z}`, this.scene);
      const gray = 0.35 + random(i * 5 + 104) * 0.2;
      rockMat.albedoColor = new BABYLON.Color3(gray, gray, gray + 0.05);
      rockMat.roughness = 0.95;
      rock.material = rockMat;

      new BABYLON.PhysicsAggregate(rock, BABYLON.PhysicsShapeType.CONVEX_HULL, { mass: 0 }, this.scene);
      this.game.shadowGenerator.addShadowCaster(rock);
    }

    // 폭발 배럴
    const barrelCount = Math.floor(random(200) * 3);
    for (let i = 0; i < barrelCount; i++) {
      const x = offsetX + (random(i * 7 + 300) - 0.5) * this.chunkSize * 0.8;
      const z = offsetZ + (random(i * 7 + 301) - 0.5) * this.chunkSize * 0.8;
      const y = this.noise(x, z);

      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

      this.createExplosiveBarrel(new BABYLON.Vector3(x, y + 0.75, z));
    }

    // 엄폐물
    const coverCount = Math.floor(random(250) * 2);
    for (let i = 0; i < coverCount; i++) {
      const x = offsetX + (random(i * 11 + 400) - 0.5) * this.chunkSize * 0.7;
      const z = offsetZ + (random(i * 11 + 401) - 0.5) * this.chunkSize * 0.7;
      const y = this.noise(x, z);

      if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;

      this.createCoverWall(new BABYLON.Vector3(x, y, z), random(i * 11 + 402) * Math.PI);
    }

    // 점프대
    if (random(350) > 0.7) {
      const x = offsetX + (random(351) - 0.5) * this.chunkSize * 0.6;
      const z = offsetZ + (random(352) - 0.5) * this.chunkSize * 0.6;
      const y = this.noise(x, z);

      if (Math.abs(x) > 8 || Math.abs(z) > 8) {
        this.createJumpPad(new BABYLON.Vector3(x, y + 0.1, z));
      }
    }

    // 터렛
    if (random(400) > 0.85) {
      const x = offsetX + (random(401) - 0.5) * this.chunkSize * 0.5;
      const z = offsetZ + (random(402) - 0.5) * this.chunkSize * 0.5;
      const y = this.noise(x, z);

      if (Math.abs(x) > 10 || Math.abs(z) > 10) {
        this.createTurret(new BABYLON.Vector3(x, y, z));
      }
    }

    // 체력 회복 아이템
    if (random(450) > 0.7) {
      const x = offsetX + (random(451) - 0.5) * this.chunkSize * 0.6;
      const z = offsetZ + (random(452) - 0.5) * this.chunkSize * 0.6;
      const y = this.noise(x, z) + 0.5;

      this.createHealthPickup(new BABYLON.Vector3(x, y, z));
    }

    // 탈것
    if (random(500) > 0.85) {
      const x = offsetX + (random(501) - 0.5) * this.chunkSize * 0.5;
      const z = offsetZ + (random(502) - 0.5) * this.chunkSize * 0.5;
      const y = this.noise(x, z);

      if (Math.abs(x) > 15 || Math.abs(z) > 15) {
        const vehicleType = random(503) < 0.5 ? 'car' : (random(504) < 0.7 ? 'tank' : 'helicopter');
        this.game.vehicleSystem.createVehicle(new BABYLON.Vector3(x, y, z), vehicleType);
      }
    }

    // 건물
    const buildingChance = random(600);
    if (buildingChance > 0.7) {
      const x = offsetX + (random(601) - 0.5) * this.chunkSize * 0.6;
      const z = offsetZ + (random(602) - 0.5) * this.chunkSize * 0.6;
      const y = this.noise(x, z);

      if (Math.abs(x) > 20 || Math.abs(z) > 20) {
        const buildingType = random(603) < 0.4 ? 'apartment' : (random(604) < 0.6 ? 'house' : 'tower');
        this.createBuildingWithModel(new BABYLON.Vector3(x, y, z), buildingType, random(605));
      }
    }
  }

  /**
   * 나무 생성 - 3D 모델 또는 프리미티브 폴백
   */
  async createTree(position, seedValue, index) {
    // 사용 가능한 모델 선택 (tree_pine이 없으면 tree 사용)
    let modelKey = 'tree';
    if (seedValue > 0.5 && this.modelManager.isModelLoaded('tree_pine')) {
      modelKey = 'tree_pine';
    }

    // 모델 사용이 활성화되어 있고, 모델이 로드되었으면 3D 모델 사용
    if (this.modelManager.useModels.trees && this.modelManager.isModelLoaded(modelKey)) {
      const treeScale = 0.5 + seedValue * 1.0; // 스케일 조정

      // 팩에서 랜덤하게 하나의 나무만 선택하고, 지형 높이에 맞게 배치
      const treeRoot = await this.modelManager.createModelInstance(
        modelKey,
        position,
        Math.random() * Math.PI * 2,
        treeScale,
        { pickRandom: true, meshIndex: index } // 팩에서 하나만 선택
      );

      if (treeRoot) {
        // 물리 충돌용 간단한 실린더 추가
        const collider = BABYLON.MeshBuilder.CreateCylinder(`treeCollider_${index}`, {
          height: 4 * treeScale,
          diameter: 0.6 * treeScale
        }, this.scene);
        collider.position = position.clone();
        collider.position.y += 2 * treeScale;
        collider.isVisible = false;
        new BABYLON.PhysicsAggregate(collider, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);

        this.trees.push({ root: treeRoot, collider });
        return;
      }
    }

    // 폴백: 프리미티브로 나무 생성
    this.createTreePrimitive(position, seedValue, index);
  }

  /**
   * 프리미티브로 나무 생성 (폴백)
   */
  createTreePrimitive(position, seedValue, index) {
    const treeHeight = 4 + seedValue * 4;
    const trunk = BABYLON.MeshBuilder.CreateCylinder(`trunk_${position.x}_${position.z}`, {
      height: treeHeight,
      diameter: 0.4 + seedValue * 0.4,
    }, this.scene);
    trunk.position = position.clone();
    trunk.position.y += treeHeight / 2;

    const trunkMat = new BABYLON.PBRMaterial(`trunkMat_${position.x}_${position.z}`, this.scene);
    trunkMat.albedoColor = new BABYLON.Color3(0.25, 0.15, 0.05);
    trunkMat.roughness = 0.98;
    trunk.material = trunkMat;

    new BABYLON.PhysicsAggregate(trunk, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
    this.game.shadowGenerator.addShadowCaster(trunk);

    const leafCount = 2 + Math.floor(seedValue * 3);
    for (let j = 0; j < leafCount; j++) {
      const leafSize = 2 + (seedValue + j * 0.1) * 2;
      const leaves = BABYLON.MeshBuilder.CreateSphere(`leaves_${position.x}_${position.z}_${j}`, {
        diameter: leafSize,
      }, this.scene);
      leaves.position = new BABYLON.Vector3(
        position.x + (Math.random() - 0.5) * 2,
        position.y + treeHeight + Math.random() * 2,
        position.z + (Math.random() - 0.5) * 2
      );

      const leavesMat = new BABYLON.PBRMaterial(`leavesMat_${position.x}_${position.z}_${j}`, this.scene);
      leavesMat.albedoColor = new BABYLON.Color3(0.1, 0.35 + seedValue * 0.15, 0.08);
      leavesMat.roughness = 0.9;
      leaves.material = leavesMat;
      this.game.shadowGenerator.addShadowCaster(leaves);
    }

    this.trees.push({ trunk, type: 'primitive' });
  }

  /**
   * 건물 생성 - 3D 모델 또는 프리미티브 폴백
   */
  async createBuildingWithModel(position, type, seed) {
    const modelKey = `building_${type}`;

    // 모델 사용이 활성화되어 있고, 모델이 로드되었으면 3D 모델 사용
    if (this.modelManager.useModels.buildings && this.modelManager.isModelLoaded(modelKey)) {
      const buildingScale = type === 'tower' ? 1.5 + seed : (type === 'apartment' ? 1 + seed * 0.5 : 1);
      const buildingRoot = await this.modelManager.createModelInstance(
        modelKey,
        position,
        Math.random() * Math.PI * 2,
        buildingScale
      );

      if (buildingRoot) {
        // 물리 충돌용 박스 추가
        let colliderSize;
        switch (type) {
          case 'apartment':
            colliderSize = { width: 12 + seed * 8, height: (5 + Math.floor(seed * 10)) * 3, depth: 10 + seed * 5 };
            break;
          case 'house':
            colliderSize = { width: 8, height: 6, depth: 10 };
            break;
          case 'tower':
            colliderSize = { width: 8, height: 20 + seed * 30, depth: 8 };
            break;
          default:
            colliderSize = { width: 10, height: 10, depth: 10 };
        }

        const collider = BABYLON.MeshBuilder.CreateBox(`buildingCollider_${Date.now()}`, colliderSize, this.scene);
        collider.position = position.clone();
        collider.position.y += colliderSize.height / 2;
        collider.isVisible = false;
        new BABYLON.PhysicsAggregate(collider, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, this.scene);

        this.buildings.push({ root: buildingRoot, collider, type });
        return;
      }
    }

    // 폴백: 기존 프리미티브 건물 생성
    this.createBuilding(position, type, seed);
  }

  createExplosiveBarrel(position) {
    const barrel = BABYLON.MeshBuilder.CreateCylinder('barrel', {
      height: 1.5,
      diameter: 0.8
    }, this.scene);
    barrel.position = position;

    const barrelMat = new BABYLON.PBRMaterial('barrelMat' + Date.now(), this.scene);
    barrelMat.albedoColor = new BABYLON.Color3(0.8, 0.2, 0.1);
    barrelMat.metallic = 0.7;
    barrelMat.roughness = 0.4;
    barrel.material = barrelMat;

    const warning = BABYLON.MeshBuilder.CreatePlane('warning', { size: 0.4 }, this.scene);
    warning.position.y = 0.3;
    warning.position.z = 0.41;
    warning.parent = barrel;
    const warnMat = new BABYLON.StandardMaterial('warnMat', this.scene);
    warnMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0);
    warnMat.disableLighting = true;
    warning.material = warnMat;

    new BABYLON.PhysicsAggregate(barrel, BABYLON.PhysicsShapeType.CYLINDER, { mass: 50, restitution: 0.1 }, this.scene);
    this.game.shadowGenerator.addShadowCaster(barrel);

    this.explosiveBarrels.push({
      mesh: barrel,
      health: 30,
      exploded: false
    });
  }

  createCoverWall(position, rotation) {
    const wall = BABYLON.MeshBuilder.CreateBox('cover', {
      width: 3,
      height: 1.5,
      depth: 0.6
    }, this.scene);
    wall.position = position.clone();
    wall.position.y += 0.75;
    wall.rotation.y = rotation;

    const wallMat = new BABYLON.PBRMaterial('wallMat' + Date.now(), this.scene);
    wallMat.albedoColor = new BABYLON.Color3(0.5, 0.45, 0.35);
    wallMat.roughness = 0.95;
    wall.material = wallMat;

    new BABYLON.PhysicsAggregate(wall, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    this.game.shadowGenerator.addShadowCaster(wall);

    this.coverObjects.push(wall);
  }

  createJumpPad(position) {
    const pad = BABYLON.MeshBuilder.CreateCylinder('jumpPad', {
      height: 0.2,
      diameter: 2
    }, this.scene);
    pad.position = position;

    const padMat = new BABYLON.StandardMaterial('padMat' + Date.now(), this.scene);
    padMat.emissiveColor = new BABYLON.Color3(0, 0.8, 1);
    padMat.alpha = 0.8;
    pad.material = padMat;

    const glow = BABYLON.MeshBuilder.CreateTorus('padGlow', {
      diameter: 2,
      thickness: 0.1
    }, this.scene);
    glow.position = position.clone();
    glow.position.y += 0.15;
    const glowMat = new BABYLON.StandardMaterial('glowMat', this.scene);
    glowMat.emissiveColor = new BABYLON.Color3(0, 1, 1);
    glowMat.alpha = 0.6;
    glow.material = glowMat;

    this.scene.onBeforeRenderObservable.add(() => {
      if (pad && !pad.isDisposed()) {
        glow.rotation.y += 0.05;
        padMat.emissiveColor = new BABYLON.Color3(
          0,
          0.5 + Math.sin(Date.now() * 0.005) * 0.3,
          0.8 + Math.sin(Date.now() * 0.005) * 0.2
        );
      }
    });

    this.jumpPads.push({
      mesh: pad,
      position: position.clone(),
      power: 25
    });
  }

  createTurret(position) {
    const base = BABYLON.MeshBuilder.CreateCylinder('turretBase', {
      height: 0.5,
      diameter: 1.5
    }, this.scene);
    base.position = position.clone();
    base.position.y += 0.25;

    const baseMat = new BABYLON.PBRMaterial('baseMat' + Date.now(), this.scene);
    baseMat.albedoColor = new BABYLON.Color3(0.3, 0.3, 0.35);
    baseMat.metallic = 0.8;
    baseMat.roughness = 0.3;
    base.material = baseMat;

    const barrel = BABYLON.MeshBuilder.CreateCylinder('turretBarrel', {
      height: 1.5,
      diameter: 0.3
    }, this.scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position = position.clone();
    barrel.position.y += 0.8;
    barrel.position.z += 0.5;
    barrel.material = baseMat;

    new BABYLON.PhysicsAggregate(base, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
    this.game.shadowGenerator.addShadowCaster(base);
    this.game.shadowGenerator.addShadowCaster(barrel);

    this.turrets.push({
      base,
      barrel,
      position: position.clone(),
      canUse: true,
      cooldown: 0
    });
  }

  createHealthPickup(position) {
    const box = BABYLON.MeshBuilder.CreateBox('healthBox', {
      size: 0.5
    }, this.scene);
    box.position = position;

    const boxMat = new BABYLON.StandardMaterial('healthMat' + Date.now(), this.scene);
    boxMat.emissiveColor = new BABYLON.Color3(0.2, 1, 0.2);
    boxMat.alpha = 0.8;
    box.material = boxMat;

    const cross1 = BABYLON.MeshBuilder.CreateBox('cross1', {
      width: 0.3, height: 0.08, depth: 0.52
    }, this.scene);
    cross1.parent = box;
    const cross2 = BABYLON.MeshBuilder.CreateBox('cross2', {
      width: 0.08, height: 0.3, depth: 0.52
    }, this.scene);
    cross2.parent = box;

    const crossMat = new BABYLON.StandardMaterial('crossMat', this.scene);
    crossMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    cross1.material = crossMat;
    cross2.material = crossMat;

    this.scene.onBeforeRenderObservable.add(() => {
      if (box && !box.isDisposed()) {
        box.rotation.y += 0.02;
        box.position.y = position.y + Math.sin(Date.now() * 0.003) * 0.2;
      }
    });

    this.healthPickups.push({
      mesh: box,
      position: position.clone(),
      healAmount: 30
    });
  }

  createBuilding(position, type, seed) {
    const buildingParent = new BABYLON.TransformNode(`building_${type}_${Date.now()}`, this.scene);
    buildingParent.position = position.clone();

    const concreteMat = new BABYLON.PBRMaterial('concreteMat' + Date.now(), this.scene);
    concreteMat.roughness = 0.95;
    concreteMat.metallic = 0;

    const windowMat = new BABYLON.StandardMaterial('windowMat' + Date.now(), this.scene);
    windowMat.emissiveColor = new BABYLON.Color3(0.8, 0.9, 1);
    windowMat.alpha = 0.7;

    switch (type) {
      case 'apartment':
        const floors = 5 + Math.floor(seed * 10);
        const width = 12 + seed * 8;
        const depth = 10 + seed * 5;
        concreteMat.albedoColor = new BABYLON.Color3(0.7, 0.7, 0.75);

        const apartmentBody = BABYLON.MeshBuilder.CreateBox('apartmentBody', {
          width: width, height: floors * 3, depth: depth
        }, this.scene);
        apartmentBody.position.y = floors * 1.5;
        apartmentBody.parent = buildingParent;
        apartmentBody.material = concreteMat;

        for (let f = 0; f < floors; f++) {
          for (let w = 0; w < Math.floor(width / 3); w++) {
            const window = BABYLON.MeshBuilder.CreateBox('window', {
              width: 1.5, height: 2, depth: 0.1
            }, this.scene);
            window.position = new BABYLON.Vector3(
              -width / 2 + 2 + w * 3,
              f * 3 + 2,
              depth / 2 + 0.05
            );
            window.parent = buildingParent;
            window.material = windowMat;
          }
        }

        const rooftop = BABYLON.MeshBuilder.CreateBox('rooftop', {
          width: 3, height: 2, depth: 3
        }, this.scene);
        rooftop.position.y = floors * 3 + 1;
        rooftop.parent = buildingParent;
        rooftop.material = concreteMat;

        new BABYLON.PhysicsAggregate(apartmentBody, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, this.scene);
        this.game.shadowGenerator.addShadowCaster(apartmentBody);
        break;

      case 'house':
        concreteMat.albedoColor = new BABYLON.Color3(0.85, 0.8, 0.7);

        const houseBody = BABYLON.MeshBuilder.CreateBox('houseBody', {
          width: 8, height: 4, depth: 10
        }, this.scene);
        houseBody.position.y = 2;
        houseBody.parent = buildingParent;
        houseBody.material = concreteMat;

        const roofMat = new BABYLON.PBRMaterial('roofMat', this.scene);
        roofMat.albedoColor = new BABYLON.Color3(0.5, 0.25, 0.15);
        roofMat.roughness = 0.9;

        const roof = BABYLON.MeshBuilder.CreateCylinder('roof', {
          height: 10, diameter: 12, tessellation: 4
        }, this.scene);
        roof.rotation.x = Math.PI / 2;
        roof.rotation.y = Math.PI / 4;
        roof.scaling = new BABYLON.Vector3(0.8, 1, 0.4);
        roof.position.y = 5.5;
        roof.parent = buildingParent;
        roof.material = roofMat;

        const doorMat = new BABYLON.PBRMaterial('doorMat', this.scene);
        doorMat.albedoColor = new BABYLON.Color3(0.4, 0.25, 0.15);
        const door = BABYLON.MeshBuilder.CreateBox('door', {
          width: 1.2, height: 2.5, depth: 0.15
        }, this.scene);
        door.position = new BABYLON.Vector3(0, 1.25, 5.05);
        door.parent = buildingParent;
        door.material = doorMat;

        [[-2.5, 2.5], [2.5, 2.5]].forEach(([x, y]) => {
          const houseWindow = BABYLON.MeshBuilder.CreateBox('houseWindow', {
            width: 1.5, height: 1.5, depth: 0.1
          }, this.scene);
          houseWindow.position = new BABYLON.Vector3(x, y, 5.05);
          houseWindow.parent = buildingParent;
          houseWindow.material = windowMat;
        });

        new BABYLON.PhysicsAggregate(houseBody, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, this.scene);
        this.game.shadowGenerator.addShadowCaster(houseBody);
        this.game.shadowGenerator.addShadowCaster(roof);
        break;

      case 'tower':
        const towerHeight = 20 + seed * 30;
        concreteMat.albedoColor = new BABYLON.Color3(0.4, 0.45, 0.5);

        const towerBody = BABYLON.MeshBuilder.CreateCylinder('towerBody', {
          height: towerHeight, diameter: 8, tessellation: 8
        }, this.scene);
        towerBody.position.y = towerHeight / 2;
        towerBody.parent = buildingParent;
        towerBody.material = concreteMat;

        const topStructure = BABYLON.MeshBuilder.CreateCylinder('topStructure', {
          height: 3, diameter: 5
        }, this.scene);
        topStructure.position.y = towerHeight + 1.5;
        topStructure.parent = buildingParent;
        topStructure.material = concreteMat;

        const antenna = BABYLON.MeshBuilder.CreateCylinder('antenna', {
          height: 5, diameter: 0.3
        }, this.scene);
        antenna.position.y = towerHeight + 5.5;
        antenna.parent = buildingParent;
        const antennaMat = new BABYLON.StandardMaterial('antennaMat', this.scene);
        antennaMat.emissiveColor = new BABYLON.Color3(1, 0, 0);
        antenna.material = antennaMat;

        const warningLight = BABYLON.MeshBuilder.CreateSphere('warningLight', {
          diameter: 0.5
        }, this.scene);
        warningLight.position.y = towerHeight + 8;
        warningLight.parent = buildingParent;
        warningLight.material = antennaMat;

        this.scene.onBeforeRenderObservable.add(() => {
          if (warningLight && !warningLight.isDisposed()) {
            antennaMat.emissiveColor = new BABYLON.Color3(
              Math.sin(Date.now() * 0.005) > 0 ? 1 : 0.2, 0, 0
            );
          }
        });

        new BABYLON.PhysicsAggregate(towerBody, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
        this.game.shadowGenerator.addShadowCaster(towerBody);
        break;
    }

    this.buildings.push({ parent: buildingParent, type });
  }

  createChunkAmmo(offsetX, offsetZ, chunkX, chunkZ) {
    const seed = chunkX * 10000 + chunkZ;
    const random = (i) => {
      const x = Math.sin(seed + i * 127.1) * 43758.5453;
      return x - Math.floor(x);
    };

    const ammoCount = 1 + Math.floor(random(0) * 2);
    for (let i = 0; i < ammoCount; i++) {
      const x = offsetX + (random(i * 2 + 200) - 0.5) * this.chunkSize * 0.8;
      const z = offsetZ + (random(i * 2 + 201) - 0.5) * this.chunkSize * 0.8;
      const y = this.noise(x, z) + 0.5;

      this.createAmmoBox(new BABYLON.Vector3(x, y, z), `${chunkX}_${chunkZ}_${i}`);
    }
  }

  createAmmoBox(position, id) {
    const ammoBox = BABYLON.MeshBuilder.CreateBox(`ammoBox_${id}`, {
      width: 0.4,
      height: 0.25,
      depth: 0.3
    }, this.scene);
    ammoBox.position = position.clone();

    const ammoMat = new BABYLON.PBRMaterial(`ammoMat_${id}`, this.scene);
    ammoMat.albedoColor = new BABYLON.Color3(0.15, 0.3, 0.15);
    ammoMat.metallic = 0.3;
    ammoMat.roughness = 0.6;
    ammoBox.material = ammoMat;

    const bulletDecor = BABYLON.MeshBuilder.CreateCylinder(`bulletDecor_${id}`, {
      height: 0.15,
      diameter: 0.06
    }, this.scene);
    bulletDecor.position = position.clone();
    bulletDecor.position.y += 0.2;
    bulletDecor.rotation.z = Math.PI / 2;

    const bulletMat = new BABYLON.PBRMaterial(`bulletMat_${id}`, this.scene);
    bulletMat.albedoColor = new BABYLON.Color3(0.85, 0.65, 0.2);
    bulletMat.metallic = 0.9;
    bulletMat.roughness = 0.2;
    bulletDecor.material = bulletMat;

    const glowLayer = this.scene.getGlowLayerByName('glow') || new BABYLON.GlowLayer('glow', this.scene);
    glowLayer.addIncludedOnlyMesh(bulletDecor);

    this.scene.onBeforeRenderObservable.add(() => {
      if (ammoBox && !ammoBox.isDisposed()) {
        ammoBox.rotation.y += 0.02;
        bulletDecor.rotation.y += 0.02;
      }
    });

    this.ammoPickups.push({
      box: ammoBox,
      decor: bulletDecor,
      position: position.clone(),
      ammoAmount: 60 + Math.floor(Math.random() * 60)
    });
  }

  checkAmmoPickups(playerPos) {
    for (let i = this.ammoPickups.length - 1; i >= 0; i--) {
      const pickup = this.ammoPickups[i];
      if (!pickup.box || pickup.box.isDisposed()) continue;

      const distance = BABYLON.Vector3.Distance(playerPos, pickup.box.position);

      if (distance < 2) {
        this.game.weaponSystem.currentWeapon.reserveAmmo += pickup.ammoAmount;
        pickup.box.dispose();
        pickup.decor.dispose();
        this.ammoPickups.splice(i, 1);
        console.log(`탄약 획득! +${pickup.ammoAmount}`);
      }
    }
  }

  checkHealthPickups(playerPos) {
    for (let i = this.healthPickups.length - 1; i >= 0; i--) {
      const pickup = this.healthPickups[i];
      if (!pickup.mesh || pickup.mesh.isDisposed()) {
        this.healthPickups.splice(i, 1);
        continue;
      }

      const distance = BABYLON.Vector3.Distance(playerPos, pickup.mesh.position);

      if (distance < 2 && this.game.playerStats.health < 100) {
        this.game.playerStats.health = Math.min(100, this.game.playerStats.health + pickup.healAmount);
        pickup.mesh.dispose();
        this.healthPickups.splice(i, 1);
        console.log(`체력 회복! +${pickup.healAmount}`);
        this.game.effectManager.showHealEffect();
      }
    }
  }

  checkJumpPads(playerPos) {
    this.jumpPads.forEach(pad => {
      if (!pad.mesh || pad.mesh.isDisposed()) return;

      const distance = BABYLON.Vector3.Distance(playerPos, pad.position);

      if (distance < 1.5 && this.game.playerAggregate) {
        const velocity = this.game.playerAggregate.body.getLinearVelocity();
        if (velocity.y < 5) {
          this.game.playerAggregate.body.setLinearVelocity(new BABYLON.Vector3(
            velocity.x,
            pad.power,
            velocity.z
          ));
          this.game.effectManager.createJumpPadEffect(pad.position);
        }
      }
    });
  }

  checkExplosiveBarrels() {
    const activeBullets = this.game.weaponSystem.activeBullets;
    if (!activeBullets) return;

    activeBullets.forEach(bullet => {
      if (!bullet.active) return;

      this.explosiveBarrels.forEach(barrel => {
        if (barrel.exploded || !barrel.mesh || barrel.mesh.isDisposed()) return;

        const dist = BABYLON.Vector3.Distance(bullet.mesh.position, barrel.mesh.position);
        if (dist < 1.5) {
          barrel.health -= 10;

          if (barrel.health <= 0 && !barrel.exploded) {
            barrel.exploded = true;
            const pos = barrel.mesh.position.clone();
            barrel.mesh.dispose();
            this.game.effectManager.createExplosion(
              pos,
              10,
              60,
              this.game.enemies,
              this.game.playerStats,
              this.game.collisionCapsule,
              () => this.game.uiManager.gameOver()
            );
          }
        }
      });
    });
  }
}
