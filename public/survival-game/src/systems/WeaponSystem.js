// WeaponSystem - 무기 관련 모든 기능 관리

export class WeaponSystem {
  constructor(game) {
    this.game = game;

    // 무기 데이터
    this.weapons = [
      {
        name: '권총',
        type: 'pistol',
        magazineAmmo: 12,
        maxMagazine: 12,
        reserveAmmo: 48,
        damage: 25,
        fireRate: 0.2,
        autoFire: false,
        recoil: 0.04,
        spread: 0.02
      },
      {
        name: '돌격소총',
        type: 'rifle',
        magazineAmmo: 30,
        maxMagazine: 30,
        reserveAmmo: 120,
        damage: 20,
        fireRate: 0.08,
        autoFire: true,
        recoil: 0.03,
        spread: 0.04
      },
      {
        name: '샷건',
        type: 'shotgun',
        magazineAmmo: 8,
        maxMagazine: 8,
        reserveAmmo: 32,
        damage: 15,
        fireRate: 0.8,
        autoFire: false,
        recoil: 0.12,
        spread: 0.15,
        pellets: 8
      },
      {
        name: 'SMG',
        type: 'smg',
        magazineAmmo: 25,
        maxMagazine: 25,
        reserveAmmo: 100,
        damage: 12,
        fireRate: 0.05,
        autoFire: true,
        recoil: 0.02,
        spread: 0.06
      },
      {
        name: '수류탄',
        type: 'grenade',
        magazineAmmo: 3,
        maxMagazine: 3,
        reserveAmmo: 6,
        damage: 80,
        fireRate: 1.0,
        autoFire: false,
        recoil: 0.01,
        spread: 0,
        explosive: true,
        blastRadius: 8
      },
      {
        name: '로켓런처',
        type: 'rocket',
        magazineAmmo: 1,
        maxMagazine: 1,
        reserveAmmo: 5,
        damage: 120,
        fireRate: 2.0,
        autoFire: false,
        recoil: 0.2,
        spread: 0,
        explosive: true,
        blastRadius: 12
      },
      {
        name: '레이저건',
        type: 'laser',
        magazineAmmo: 100,
        maxMagazine: 100,
        reserveAmmo: 200,
        damage: 5,
        fireRate: 0.02,
        autoFire: true,
        recoil: 0,
        spread: 0
      },
      {
        name: '저격소총',
        type: 'sniper',
        magazineAmmo: 5,
        maxMagazine: 5,
        reserveAmmo: 20,
        damage: 150,
        fireRate: 1.5,
        autoFire: false,
        recoil: 0.25,
        spread: 0,
        scopeZoom: 4.0
      }
    ];

    this.currentWeaponIndex = 1;
    this.currentWeapon = this.weapons[this.currentWeaponIndex];

    this.isAutoFire = false;
    this.isReloading = false;
    this.isShooting = false;
    this.shootCooldown = 0;
    this.recoilAmount = 0;

    // ADS 시스템
    this.isAiming = false;
    this.aimTransition = 0;
    this.normalFOV = 75;
    this.aimFOV = 40;
    this.normalGunPos = new BABYLON.Vector3(0.3, -0.28, 0.5);
    this.aimGunPos = new BABYLON.Vector3(0, -0.15, 0.4);

    // 수류탄
    this.grenades = 5;

    // 총알 추적
    this.activeBullets = [];

    // 총 모델
    this.gunParent = null;
    this.gunSlide = null;
    this.magazine = null;
    this.muzzleFlash = null;
    this.sniperScope = null;
    this.gunIdleTime = 0;
  }

  get scene() {
    return this.game.scene;
  }

  get camera() {
    return this.game.camera;
  }

  switchWeapon(index) {
    if (index === this.currentWeaponIndex || this.isReloading) return;
    if (index < 0 || index >= this.weapons.length) return;

    this.currentWeaponIndex = index;
    this.currentWeapon = this.weapons[index];
    this.isAutoFire = this.currentWeapon.autoFire;

    if (this.gunParent) {
      const startY = this.gunParent.position.y;
      let switchTime = 0;

      const switchAnimation = () => {
        switchTime += 0.016;

        if (switchTime < 0.15) {
          this.gunParent.position.y = startY - switchTime * 2;
        } else if (switchTime < 0.3) {
          if (switchTime > 0.15 && switchTime < 0.17) {
            this.updateGunModel();
          }
          this.gunParent.position.y = startY - 0.3 + (switchTime - 0.15) * 2;
        } else {
          this.gunParent.position.y = startY;
          return;
        }

        requestAnimationFrame(switchAnimation);
      };
      switchAnimation();
    }

    console.log(`무기 전환: ${this.currentWeapon.name}`);
  }

  updateGunModel() {
    if (!this.gunParent) return;

    const frame = this.gunParent.getChildMeshes().find(m => m.name === 'gunFrame');
    const slide = this.gunSlide;
    const barrel = this.gunParent.getChildMeshes().find(m => m.name === 'gunBarrel');

    switch (this.currentWeapon.type) {
      case 'pistol':
        if (frame) frame.scaling = new BABYLON.Vector3(1, 1, 1);
        if (slide) slide.scaling = new BABYLON.Vector3(1, 1, 1);
        if (barrel) barrel.scaling = new BABYLON.Vector3(1, 1, 0.8);
        this.gunParent.scaling = new BABYLON.Vector3(2.0, 2.0, 2.0);
        break;

      case 'rifle':
        if (frame) frame.scaling = new BABYLON.Vector3(1, 1, 1.5);
        if (slide) slide.scaling = new BABYLON.Vector3(1, 1, 1.5);
        if (barrel) barrel.scaling = new BABYLON.Vector3(1, 1, 2);
        this.gunParent.scaling = new BABYLON.Vector3(2.2, 2.2, 2.2);
        break;

      case 'shotgun':
        if (frame) frame.scaling = new BABYLON.Vector3(1.3, 1, 1.8);
        if (slide) slide.scaling = new BABYLON.Vector3(1.3, 1, 1.8);
        if (barrel) barrel.scaling = new BABYLON.Vector3(1.5, 1.5, 2.5);
        this.gunParent.scaling = new BABYLON.Vector3(2.5, 2.5, 2.5);
        break;

      case 'smg':
        if (frame) frame.scaling = new BABYLON.Vector3(0.9, 0.9, 1.2);
        if (slide) slide.scaling = new BABYLON.Vector3(0.9, 0.9, 1.2);
        if (barrel) barrel.scaling = new BABYLON.Vector3(0.8, 0.8, 1.5);
        this.gunParent.scaling = new BABYLON.Vector3(1.8, 1.8, 1.8);
        break;

      case 'sniper':
        if (frame) frame.scaling = new BABYLON.Vector3(1, 1, 2.5);
        if (slide) slide.scaling = new BABYLON.Vector3(1, 1, 2.5);
        if (barrel) barrel.scaling = new BABYLON.Vector3(0.8, 0.8, 4);
        this.gunParent.scaling = new BABYLON.Vector3(2.5, 2.5, 2.5);
        this.createSniperScope();
        break;
    }
  }

  createSniperScope() {
    if (this.sniperScope) {
      this.sniperScope.dispose();
    }

    this.sniperScope = BABYLON.MeshBuilder.CreateCylinder('scope', {
      height: 0.15,
      diameter: 0.04
    }, this.scene);
    this.sniperScope.rotation.x = Math.PI / 2;
    this.sniperScope.position = new BABYLON.Vector3(0, 0.08, 0);
    this.sniperScope.parent = this.gunParent;

    const scopeMat = new BABYLON.PBRMaterial('scopeMat', this.scene);
    scopeMat.albedoColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    scopeMat.metallic = 0.9;
    scopeMat.roughness = 0.2;
    this.sniperScope.material = scopeMat;
    this.sniperScope.renderingGroupId = 1;

    const lensFront = BABYLON.MeshBuilder.CreateCylinder('lensFront', {
      height: 0.01,
      diameter: 0.045
    }, this.scene);
    lensFront.rotation.x = Math.PI / 2;
    lensFront.position = new BABYLON.Vector3(0, 0.08, 0.08);
    lensFront.parent = this.gunParent;

    const lensMat = new BABYLON.StandardMaterial('lensMat', this.scene);
    lensMat.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.5);
    lensMat.alpha = 0.5;
    lensFront.material = lensMat;
    lensFront.renderingGroupId = 1;
  }

  createGun() {
    this.gunParent = new BABYLON.TransformNode('gunParent', this.scene);
    this.gunParent.parent = this.camera;
    this.gunParent.position = new BABYLON.Vector3(0.3, -0.28, 0.5);
    this.gunParent.scaling = new BABYLON.Vector3(2.2, 2.2, 2.2);

    const gunMetalMat = new BABYLON.PBRMaterial('gunMetalMat', this.scene);
    gunMetalMat.albedoColor = new BABYLON.Color3(0.1, 0.1, 0.12);
    gunMetalMat.metallic = 0.95;
    gunMetalMat.roughness = 0.2;

    const gunGripMat = new BABYLON.PBRMaterial('gunGripMat', this.scene);
    gunGripMat.albedoColor = new BABYLON.Color3(0.06, 0.04, 0.02);
    gunGripMat.roughness = 0.85;
    gunGripMat.metallic = 0.1;

    // 프레임
    const frame = BABYLON.MeshBuilder.CreateBox('gunFrame', {
      width: 0.035,
      height: 0.08,
      depth: 0.16
    }, this.scene);
    frame.position = new BABYLON.Vector3(0, 0, 0.02);
    frame.parent = this.gunParent;
    frame.material = gunMetalMat;

    // 슬라이드
    this.gunSlide = BABYLON.MeshBuilder.CreateBox('gunSlide', {
      width: 0.038,
      height: 0.045,
      depth: 0.18
    }, this.scene);
    this.gunSlide.position = new BABYLON.Vector3(0, 0.04, 0.03);
    this.gunSlide.parent = this.gunParent;
    this.gunSlide.material = gunMetalMat;

    // 슬라이드 홈
    const slideGroove = BABYLON.MeshBuilder.CreateBox('slideGroove', {
      width: 0.04,
      height: 0.01,
      depth: 0.12
    }, this.scene);
    slideGroove.position = new BABYLON.Vector3(0, 0.015, 0);
    slideGroove.parent = this.gunSlide;
    const grooveMat = new BABYLON.PBRMaterial('grooveMat', this.scene);
    grooveMat.albedoColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    grooveMat.metallic = 0.9;
    grooveMat.roughness = 0.3;
    slideGroove.material = grooveMat;

    // 총신
    const barrel = BABYLON.MeshBuilder.CreateCylinder('gunBarrel', {
      height: 0.1,
      diameter: 0.02
    }, this.scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position = new BABYLON.Vector3(0, 0.035, 0.17);
    barrel.parent = this.gunParent;
    const barrelMat = new BABYLON.PBRMaterial('barrelMat', this.scene);
    barrelMat.albedoColor = new BABYLON.Color3(0.03, 0.03, 0.03);
    barrelMat.metallic = 1.0;
    barrelMat.roughness = 0.1;
    barrel.material = barrelMat;

    // 총신 구멍
    const barrelHole = BABYLON.MeshBuilder.CreateCylinder('barrelHole', {
      height: 0.02,
      diameter: 0.014
    }, this.scene);
    barrelHole.rotation.x = Math.PI / 2;
    barrelHole.position = new BABYLON.Vector3(0, 0.035, 0.22);
    barrelHole.parent = this.gunParent;
    const holeMat = new BABYLON.StandardMaterial('holeMat', this.scene);
    holeMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    holeMat.specularColor = new BABYLON.Color3(0, 0, 0);
    barrelHole.material = holeMat;

    // 조준기
    const frontSight = BABYLON.MeshBuilder.CreateBox('frontSight', {
      width: 0.008,
      height: 0.015,
      depth: 0.008
    }, this.scene);
    frontSight.position = new BABYLON.Vector3(0, 0.075, 0.1);
    frontSight.parent = this.gunParent;
    const sightMat = new BABYLON.PBRMaterial('sightMat', this.scene);
    sightMat.albedoColor = new BABYLON.Color3(1, 1, 1);
    sightMat.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    frontSight.material = sightMat;

    const rearSightL = BABYLON.MeshBuilder.CreateBox('rearSightL', {
      width: 0.006,
      height: 0.012,
      depth: 0.008
    }, this.scene);
    rearSightL.position = new BABYLON.Vector3(-0.012, 0.072, -0.05);
    rearSightL.parent = this.gunParent;
    rearSightL.material = gunMetalMat;

    const rearSightR = BABYLON.MeshBuilder.CreateBox('rearSightR', {
      width: 0.006,
      height: 0.012,
      depth: 0.008
    }, this.scene);
    rearSightR.position = new BABYLON.Vector3(0.012, 0.072, -0.05);
    rearSightR.parent = this.gunParent;
    rearSightR.material = gunMetalMat;

    // 그립
    const grip = BABYLON.MeshBuilder.CreateBox('gunGrip', {
      width: 0.032,
      height: 0.1,
      depth: 0.038
    }, this.scene);
    grip.position = new BABYLON.Vector3(0, -0.06, -0.02);
    grip.rotation.x = 0.2;
    grip.parent = this.gunParent;
    grip.material = gunGripMat;

    // 그립 텍스처
    for (let i = 0; i < 6; i++) {
      const gripLine = BABYLON.MeshBuilder.CreateBox(`gripLine${i}`, {
        width: 0.034,
        height: 0.002,
        depth: 0.04
      }, this.scene);
      gripLine.position = new BABYLON.Vector3(0, -0.025 - i * 0.013, -0.02);
      gripLine.rotation.x = 0.2;
      gripLine.parent = this.gunParent;
      gripLine.material = gunMetalMat;
    }

    // 방아쇠
    const trigger = BABYLON.MeshBuilder.CreateBox('trigger', {
      width: 0.005,
      height: 0.025,
      depth: 0.01
    }, this.scene);
    trigger.position = new BABYLON.Vector3(0, -0.012, 0.01);
    trigger.rotation.x = 0.4;
    trigger.parent = this.gunParent;
    trigger.material = gunMetalMat;

    // 방아쇠 가드
    const triggerGuard = BABYLON.MeshBuilder.CreateTorus('triggerGuard', {
      diameter: 0.04,
      thickness: 0.004,
      tessellation: 16
    }, this.scene);
    triggerGuard.rotation.x = Math.PI / 2;
    triggerGuard.rotation.z = Math.PI;
    triggerGuard.position = new BABYLON.Vector3(0, -0.022, 0.015);
    triggerGuard.scaling = new BABYLON.Vector3(1, 0.6, 1);
    triggerGuard.parent = this.gunParent;
    triggerGuard.material = gunMetalMat;

    // 탄창
    this.magazine = BABYLON.MeshBuilder.CreateBox('magazine', {
      width: 0.025,
      height: 0.065,
      depth: 0.032
    }, this.scene);
    this.magazine.position = new BABYLON.Vector3(0, -0.09, -0.01);
    this.magazine.parent = this.gunParent;
    this.magazine.material = gunMetalMat;

    // 손
    const skinMat = new BABYLON.PBRMaterial('skinMat', this.scene);
    skinMat.albedoColor = new BABYLON.Color3(0.85, 0.68, 0.55);
    skinMat.roughness = 0.75;
    skinMat.metallic = 0;

    const palm = BABYLON.MeshBuilder.CreateBox('palm', {
      width: 0.065,
      height: 0.028,
      depth: 0.075
    }, this.scene);
    palm.position = new BABYLON.Vector3(0, -0.08, -0.01);
    palm.parent = this.gunParent;
    palm.material = skinMat;

    for (let i = 0; i < 4; i++) {
      const finger = BABYLON.MeshBuilder.CreateCylinder(`finger${i}`, {
        height: 0.055,
        diameter: 0.013
      }, this.scene);
      finger.rotation.x = Math.PI / 2 + 0.35;
      finger.position = new BABYLON.Vector3(-0.02 + i * 0.013, -0.068, 0.025);
      finger.parent = this.gunParent;
      finger.material = skinMat;
    }

    const thumb = BABYLON.MeshBuilder.CreateCylinder('thumb', {
      height: 0.04,
      diameter: 0.015
    }, this.scene);
    thumb.rotation.z = Math.PI / 3;
    thumb.position = new BABYLON.Vector3(0.04, -0.055, -0.01);
    thumb.parent = this.gunParent;
    thumb.material = skinMat;

    // 모든 총 파츠를 렌더링 그룹 1로 설정
    this.gunParent.getChildMeshes().forEach(mesh => {
      mesh.renderingGroupId = 1;
    });

    // 머즐 플래시
    this.muzzleFlash = BABYLON.MeshBuilder.CreatePlane('muzzleFlash', { size: 0.03 }, this.scene);
    this.muzzleFlash.position = new BABYLON.Vector3(0, 0.035, 0.23);
    this.muzzleFlash.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    this.muzzleFlash.parent = this.gunParent;

    const flashMat = new BABYLON.StandardMaterial('flashMat', this.scene);
    flashMat.emissiveColor = new BABYLON.Color3(1, 0.9, 0.5);
    flashMat.disableLighting = true;
    flashMat.alpha = 0;
    flashMat.backFaceCulling = false;
    this.muzzleFlash.material = flashMat;
    this.muzzleFlash.renderingGroupId = 1;

    // 발사 이벤트
    this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
        if (pointerInfo.event.button === 0 && !this.isAutoFire) {
          this.shoot();
        }
      }
    });
  }

  reload() {
    if (this.isReloading || this.currentWeapon.reserveAmmo <= 0) return;

    this.isReloading = true;
    this.game.audioManager.playReloadSound();

    const startPos = this.gunParent.position.clone();
    const startRot = this.gunParent.rotation.clone();
    let reloadTime = 0;

    const reloadAnimation = () => {
      reloadTime += 0.016;

      if (reloadTime < 0.3) {
        this.gunParent.position.y = startPos.y - reloadTime * 0.5;
        this.gunParent.rotation.x = startRot.x + reloadTime * 2;
      } else if (reloadTime < 0.8) {
        if (this.magazine) {
          this.magazine.position.y = -0.09 - (reloadTime - 0.3) * 0.3;
        }
      } else if (reloadTime < 1.0) {
        if (this.magazine) {
          this.magazine.position.y = -0.09 - 0.15 + (reloadTime - 0.8) * 0.75;
        }
      } else if (reloadTime < 1.3) {
        if (this.gunSlide) {
          this.gunSlide.position.z = 0.03 - (reloadTime - 1.0) * 0.2;
        }
      } else if (reloadTime < 1.5) {
        this.gunParent.position.y = startPos.y - 0.15 + (reloadTime - 1.3) * 0.75;
        this.gunParent.rotation.x = startRot.x + 0.6 - (reloadTime - 1.3) * 3;
        if (this.gunSlide) {
          this.gunSlide.position.z = -0.03 + (reloadTime - 1.3) * 0.3;
        }
        if (this.magazine) {
          this.magazine.position.y = -0.09;
        }
      } else {
        this.gunParent.position = startPos;
        this.gunParent.rotation = startRot;
        if (this.gunSlide) this.gunSlide.position.z = 0.03;
        if (this.magazine) this.magazine.position.y = -0.09;

        const needed = this.currentWeapon.maxMagazine - this.currentWeapon.magazineAmmo;
        const toLoad = Math.min(needed, this.currentWeapon.reserveAmmo);
        this.currentWeapon.magazineAmmo += toLoad;
        this.currentWeapon.reserveAmmo -= toLoad;
        this.isReloading = false;
        return;
      }

      requestAnimationFrame(reloadAnimation);
    };

    reloadAnimation();
  }

  shoot() {
    if (this.shootCooldown > 0 || this.currentWeapon.magazineAmmo <= 0 || this.isReloading) return;

    if (this.currentWeapon.type === 'grenade') {
      this.fireGrenade();
      return;
    }

    if (this.currentWeapon.type === 'rocket') {
      this.fireRocket();
      return;
    }

    if (this.currentWeapon.type === 'laser') {
      this.fireLaser();
      return;
    }

    this.currentWeapon.magazineAmmo--;
    this.shootCooldown = this.currentWeapon.fireRate;

    this.game.audioManager.playGunSound();

    // 머즐 플래시
    this.muzzleFlash.material.alpha = 0.9;
    const flashScale = 0.8 + Math.random() * 0.4;
    this.muzzleFlash.scaling = new BABYLON.Vector3(flashScale, flashScale, 1);

    setTimeout(() => {
      this.muzzleFlash.material.alpha = 0;
      this.muzzleFlash.scaling = new BABYLON.Vector3(1, 1, 1);
    }, 30);

    this.recoilAmount = this.currentWeapon.recoil;
    this.game.effectManager.createShootShake();
    this.game.effectManager.createMuzzleSparks();

    const pelletCount = this.currentWeapon.pellets || 1;

    for (let p = 0; p < pelletCount; p++) {
      this.createBulletTracer();
    }

    this.ejectShell();

    if (this.currentWeapon.magazineAmmo <= 0 && this.currentWeapon.reserveAmmo > 0) {
      setTimeout(() => this.reload(), 300);
    }
  }

  createBulletTracer() {
    const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
    const spread = this.currentWeapon.spread * 0.5;
    forward.x += (Math.random() - 0.5) * spread;
    forward.y += (Math.random() - 0.5) * spread;
    forward.z += (Math.random() - 0.5) * spread;
    forward.normalize();

    const startPos = this.camera.position.add(forward.scale(1.5));
    startPos.y -= 0.05;

    this.createMatrixBullet(startPos, forward, 'player');
  }

  createMatrixBullet(startPos, direction, owner, color = null) {
    const bulletColor = color || (owner === 'player'
      ? new BABYLON.Color3(1, 0.9, 0.3)
      : new BABYLON.Color3(1, 0.2, 0.1));

    const bullet = BABYLON.MeshBuilder.CreateSphere('matrixBullet', {
      diameter: 0.15,
      segments: 16
    }, this.scene);

    const bulletMat = new BABYLON.StandardMaterial('bulletMat' + Date.now(), this.scene);
    bulletMat.emissiveColor = bulletColor;
    bulletMat.disableLighting = true;
    bullet.material = bulletMat;

    const core = BABYLON.MeshBuilder.CreateSphere('bulletCore', {
      diameter: 0.08,
      segments: 8
    }, this.scene);
    const coreMat = new BABYLON.StandardMaterial('coreMat', this.scene);
    coreMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    coreMat.disableLighting = true;
    core.material = coreMat;
    core.parent = bullet;

    const glowRing = BABYLON.MeshBuilder.CreateTorus('glowRing', {
      diameter: 0.25,
      thickness: 0.03,
      tessellation: 24
    }, this.scene);
    const glowMat = new BABYLON.StandardMaterial('glowMat', this.scene);
    glowMat.emissiveColor = bulletColor;
    glowMat.alpha = 0.5;
    glowMat.disableLighting = true;
    glowRing.material = glowMat;
    glowRing.parent = bullet;

    const tailParts = [];
    for (let i = 0; i < 8; i++) {
      const tail = BABYLON.MeshBuilder.CreateSphere('tail' + i, {
        diameter: 0.1 - i * 0.01,
        segments: 8
      }, this.scene);
      const tailMat = new BABYLON.StandardMaterial('tailMat' + i, this.scene);
      tailMat.emissiveColor = bulletColor;
      tailMat.alpha = 0.6 - i * 0.07;
      tailMat.disableLighting = true;
      tail.material = tailMat;
      tailParts.push({ mesh: tail, mat: tailMat, offset: i * 0.3 });
    }

    bullet.position = startPos.clone();

    const speed = 15 + Math.random() * 5;
    let distance = 0;
    const maxDistance = 80;
    let prevPositions = [startPos.clone()];

    const bulletData = {
      mesh: bullet,
      tailParts,
      startPos: startPos.clone(),
      direction: direction.clone(),
      speed,
      distance: 0,
      owner,
      active: true
    };

    this.activeBullets.push(bulletData);

    const animateBullet = () => {
      if (!bulletData.active) return;

      distance += speed * 0.016;
      bulletData.distance = distance;
      const currentPos = startPos.add(direction.scale(distance));
      bullet.position = currentPos;

      glowRing.rotation.x += 0.2;
      glowRing.rotation.y += 0.15;

      prevPositions.unshift(currentPos.clone());
      if (prevPositions.length > 10) prevPositions.pop();

      tailParts.forEach((part, i) => {
        if (prevPositions[i + 1]) {
          part.mesh.position = prevPositions[i + 1];
        }
      });

      if (owner === 'enemy') {
        if (this.game.collisionCapsule) {
          const distToPlayer = BABYLON.Vector3.Distance(currentPos, this.game.collisionCapsule.position);
          if (distToPlayer < 0.8) {
            this.game.playerStats.health -= 8 + Math.floor(Math.random() * 7);
            this.game.effectManager.showDamageEffect();
            this.game.effectManager.createBulletImpact(currentPos, bulletColor);
            bulletData.active = false;

            if (this.game.playerStats.health <= 0) {
              this.game.uiManager.gameOver();
            }
          }
        }
      } else {
        this.game.enemies.forEach(enemy => {
          if (enemy.mesh && !enemy.mesh.isDisposed() && bulletData.active) {
            const distToEnemy = BABYLON.Vector3.Distance(currentPos, enemy.mesh.position);
            if (distToEnemy < 1.5) {
              if (!enemy.health) enemy.health = 100;
              enemy.health -= this.currentWeapon.damage;
              this.game.effectManager.createHitEffect(currentPos);
              this.game.effectManager.createBulletImpact(currentPos, bulletColor);
              this.game.audioManager.playHitSound();

              if (enemy.health <= 0) {
                this.game.enemySystem.killEnemy(enemy);
              }
              bulletData.active = false;
            }
          }
        });
      }

      const ray = new BABYLON.Ray(currentPos, direction, 0.5);
      const groundHit = this.scene.pickWithRay(ray, (mesh) => {
        return mesh.name.includes('ground');
      });

      if (groundHit && groundHit.hit && groundHit.distance < 0.3) {
        this.game.effectManager.createBulletImpact(currentPos, bulletColor);
        bulletData.active = false;
      }

      if (distance < maxDistance && bulletData.active) {
        requestAnimationFrame(animateBullet);
      } else {
        tailParts.forEach(part => part.mesh.dispose());
        core.dispose();
        glowRing.dispose();
        bullet.dispose();

        const idx = this.activeBullets.indexOf(bulletData);
        if (idx > -1) this.activeBullets.splice(idx, 1);
      }
    };

    animateBullet();
  }

  throwGrenade() {
    if (this.grenades <= 0) return;
    this.grenades--;

    const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
    const startPos = this.camera.position.add(forward.scale(1));

    this.createGrenadeProjectile(startPos, forward, 25);
  }

  fireGrenade() {
    this.currentWeapon.magazineAmmo--;
    this.shootCooldown = this.currentWeapon.fireRate;

    const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
    const startPos = this.camera.position.add(forward.scale(1.5));

    this.createGrenadeProjectile(startPos, forward, 35);
    this.recoilAmount = 0.05;
    this.game.effectManager.createShootShake();
  }

  createGrenadeProjectile(startPos, direction, speed) {
    const grenade = BABYLON.MeshBuilder.CreateSphere('grenade', { diameter: 0.3 }, this.scene);
    const grenadeMat = new BABYLON.StandardMaterial('grenadeMat', this.scene);
    grenadeMat.diffuseColor = new BABYLON.Color3(0.2, 0.3, 0.2);
    grenadeMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    grenade.material = grenadeMat;

    const ring = BABYLON.MeshBuilder.CreateTorus('ring', { diameter: 0.32, thickness: 0.03 }, this.scene);
    ring.parent = grenade;
    const ringMat = new BABYLON.StandardMaterial('ringMat', this.scene);
    ringMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.4);
    ring.material = ringMat;

    grenade.position = startPos.clone();

    let velocity = direction.scale(speed);
    velocity.y += 5;
    let time = 0;
    const fuseTime = 2.5;

    const light = BABYLON.MeshBuilder.CreateSphere('fuseLight', { diameter: 0.08 }, this.scene);
    const lightMat = new BABYLON.StandardMaterial('fuseMat', this.scene);
    lightMat.emissiveColor = new BABYLON.Color3(1, 0, 0);
    light.material = lightMat;
    light.parent = grenade;
    light.position.y = 0.15;

    const animateGrenade = () => {
      time += 0.016;

      velocity.y -= 15 * 0.016;
      grenade.position.addInPlace(velocity.scale(0.016));
      grenade.rotation.x += 0.1;
      grenade.rotation.z += 0.05;

      const groundY = this.game.terrainSystem.noise(grenade.position.x, grenade.position.z);
      if (grenade.position.y < groundY + 0.2) {
        velocity.y = Math.abs(velocity.y) * 0.4;
        velocity.x *= 0.7;
        velocity.z *= 0.7;
        grenade.position.y = groundY + 0.2;
      }

      const blinkRate = Math.min(20, 3 + time * 5);
      lightMat.emissiveColor = Math.sin(time * blinkRate) > 0
        ? new BABYLON.Color3(1, 0, 0)
        : new BABYLON.Color3(0.2, 0, 0);

      if (time < fuseTime) {
        requestAnimationFrame(animateGrenade);
      } else {
        this.game.effectManager.createExplosion(
          grenade.position.clone(),
          this.currentWeapon.blastRadius || 8,
          this.currentWeapon.damage || 80,
          this.game.enemies,
          this.game.playerStats,
          this.game.collisionCapsule,
          () => this.game.uiManager.gameOver()
        );
        grenade.dispose();
      }
    };

    animateGrenade();
  }

  fireRocket() {
    this.currentWeapon.magazineAmmo--;
    this.shootCooldown = this.currentWeapon.fireRate;
    this.recoilAmount = 0.15;
    this.game.effectManager.createShootShake();

    const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
    const startPos = this.camera.position.add(forward.scale(1.5));

    const rocket = BABYLON.MeshBuilder.CreateCylinder('rocket', {
      height: 0.8,
      diameterTop: 0.08,
      diameterBottom: 0.15
    }, this.scene);
    const rocketMat = new BABYLON.StandardMaterial('rocketMat', this.scene);
    rocketMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    rocketMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    rocket.material = rocketMat;

    for (let i = 0; i < 4; i++) {
      const fin = BABYLON.MeshBuilder.CreateBox('fin', { width: 0.2, height: 0.15, depth: 0.02 }, this.scene);
      fin.rotation.y = i * Math.PI / 2;
      fin.position.y = -0.3;
      fin.parent = rocket;
      fin.material = rocketMat;
    }

    const flame = BABYLON.MeshBuilder.CreateCylinder('flame', {
      height: 0.5,
      diameterTop: 0.15,
      diameterBottom: 0.02
    }, this.scene);
    const flameMat = new BABYLON.StandardMaterial('flameMat', this.scene);
    flameMat.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
    flameMat.alpha = 0.8;
    flame.material = flameMat;
    flame.position.y = -0.6;
    flame.parent = rocket;

    rocket.position = startPos.clone();

    const target = startPos.add(forward.scale(100));
    rocket.lookAt(target);
    rocket.rotation.x += Math.PI / 2;

    const speed = 25;
    let distance = 0;
    const maxDistance = 100;

    const smokeTrail = [];

    const animateRocket = () => {
      distance += speed * 0.016;
      rocket.position = startPos.add(forward.scale(distance));

      flame.scaling.y = 0.8 + Math.random() * 0.4;
      flameMat.emissiveColor = new BABYLON.Color3(
        1,
        0.3 + Math.random() * 0.4,
        Math.random() * 0.2
      );

      if (Math.random() < 0.3) {
        const smoke = BABYLON.MeshBuilder.CreateSphere('smoke', { diameter: 0.3 + Math.random() * 0.2 }, this.scene);
        const smokeMat = new BABYLON.StandardMaterial('smokeMat', this.scene);
        smokeMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        smokeMat.alpha = 0.6;
        smoke.material = smokeMat;
        smoke.position = rocket.position.clone();
        smokeTrail.push({ mesh: smoke, mat: smokeMat, life: 0 });
      }

      smokeTrail.forEach((s, idx) => {
        s.life += 0.016;
        s.mat.alpha -= 0.02;
        s.mesh.scaling.scaleInPlace(1.02);
        if (s.mat.alpha <= 0) {
          s.mesh.dispose();
          smokeTrail.splice(idx, 1);
        }
      });

      let hit = false;
      this.game.enemies.forEach(enemy => {
        if (enemy.mesh && !enemy.mesh.isDisposed()) {
          const dist = BABYLON.Vector3.Distance(rocket.position, enemy.mesh.position);
          if (dist < 2) {
            hit = true;
          }
        }
      });

      const groundY = this.game.terrainSystem.noise(rocket.position.x, rocket.position.z);
      if (rocket.position.y < groundY + 0.5) {
        hit = true;
      }

      if (hit || distance > maxDistance) {
        this.game.effectManager.createExplosion(
          rocket.position.clone(),
          this.currentWeapon.blastRadius || 12,
          this.currentWeapon.damage || 120,
          this.game.enemies,
          this.game.playerStats,
          this.game.collisionCapsule,
          () => this.game.uiManager.gameOver()
        );
        smokeTrail.forEach(s => s.mesh.dispose());
        rocket.dispose();
      } else {
        requestAnimationFrame(animateRocket);
      }
    };

    animateRocket();
    this.game.audioManager.playRocketSound();
  }

  fireLaser() {
    this.currentWeapon.magazineAmmo--;
    this.shootCooldown = this.currentWeapon.fireRate;

    const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
    const startPos = this.camera.position.add(forward.scale(1));

    const laser = BABYLON.MeshBuilder.CreateCylinder('laser', {
      height: 100,
      diameter: 0.05
    }, this.scene);
    const laserMat = new BABYLON.StandardMaterial('laserMat', this.scene);
    laserMat.emissiveColor = new BABYLON.Color3(0, 1, 0.5);
    laserMat.alpha = 0.8;
    laserMat.disableLighting = true;
    laser.material = laserMat;

    const glow = BABYLON.MeshBuilder.CreateCylinder('laserGlow', {
      height: 100,
      diameter: 0.15
    }, this.scene);
    const glowMat = new BABYLON.StandardMaterial('glowMat', this.scene);
    glowMat.emissiveColor = new BABYLON.Color3(0, 0.5, 0.3);
    glowMat.alpha = 0.3;
    glowMat.disableLighting = true;
    glow.material = glowMat;
    glow.parent = laser;

    laser.position = startPos.add(forward.scale(50));
    const target = startPos.add(forward.scale(100));
    laser.lookAt(target);
    laser.rotation.x += Math.PI / 2;

    this.game.enemies.forEach(enemy => {
      if (enemy.mesh && !enemy.mesh.isDisposed()) {
        const dist = BABYLON.Vector3.Distance(
          startPos.add(forward.scale(BABYLON.Vector3.Distance(startPos, enemy.mesh.position))),
          enemy.mesh.position
        );
        if (dist < 2) {
          enemy.health -= this.currentWeapon.damage;
          this.game.effectManager.createBulletImpact(enemy.mesh.position, new BABYLON.Color3(0, 1, 0.5));

          if (enemy.health <= 0) {
            this.game.enemySystem.killEnemy(enemy);
          }
        }
      }
    });

    let laserLife = 0;
    const fadeLaser = () => {
      laserLife += 0.016;
      laserMat.alpha = 0.8 - laserLife * 8;
      glowMat.alpha = 0.3 - laserLife * 3;

      if (laserLife < 0.1) {
        requestAnimationFrame(fadeLaser);
      } else {
        laser.dispose();
      }
    };
    fadeLaser();

    this.game.audioManager.playLaserSound();
  }

  ejectShell() {
    const shell = BABYLON.MeshBuilder.CreateCylinder('shell', {
      height: 0.022,
      diameter: 0.009
    }, this.scene);

    const shellMat = new BABYLON.PBRMaterial('shellMat', this.scene);
    shellMat.albedoColor = new BABYLON.Color3(0.85, 0.65, 0.2);
    shellMat.metallic = 0.9;
    shellMat.roughness = 0.15;
    shell.material = shellMat;

    const right = this.camera.getDirection(BABYLON.Vector3.Right());
    const forward = this.camera.getDirection(BABYLON.Vector3.Forward());

    shell.position = this.camera.position.clone();
    shell.position.x += right.x * 0.35 + forward.x * 0.25;
    shell.position.y -= 0.12;
    shell.position.z += right.z * 0.35 + forward.z * 0.25;

    const velocity = {
      x: right.x * 3.5 + (Math.random() - 0.5) * 0.8,
      y: 0.8 + Math.random() * 0.4,
      z: right.z * 3.5 + (Math.random() - 0.5) * 0.8
    };

    let time = 0;
    const animateShell = () => {
      time += 0.016;
      shell.position.x += velocity.x * 0.016;
      shell.position.y += velocity.y * 0.016;
      shell.position.z += velocity.z * 0.016;
      velocity.y -= 9.8 * 0.016;

      shell.rotation.x += 0.45;
      shell.rotation.z += 0.3;
      shell.rotation.y += 0.2;

      if (time < 1.5 && shell.position.y > -10) {
        requestAnimationFrame(animateShell);
      } else {
        shell.dispose();
      }
    };
    animateShell();
  }

  update(deltaTime, moveX, moveZ) {
    if (this.shootCooldown > 0) {
      this.shootCooldown -= deltaTime;
    }

    // 연사 처리
    if (this.isAutoFire && this.game.isMouseDown && this.shootCooldown <= 0 && !this.isReloading) {
      this.shoot();
    }

    // 반동 복구
    if (this.recoilAmount > 0) {
      this.recoilAmount -= deltaTime * 0.4;
      if (this.recoilAmount < 0) this.recoilAmount = 0;
    }

    if (this.gunSlide && !this.isReloading) {
      this.gunSlide.position.z = 0.03 - this.recoilAmount * 0.6;
    }

    if (this.gunParent && !this.isReloading) {
      this.gunIdleTime += deltaTime;

      // ADS 전환 애니메이션
      const aimSpeed = 8;
      if (this.isAiming) {
        this.aimTransition = Math.min(1, this.aimTransition + deltaTime * aimSpeed);
      } else {
        this.aimTransition = Math.max(0, this.aimTransition - deltaTime * aimSpeed);
      }

      // FOV 조정
      const targetFOV = this.isAiming
        ? (this.currentWeapon.scopeZoom ? this.normalFOV / this.currentWeapon.scopeZoom : this.aimFOV)
        : this.normalFOV;
      this.camera.fov = BABYLON.Tools.ToRadians(
        this.normalFOV + (targetFOV - this.normalFOV) * this.aimTransition
      );

      const aimMultiplier = 1 - this.aimTransition * 0.7;
      const breathSway = Math.sin(this.gunIdleTime * 2) * 0.003 * aimMultiplier;
      const walkBob = (Math.abs(moveX) > 0 || Math.abs(moveZ) > 0)
        ? Math.sin(this.gunIdleTime * 15) * 0.01 * aimMultiplier
        : 0;

      const normalPos = this.normalGunPos;
      const aimPos = this.currentWeapon.type === 'sniper'
        ? new BABYLON.Vector3(0, -0.05, 0.3)
        : this.aimGunPos;

      this.gunParent.position.x = normalPos.x + (aimPos.x - normalPos.x) * this.aimTransition + Math.sin(this.gunIdleTime * 2.5) * 0.002 * aimMultiplier;
      this.gunParent.position.y = normalPos.y + (aimPos.y - normalPos.y) * this.aimTransition + breathSway + walkBob - this.recoilAmount * 2.5 * aimMultiplier;
      this.gunParent.position.z = normalPos.z + (aimPos.z - normalPos.z) * this.aimTransition;
      this.gunParent.rotation.x = -this.recoilAmount * 3.5 * aimMultiplier;

      this.game.uiManager.updateScopeOverlay();
    }
  }
}
