// VehicleSystem - 탈것 관련 모든 기능 관리

export class VehicleSystem {
  constructor(game) {
    this.game = game;
    this.spawnedVehicles = [];
    this.mountedVehicle = null;
    this.isMounted = false;
  }

  get scene() {
    return this.game.scene;
  }

  toggleVehicleMount() {
    if (this.isMounted && this.mountedVehicle) {
      this.dismountVehicle();
    } else {
      this.tryMountVehicle();
    }
  }

  tryMountVehicle() {
    if (!this.spawnedVehicles || !this.game.collisionCapsule) return;

    const playerPos = this.game.collisionCapsule.position;
    let closestVehicle = null;
    let closestDist = 5;

    this.spawnedVehicles.forEach(vehicle => {
      if (!vehicle.parent || vehicle.parent.isDisposed()) return;
      const dist = BABYLON.Vector3.Distance(playerPos, vehicle.parent.position);
      if (dist < closestDist && vehicle.canMount) {
        closestDist = dist;
        closestVehicle = vehicle;
      }
    });

    if (closestVehicle) {
      this.mountVehicle(closestVehicle);
    }
  }

  mountVehicle(vehicle) {
    this.isMounted = true;
    this.mountedVehicle = vehicle;

    if (this.game.collisionCapsule) {
      this.game.collisionCapsule.setEnabled(false);
    }
    if (this.game.player) {
      this.game.player.setEnabled(false);
    }

    this.game.camera.parent = vehicle.parent;
    this.game.camera.position = new BABYLON.Vector3(0, vehicle.type === 'helicopter' ? 5 : 3, vehicle.type === 'helicopter' ? -8 : -6);

    if (this.game.weaponSystem.gunParent) {
      this.game.weaponSystem.gunParent.setEnabled(false);
    }

    console.log(`${vehicle.type} 탑승!`);
  }

  dismountVehicle() {
    if (!this.mountedVehicle) return;

    const vehiclePos = this.mountedVehicle.parent.position.clone();

    this.game.camera.parent = null;
    this.game.camera.position = vehiclePos.clone();
    this.game.camera.position.y += 2;
    this.game.camera.position.z -= 3;

    if (this.game.collisionCapsule) {
      this.game.collisionCapsule.position = vehiclePos.clone();
      this.game.collisionCapsule.position.y += 2;
      this.game.collisionCapsule.position.x += 3;
      this.game.collisionCapsule.setEnabled(true);
    }
    if (this.game.player) {
      this.game.player.setEnabled(this.game.isFirstPerson ? false : true);
    }

    if (this.game.weaponSystem.gunParent) {
      this.game.weaponSystem.gunParent.setEnabled(this.game.isFirstPerson);
    }

    this.isMounted = false;
    this.mountedVehicle = null;

    console.log('탈것에서 하차!');
  }

  updateVehicleControls(deltaTime) {
    if (!this.isMounted || !this.mountedVehicle) return;

    const vehicle = this.mountedVehicle;
    const speed = vehicle.speed * deltaTime;
    const rotSpeed = 2 * deltaTime;

    if (this.game.inputMap['w']) {
      const forward = vehicle.parent.getDirection(BABYLON.Vector3.Forward());
      vehicle.parent.position.addInPlace(forward.scale(speed));
    }
    if (this.game.inputMap['s']) {
      const backward = vehicle.parent.getDirection(BABYLON.Vector3.Backward());
      vehicle.parent.position.addInPlace(backward.scale(speed * 0.5));
    }

    if (this.game.inputMap['a']) {
      vehicle.parent.rotation.y -= rotSpeed;
    }
    if (this.game.inputMap['d']) {
      vehicle.parent.rotation.y += rotSpeed;
    }

    if (vehicle.canFly) {
      if (this.game.inputMap[' ']) {
        vehicle.parent.position.y += speed * 0.5;
      }
      if (this.game.inputMap['shift']) {
        vehicle.parent.position.y = Math.max(this.game.terrainSystem.noise(vehicle.parent.position.x, vehicle.parent.position.z) + 2, vehicle.parent.position.y - speed * 0.5);
      }
    }

    if (vehicle.canShoot && this.game.isMouseDown) {
      if (!vehicle.shootCooldown || vehicle.shootCooldown <= 0) {
        this.fireVehicleWeapon(vehicle);
        vehicle.shootCooldown = 2;
      }
    }

    if (vehicle.shootCooldown > 0) {
      vehicle.shootCooldown -= deltaTime;
    }

    if (vehicle.indicator) {
      vehicle.indicator.position = vehicle.parent.position.clone();
      vehicle.indicator.position.y = this.game.terrainSystem.noise(vehicle.parent.position.x, vehicle.parent.position.z) + 0.1;
    }
  }

  fireVehicleWeapon(vehicle) {
    if (vehicle.type !== 'tank') return;

    const startPos = vehicle.parent.position.clone();
    startPos.y += 2.2;
    const forward = vehicle.parent.getDirection(BABYLON.Vector3.Forward());
    startPos.addInPlace(forward.scale(4));

    const shell = BABYLON.MeshBuilder.CreateSphere('tankShell', { diameter: 0.5 }, this.scene);
    shell.position = startPos;

    const shellMat = new BABYLON.StandardMaterial('shellMat', this.scene);
    shellMat.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
    shell.material = shellMat;

    const direction = forward.clone();
    const shellSpeed = 50;
    let shellLife = 0;

    const animateShell = () => {
      shellLife += 0.016;
      shell.position.addInPlace(direction.scale(shellSpeed * 0.016));
      shell.position.y -= 5 * 0.016 * shellLife;

      const groundY = this.game.terrainSystem.noise(shell.position.x, shell.position.z);
      if (shell.position.y <= groundY || shellLife > 5) {
        this.game.effectManager.createExplosion(
          shell.position.clone(),
          15,
          vehicle.damage,
          this.game.enemies,
          this.game.playerStats,
          this.game.collisionCapsule,
          () => this.game.uiManager.gameOver()
        );
        shell.dispose();
        return;
      }

      this.game.enemies.forEach(enemy => {
        if (!enemy.mesh) return;
        const dist = BABYLON.Vector3.Distance(shell.position, enemy.mesh.position);
        if (dist < 2) {
          this.game.effectManager.createExplosion(
            shell.position.clone(),
            15,
            vehicle.damage,
            this.game.enemies,
            this.game.playerStats,
            this.game.collisionCapsule,
            () => this.game.uiManager.gameOver()
          );
          shell.dispose();
          return;
        }
      });

      if (!shell.isDisposed()) {
        requestAnimationFrame(animateShell);
      }
    };
    animateShell();

    this.game.audioManager.playExplosionSound();
  }

  createVehicle(position, type) {
    const vehicleParent = new BABYLON.TransformNode(`vehicle_${type}_${Date.now()}`, this.scene);
    vehicleParent.position = position.clone();

    const metalMat = new BABYLON.PBRMaterial('vehicleMetal' + Date.now(), this.scene);
    metalMat.metallic = 0.8;
    metalMat.roughness = 0.3;

    let vehicle = { parent: vehicleParent, type, canMount: true, health: 100 };

    switch (type) {
      case 'car':
        metalMat.albedoColor = new BABYLON.Color3(0.2, 0.3, 0.8);
        vehicle.speed = 30;
        vehicle.health = 150;

        const carBody = BABYLON.MeshBuilder.CreateBox('carBody', {
          width: 2.5, height: 1.2, depth: 5
        }, this.scene);
        carBody.position.y = 0.8;
        carBody.parent = vehicleParent;
        carBody.material = metalMat;

        const carRoof = BABYLON.MeshBuilder.CreateBox('carRoof', {
          width: 2.2, height: 0.8, depth: 2.5
        }, this.scene);
        carRoof.position = new BABYLON.Vector3(0, 1.8, -0.3);
        carRoof.parent = vehicleParent;
        carRoof.material = metalMat;

        const wheelMat = new BABYLON.PBRMaterial('wheelMat', this.scene);
        wheelMat.albedoColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        wheelMat.roughness = 0.9;

        const wheelPositions = [
          new BABYLON.Vector3(-1.2, 0.4, 1.5),
          new BABYLON.Vector3(1.2, 0.4, 1.5),
          new BABYLON.Vector3(-1.2, 0.4, -1.5),
          new BABYLON.Vector3(1.2, 0.4, -1.5)
        ];

        wheelPositions.forEach((pos, i) => {
          const wheel = BABYLON.MeshBuilder.CreateCylinder(`wheel${i}`, {
            height: 0.3, diameter: 0.8
          }, this.scene);
          wheel.rotation.z = Math.PI / 2;
          wheel.position = pos;
          wheel.parent = vehicleParent;
          wheel.material = wheelMat;
        });

        const headlightMat = new BABYLON.StandardMaterial('headlightMat', this.scene);
        headlightMat.emissiveColor = new BABYLON.Color3(1, 1, 0.8);
        [-0.8, 0.8].forEach(x => {
          const light = BABYLON.MeshBuilder.CreateSphere('headlight', { diameter: 0.25 }, this.scene);
          light.position = new BABYLON.Vector3(x, 0.7, 2.5);
          light.parent = vehicleParent;
          light.material = headlightMat;
        });

        new BABYLON.PhysicsAggregate(carBody, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, this.scene);
        this.game.shadowGenerator.addShadowCaster(carBody);
        break;

      case 'tank':
        metalMat.albedoColor = new BABYLON.Color3(0.3, 0.35, 0.25);
        vehicle.speed = 15;
        vehicle.health = 500;
        vehicle.canShoot = true;
        vehicle.damage = 100;

        const tankBody = BABYLON.MeshBuilder.CreateBox('tankBody', {
          width: 3.5, height: 1.5, depth: 6
        }, this.scene);
        tankBody.position.y = 1;
        tankBody.parent = vehicleParent;
        tankBody.material = metalMat;

        const turret = BABYLON.MeshBuilder.CreateCylinder('tankTurret', {
          height: 1, diameter: 2.5
        }, this.scene);
        turret.position = new BABYLON.Vector3(0, 2, -0.5);
        turret.parent = vehicleParent;
        turret.material = metalMat;

        const cannon = BABYLON.MeshBuilder.CreateCylinder('tankCannon', {
          height: 4, diameter: 0.4
        }, this.scene);
        cannon.rotation.x = Math.PI / 2;
        cannon.position = new BABYLON.Vector3(0, 2.2, 2);
        cannon.parent = vehicleParent;
        cannon.material = metalMat;

        const trackMat = new BABYLON.PBRMaterial('trackMat', this.scene);
        trackMat.albedoColor = new BABYLON.Color3(0.15, 0.15, 0.15);
        trackMat.roughness = 0.95;

        [-1.5, 1.5].forEach(x => {
          const track = BABYLON.MeshBuilder.CreateBox('track', {
            width: 0.8, height: 0.8, depth: 5.5
          }, this.scene);
          track.position = new BABYLON.Vector3(x, 0.4, 0);
          track.parent = vehicleParent;
          track.material = trackMat;
        });

        new BABYLON.PhysicsAggregate(tankBody, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, this.scene);
        this.game.shadowGenerator.addShadowCaster(tankBody);
        break;

      case 'helicopter':
        metalMat.albedoColor = new BABYLON.Color3(0.4, 0.4, 0.35);
        vehicle.speed = 40;
        vehicle.health = 200;
        vehicle.canFly = true;

        const heliBody = BABYLON.MeshBuilder.CreateBox('heliBody', {
          width: 2, height: 2, depth: 6
        }, this.scene);
        heliBody.position.y = 2;
        heliBody.parent = vehicleParent;
        heliBody.material = metalMat;

        const glassMat = new BABYLON.StandardMaterial('glassMat', this.scene);
        glassMat.diffuseColor = new BABYLON.Color3(0.3, 0.5, 0.7);
        glassMat.alpha = 0.5;

        const cockpit = BABYLON.MeshBuilder.CreateSphere('cockpit', {
          diameter: 1.8, slice: 0.5
        }, this.scene);
        cockpit.rotation.x = -Math.PI / 2;
        cockpit.position = new BABYLON.Vector3(0, 2.2, 2.5);
        cockpit.parent = vehicleParent;
        cockpit.material = glassMat;

        const tail = BABYLON.MeshBuilder.CreateBox('heliTail', {
          width: 0.6, height: 0.8, depth: 4
        }, this.scene);
        tail.position = new BABYLON.Vector3(0, 2.2, -4.5);
        tail.parent = vehicleParent;
        tail.material = metalMat;

        const rotorMat = new BABYLON.PBRMaterial('rotorMat', this.scene);
        rotorMat.albedoColor = new BABYLON.Color3(0.2, 0.2, 0.2);

        const mainRotor = BABYLON.MeshBuilder.CreateBox('mainRotor', {
          width: 10, height: 0.1, depth: 0.3
        }, this.scene);
        mainRotor.position = new BABYLON.Vector3(0, 3.5, 0);
        mainRotor.parent = vehicleParent;
        mainRotor.material = rotorMat;
        vehicle.mainRotor = mainRotor;

        const tailRotor = BABYLON.MeshBuilder.CreateBox('tailRotor', {
          width: 0.1, height: 1.5, depth: 0.2
        }, this.scene);
        tailRotor.position = new BABYLON.Vector3(0.4, 2.5, -6.3);
        tailRotor.parent = vehicleParent;
        tailRotor.material = rotorMat;
        vehicle.tailRotor = tailRotor;

        [-0.8, 0.8].forEach(x => {
          const skid = BABYLON.MeshBuilder.CreateBox('skid', {
            width: 0.1, height: 0.1, depth: 3
          }, this.scene);
          skid.position = new BABYLON.Vector3(x, 0.5, 0);
          skid.parent = vehicleParent;
          skid.material = metalMat;
        });

        new BABYLON.PhysicsAggregate(heliBody, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, this.scene);
        this.game.shadowGenerator.addShadowCaster(heliBody);

        this.scene.onBeforeRenderObservable.add(() => {
          if (mainRotor && !mainRotor.isDisposed()) {
            mainRotor.rotation.y += 0.3;
          }
          if (tailRotor && !tailRotor.isDisposed()) {
            tailRotor.rotation.x += 0.5;
          }
        });
        break;
    }

    const indicator = BABYLON.MeshBuilder.CreateTorus('mountIndicator', {
      diameter: 4, thickness: 0.1
    }, this.scene);
    indicator.position = position.clone();
    indicator.position.y += 0.1;
    const indicatorMat = new BABYLON.StandardMaterial('indicatorMat', this.scene);
    indicatorMat.emissiveColor = new BABYLON.Color3(0, 1, 0.5);
    indicatorMat.alpha = 0.5;
    indicator.material = indicatorMat;
    vehicle.indicator = indicator;

    this.spawnedVehicles.push(vehicle);
  }
}
