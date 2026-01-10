// PlayerSystem - 플레이어 관련 모든 기능 관리

export class PlayerSystem {
  constructor(game) {
    this.game = game;
    this.player = null;
    this.collisionCapsule = null;
    this.playerAggregate = null;
    this.isFirstPerson = true;
  }

  get scene() {
    return this.game.scene;
  }

  createHumanoidModel(radiusMultiplier, heightMultiplier) {
    const parent = BABYLON.MeshBuilder.CreateBox('humanoid', { size: 0.01 }, this.scene);
    const size = this.game.customization.size;

    const head = BABYLON.MeshBuilder.CreateSphere('head', { diameter: 0.4 * size }, this.scene);
    head.position.y = 1.7 * heightMultiplier * size;
    head.parent = parent;

    const faceMat = new BABYLON.PBRMaterial('faceMat', this.scene);
    faceMat.albedoColor = new BABYLON.Color3(1, 0.85, 0.7);
    faceMat.roughness = 0.6;
    head.material = faceMat;

    const torso = BABYLON.MeshBuilder.CreateCylinder('torso', {
      height: 0.6 * heightMultiplier * size,
      diameterTop: 0.5 * radiusMultiplier * size,
      diameterBottom: 0.45 * radiusMultiplier * size
    }, this.scene);
    torso.position.y = 1.1 * heightMultiplier * size;
    torso.parent = parent;

    const leftArm = BABYLON.MeshBuilder.CreateCylinder('leftArm', {
      height: 0.5 * size,
      diameter: 0.12 * radiusMultiplier * size
    }, this.scene);
    leftArm.rotation.z = Math.PI / 6;
    leftArm.position = new BABYLON.Vector3(-0.35 * radiusMultiplier * size, 1.1 * heightMultiplier * size, 0);
    leftArm.parent = parent;

    const rightArm = BABYLON.MeshBuilder.CreateCylinder('rightArm', {
      height: 0.5 * size,
      diameter: 0.12 * radiusMultiplier * size
    }, this.scene);
    rightArm.rotation.z = -Math.PI / 6;
    rightArm.position = new BABYLON.Vector3(0.35 * radiusMultiplier * size, 1.1 * heightMultiplier * size, 0);
    rightArm.parent = parent;

    const leftLeg = BABYLON.MeshBuilder.CreateCylinder('leftLeg', {
      height: 0.7 * heightMultiplier * size,
      diameter: 0.16 * radiusMultiplier * size
    }, this.scene);
    leftLeg.position = new BABYLON.Vector3(-0.12 * radiusMultiplier * size, 0.35 * heightMultiplier * size, 0);
    leftLeg.parent = parent;

    const rightLeg = BABYLON.MeshBuilder.CreateCylinder('rightLeg', {
      height: 0.7 * heightMultiplier * size,
      diameter: 0.16 * radiusMultiplier * size
    }, this.scene);
    rightLeg.position = new BABYLON.Vector3(0.12 * radiusMultiplier * size, 0.35 * heightMultiplier * size, 0);
    rightLeg.parent = parent;

    parent.getChildMeshes().forEach(mesh => {
      this.game.shadowGenerator.addShadowCaster(mesh);
    });

    return parent;
  }

  createPlayer() {
    let radiusMultiplier = 1.0;
    let heightMultiplier = 1.0;

    switch (this.game.customization.bodyType) {
      case 'slim':
        radiusMultiplier = 0.8;
        heightMultiplier = 1.1;
        break;
      case 'muscular':
        radiusMultiplier = 1.2;
        heightMultiplier = 0.95;
        break;
    }

    this.player = this.createHumanoidModel(radiusMultiplier, heightMultiplier);
    const startHeight = this.game.terrainSystem.noise(0, 0) + 3;
    this.player.position = new BABYLON.Vector3(0, startHeight, 0);

    const hexToColor3 = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return new BABYLON.Color3(r, g, b);
    };

    const playerMat = new BABYLON.PBRMaterial('playerMat', this.scene);
    playerMat.albedoColor = hexToColor3(this.game.customization.color);
    playerMat.metallic = 0.2;
    playerMat.roughness = 0.4;

    this.player.getChildMeshes().forEach((mesh) => {
      if (mesh.name !== 'head') {
        mesh.material = playerMat;
      }
    });

    this.player.setEnabled(false);

    this.collisionCapsule = BABYLON.MeshBuilder.CreateCapsule('playerCollision', {
      height: 1.8 * heightMultiplier * this.game.customization.size,
      radius: 0.3 * radiusMultiplier * this.game.customization.size,
    }, this.scene);
    this.collisionCapsule.isVisible = false;
    this.collisionCapsule.position = new BABYLON.Vector3(0, startHeight, 0);

    this.playerAggregate = new BABYLON.PhysicsAggregate(
      this.collisionCapsule,
      BABYLON.PhysicsShapeType.CAPSULE,
      { mass: 70, restitution: 0.0, friction: 1.0 },
      this.scene
    );

    this.playerAggregate.body.setMassProperties({ inertia: new BABYLON.Vector3(0, 0, 0) });
    this.playerAggregate.body.setAngularDamping(1000);
    this.playerAggregate.body.setLinearDamping(0.5);

    this.game.shadowGenerator.addShadowCaster(this.player);

    // game 객체에도 참조 설정
    this.game.player = this.player;
    this.game.collisionCapsule = this.collisionCapsule;
    this.game.playerAggregate = this.playerAggregate;
  }

  toggleViewMode() {
    this.isFirstPerson = !this.isFirstPerson;
    this.game.isFirstPerson = this.isFirstPerson;

    if (this.isFirstPerson) {
      this.player.setEnabled(false);
      if (this.game.weaponSystem.gunParent) this.game.weaponSystem.gunParent.setEnabled(true);
    } else {
      this.player.setEnabled(true);
      if (this.game.weaponSystem.gunParent) this.game.weaponSystem.gunParent.setEnabled(false);
    }

    console.log(this.isFirstPerson ? '1인칭 모드' : '3인칭 모드');
  }

  update(deltaTime) {
    if (!this.player || !this.playerAggregate) return { moveX: 0, moveZ: 0 };

    const speed = 8;
    let moveX = 0;
    let moveZ = 0;

    const forward = this.game.camera.getDirection(BABYLON.Vector3.Forward());
    forward.y = 0;
    forward.normalize();

    const right = this.game.camera.getDirection(BABYLON.Vector3.Right());
    right.y = 0;
    right.normalize();

    if (this.game.inputMap['w']) {
      moveX += forward.x * speed;
      moveZ += forward.z * speed;
    }
    if (this.game.inputMap['s']) {
      moveX -= forward.x * speed;
      moveZ -= forward.z * speed;
    }
    if (this.game.inputMap['a']) {
      moveX -= right.x * speed;
      moveZ -= right.z * speed;
    }
    if (this.game.inputMap['d']) {
      moveX += right.x * speed;
      moveZ += right.z * speed;
    }

    const currentVelocity = this.playerAggregate.body.getLinearVelocity();

    if (moveX !== 0 || moveZ !== 0) {
      this.playerAggregate.body.setLinearVelocity(new BABYLON.Vector3(
        moveX,
        currentVelocity.y,
        moveZ
      ));
    } else {
      this.playerAggregate.body.setLinearVelocity(new BABYLON.Vector3(
        currentVelocity.x * 0.9,
        currentVelocity.y,
        currentVelocity.z * 0.9
      ));
    }

    if (this.game.inputMap[' ']) {
      const vel = this.playerAggregate.body.getLinearVelocity();
      if (Math.abs(vel.y) < 0.5) {
        this.playerAggregate.body.applyImpulse(
          new BABYLON.Vector3(0, 400, 0),
          this.collisionCapsule.position
        );
        this.game.inputMap[' '] = false;
      }
    }

    const capsulePos = this.collisionCapsule.position;
    this.player.position.x = capsulePos.x;
    this.player.position.y = capsulePos.y - 0.9;
    this.player.position.z = capsulePos.z;

    // 카메라 위치
    const eyeHeight = 1.6 * this.game.customization.size;
    if (this.isFirstPerson) {
      this.game.camera.position = new BABYLON.Vector3(
        capsulePos.x,
        capsulePos.y + eyeHeight - 0.9,
        capsulePos.z
      );
    } else {
      const behind = this.game.camera.getDirection(BABYLON.Vector3.Backward());
      this.game.camera.position = new BABYLON.Vector3(
        capsulePos.x + behind.x * 5,
        capsulePos.y + eyeHeight + 1,
        capsulePos.z + behind.z * 5
      );
      this.player.rotation.y = Math.atan2(
        this.game.camera.getDirection(BABYLON.Vector3.Forward()).x,
        this.game.camera.getDirection(BABYLON.Vector3.Forward()).z
      );
    }

    return { moveX, moveZ };
  }
}
