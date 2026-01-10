// EnemySystem - 적 관련 모든 기능 관리

export class EnemySystem {
  constructor(game) {
    this.game = game;
    this.enemies = [];
    this.enemySpawnTimer = 0;
    this.enemyAttackCooldown = 0;
  }

  get scene() {
    return this.game.scene;
  }

  spawnInitialEnemies() {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const distance = 20 + Math.random() * 20;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = this.game.terrainSystem.noise(x, z) + 2;

      this.spawnEnemy(new BABYLON.Vector3(x, y, z));
    }
  }

  spawnEnemy(position) {
    const enemy = this.createEnemyCharacter(position);
    this.enemies.push({
      mesh: enemy.parent,
      aggregate: enemy.aggregate,
      gun: enemy.gun,
      initialPosition: position.clone(),
      patrolRadius: 8,
      speed: 1.5,
      chaseSpeed: 3.5,
      detectionRange: 25,
      attackRange: 20,
      state: 'patrol',
      patrolAngle: Math.random() * Math.PI * 2,
      health: 100,
      shootCooldown: 0,
      shootInterval: 1.5 + Math.random() * 1.0
    });
  }

  spawnRandomEnemy() {
    if (this.enemies.length >= 20) return;

    const playerPos = this.game.collisionCapsule ? this.game.collisionCapsule.position : new BABYLON.Vector3(0, 0, 0);
    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 30;
    const x = playerPos.x + Math.cos(angle) * distance;
    const z = playerPos.z + Math.sin(angle) * distance;
    const y = this.game.terrainSystem.noise(x, z) + 2;

    this.spawnEnemy(new BABYLON.Vector3(x, y, z));
  }

  createEnemyCharacter(position) {
    const parent = BABYLON.MeshBuilder.CreateBox('enemy', { size: 0.01 }, this.scene);
    parent.position = position;

    const bodyMat = new BABYLON.PBRMaterial('enemyBodyMat' + Math.random(), this.scene);
    bodyMat.albedoColor = new BABYLON.Color3(0.4, 0.2, 0.2);
    bodyMat.roughness = 0.8;

    // 목
    const neck = BABYLON.MeshBuilder.CreateCylinder('neck', { height: 0.3, diameter: 0.2 }, this.scene);
    neck.position.y = 1.1;
    neck.parent = parent;
    neck.material = bodyMat;

    // 몸통
    const body = BABYLON.MeshBuilder.CreateCylinder('enemyBody', {
      height: 1.2,
      diameterTop: 0.5,
      diameterBottom: 0.4
    }, this.scene);
    body.position.y = 0.6;
    body.parent = parent;
    body.material = bodyMat;

    // 팔
    const leftArm = BABYLON.MeshBuilder.CreateCylinder('leftArm', { height: 0.7, diameter: 0.12 }, this.scene);
    leftArm.rotation.x = Math.PI / 2;
    leftArm.position = new BABYLON.Vector3(-0.35, 0.9, 0.35);
    leftArm.parent = parent;
    leftArm.material = bodyMat;

    const rightArm = BABYLON.MeshBuilder.CreateCylinder('rightArm', { height: 0.7, diameter: 0.12 }, this.scene);
    rightArm.rotation.x = Math.PI / 2;
    rightArm.position = new BABYLON.Vector3(0.35, 0.9, 0.35);
    rightArm.parent = parent;
    rightArm.material = bodyMat;

    // 다리
    const leftLeg = BABYLON.MeshBuilder.CreateCylinder('leftLeg', { height: 0.6, diameter: 0.18 }, this.scene);
    leftLeg.position = new BABYLON.Vector3(-0.15, 0.15, 0);
    leftLeg.parent = parent;
    leftLeg.material = bodyMat;

    const rightLeg = BABYLON.MeshBuilder.CreateCylinder('rightLeg', { height: 0.6, diameter: 0.18 }, this.scene);
    rightLeg.position = new BABYLON.Vector3(0.15, 0.15, 0);
    rightLeg.parent = parent;
    rightLeg.material = bodyMat;

    // 머리
    const headFront = BABYLON.MeshBuilder.CreatePlane('enemyHead', { width: 3, height: 3 }, this.scene);
    headFront.position.y = 1.8;
    headFront.parent = parent;
    headFront.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    const headMat = new BABYLON.StandardMaterial('enemyHeadMat' + Math.random(), this.scene);
    const headTexture = new BABYLON.Texture('/survival-game/head.png', this.scene);
    headTexture.hasAlpha = true;
    headMat.diffuseTexture = headTexture;
    headMat.specularColor = new BABYLON.Color3(0, 0, 0);
    headMat.emissiveTexture = headTexture;
    headMat.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    headMat.useAlphaFromDiffuseTexture = true;
    headMat.backFaceCulling = false;
    headFront.material = headMat;

    // 적 총
    const gunMat = new BABYLON.PBRMaterial('enemyGunMat' + Math.random(), this.scene);
    gunMat.albedoColor = new BABYLON.Color3(0.15, 0.15, 0.15);
    gunMat.metallic = 0.9;
    gunMat.roughness = 0.3;

    const enemyGun = BABYLON.MeshBuilder.CreateBox('enemyGun', {
      width: 0.08,
      height: 0.12,
      depth: 0.4
    }, this.scene);
    enemyGun.position = new BABYLON.Vector3(0.4, 0.8, 0.3);
    enemyGun.rotation.x = -0.3;
    enemyGun.parent = parent;
    enemyGun.material = gunMat;

    const enemyBarrel = BABYLON.MeshBuilder.CreateCylinder('enemyBarrel', {
      height: 0.2,
      diameter: 0.04
    }, this.scene);
    enemyBarrel.rotation.x = Math.PI / 2;
    enemyBarrel.position = new BABYLON.Vector3(0, 0, 0.3);
    enemyBarrel.parent = enemyGun;
    enemyBarrel.material = gunMat;

    // 물리
    const aggregate = new BABYLON.PhysicsAggregate(
      parent,
      BABYLON.PhysicsShapeType.CAPSULE,
      { mass: 50, restitution: 0.0, friction: 1.0 },
      this.scene
    );

    aggregate.body.setMassProperties({ inertia: new BABYLON.Vector3(0, 0, 0) });
    aggregate.body.setAngularDamping(1000);
    aggregate.body.setLinearDamping(0.8);

    parent.getChildMeshes().forEach(mesh => {
      this.game.shadowGenerator.addShadowCaster(mesh);
    });

    return { parent, aggregate, gun: enemyGun };
  }

  killEnemy(enemy) {
    if (!enemy.mesh) return;

    const deathPos = enemy.mesh.position.clone();

    const explosion = new BABYLON.ParticleSystem('explosion', 40, this.scene);
    explosion.emitter = deathPos;
    explosion.minSize = 0.08;
    explosion.maxSize = 0.25;
    explosion.minLifeTime = 0.25;
    explosion.maxLifeTime = 0.7;
    explosion.emitRate = 180;
    explosion.manualEmitCount = 35;
    explosion.direction1 = new BABYLON.Vector3(-1.5, 1.5, -1.5);
    explosion.direction2 = new BABYLON.Vector3(1.5, 4, 1.5);
    explosion.minEmitPower = 1.5;
    explosion.maxEmitPower = 5;
    explosion.color1 = new BABYLON.Color4(1, 0.35, 0.1, 1);
    explosion.color2 = new BABYLON.Color4(1, 0.55, 0.2, 1);
    explosion.colorDead = new BABYLON.Color4(0.25, 0.1, 0.05, 0);
    explosion.gravity = new BABYLON.Vector3(0, -4, 0);
    explosion.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    explosion.start();

    setTimeout(() => {
      explosion.stop();
      setTimeout(() => explosion.dispose(), 800);
    }, 180);

    if (enemy.aggregate) {
      enemy.aggregate.dispose();
    }
    enemy.mesh.dispose();

    const index = this.enemies.indexOf(enemy);
    if (index > -1) {
      this.enemies.splice(index, 1);
    }
  }

  enemyShoot(enemy, targetPos) {
    if (!enemy.mesh) return;

    const enemyPos = enemy.mesh.position.clone();
    enemyPos.y += 0.8;

    const direction = targetPos.subtract(enemyPos);
    direction.x += (Math.random() - 0.5) * 0.4;
    direction.y += (Math.random() - 0.5) * 0.3;
    direction.z += (Math.random() - 0.5) * 0.4;
    direction.normalize();

    const flash = BABYLON.MeshBuilder.CreateSphere('enemyFlash', { diameter: 0.2 }, this.scene);
    const flashMat = new BABYLON.StandardMaterial('enemyFlashMat', this.scene);
    flashMat.emissiveColor = new BABYLON.Color3(1, 0.4, 0.1);
    flashMat.disableLighting = true;
    flash.material = flashMat;
    flash.position = enemyPos.clone();

    setTimeout(() => flash.dispose(), 60);

    this.game.weaponSystem.createMatrixBullet(enemyPos, direction, 'enemy');

    const playerPos = this.game.collisionCapsule ? this.game.collisionCapsule.position : this.game.player.position;
    this.game.audioManager.playEnemyGunSound(enemy.mesh.position, playerPos);
  }

  update(deltaTime) {
    if (!this.game.player) return;

    this.enemyAttackCooldown -= deltaTime;

    this.enemies.forEach(enemy => {
      if (!enemy.mesh || !enemy.aggregate) return;

      const enemyPos = enemy.mesh.position;
      const playerPos = this.game.collisionCapsule ? this.game.collisionCapsule.position : this.game.player.position;
      const distanceToPlayer = BABYLON.Vector3.Distance(enemyPos, playerPos);

      if (distanceToPlayer < enemy.detectionRange) {
        enemy.state = 'chase';
      } else if (distanceToPlayer > enemy.detectionRange * 1.5) {
        enemy.state = 'patrol';
      }

      let targetDir;
      let currentSpeed;

      if (enemy.state === 'chase') {
        targetDir = playerPos.subtract(enemyPos);
        targetDir.y = 0;
        targetDir.normalize();
        currentSpeed = enemy.chaseSpeed;

        if (enemy.shootCooldown > 0) {
          enemy.shootCooldown -= deltaTime;
        }

        if (distanceToPlayer < enemy.attackRange && distanceToPlayer > 3 && enemy.shootCooldown <= 0) {
          enemy.shootCooldown = enemy.shootInterval;
          this.enemyShoot(enemy, playerPos);
        }

        if (distanceToPlayer < 2.0 && this.enemyAttackCooldown <= 0) {
          this.enemyAttackCooldown = 1.0;
          this.game.playerStats.health -= 10;
          this.game.effectManager.showDamageEffect();
          console.log(`공격당함! 체력: ${this.game.playerStats.health}`);

          if (this.game.playerAggregate) {
            const knockbackDir = this.game.collisionCapsule.position.subtract(enemyPos);
            knockbackDir.y = 0.5;
            knockbackDir.normalize();
            this.game.playerAggregate.body.applyImpulse(
              knockbackDir.scale(200),
              this.game.collisionCapsule.position
            );
          }

          if (this.game.playerStats.health <= 0) {
            this.game.uiManager.gameOver();
          }
        }
      } else {
        enemy.patrolAngle += deltaTime * 0.3;
        const patrolX = enemy.initialPosition.x + Math.cos(enemy.patrolAngle) * enemy.patrolRadius;
        const patrolZ = enemy.initialPosition.z + Math.sin(enemy.patrolAngle) * enemy.patrolRadius;

        targetDir = new BABYLON.Vector3(patrolX - enemyPos.x, 0, patrolZ - enemyPos.z);
        if (targetDir.length() > 0.1) {
          targetDir.normalize();
        }
        currentSpeed = enemy.speed;
      }

      if (targetDir && targetDir.length() > 0) {
        const currentVelocity = enemy.aggregate.body.getLinearVelocity();
        enemy.aggregate.body.setLinearVelocity(new BABYLON.Vector3(
          targetDir.x * currentSpeed,
          currentVelocity.y,
          targetDir.z * currentSpeed
        ));

        const angle = Math.atan2(targetDir.x, targetDir.z);
        enemy.mesh.rotation.y = angle;
      }

      // 애니메이션
      const time = Date.now() * (enemy.state === 'chase' ? 0.01 : 0.005);
      const armSwing = enemy.state === 'chase' ? 0.4 : 0.2;

      const leftArm = enemy.mesh.getChildMeshes().find(m => m.name === 'leftArm');
      const rightArm = enemy.mesh.getChildMeshes().find(m => m.name === 'rightArm');
      if (leftArm) leftArm.rotation.x = Math.PI / 2 + Math.sin(time) * armSwing;
      if (rightArm) rightArm.rotation.x = Math.PI / 2 + Math.cos(time) * armSwing;

      const head = enemy.mesh.getChildMeshes().find(m => m.name === 'enemyHead');
      if (head) {
        const bobTime = Date.now() * 0.003;
        head.position.y = 1.8 + Math.sin(bobTime * 2) * 0.1;
        const scale = enemy.state === 'chase' ? 1.1 + Math.sin(bobTime * 5) * 0.1 : 1 + Math.sin(bobTime * 3) * 0.05;
        head.scaling = new BABYLON.Vector3(scale, scale, scale);
      }
    });

    // 적 스폰
    this.enemySpawnTimer += deltaTime;
    if (this.enemySpawnTimer > 5) {
      this.spawnRandomEnemy();
      this.enemySpawnTimer = 0;
    }
  }
}
