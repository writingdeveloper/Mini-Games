// EffectManager - 시각 효과 관련 기능 관리

export class EffectManager {
  constructor(game) {
    this.game = game;
  }

  get scene() {
    return this.game.scene;
  }

  get camera() {
    return this.game.camera;
  }

  createBulletImpact(position, color) {
    const impactParticles = [];

    for (let i = 0; i < 12; i++) {
      const particle = BABYLON.MeshBuilder.CreateSphere('impact', { diameter: 0.08 }, this.scene);
      const mat = new BABYLON.StandardMaterial('impactMat', this.scene);
      mat.emissiveColor = color || new BABYLON.Color3(1, 0.8, 0.3);
      mat.disableLighting = true;
      particle.material = mat;
      particle.position = position.clone();

      const vel = new BABYLON.Vector3(
        (Math.random() - 0.5) * 8,
        Math.random() * 5,
        (Math.random() - 0.5) * 8
      );

      impactParticles.push({ mesh: particle, mat, vel, life: 0 });
    }

    const impactLight = new BABYLON.PointLight('impactLight', position, this.scene);
    impactLight.diffuse = color || new BABYLON.Color3(1, 0.8, 0.3);
    impactLight.intensity = 3;

    const animateImpact = () => {
      if (!this.scene || this.scene.isDisposed) {
        impactParticles.forEach(p => { if (!p.mesh.isDisposed()) p.mesh.dispose(); });
        if (!impactLight.isDisposed()) impactLight.dispose();
        return;
      }

      let allDone = true;

      impactParticles.forEach(p => {
        p.life += 0.016;
        p.vel.y -= 15 * 0.016;
        p.mesh.position.addInPlace(p.vel.scale(0.016));
        p.mat.alpha = Math.max(0, 1 - p.life * 3);
        p.mesh.scaling.scaleInPlace(0.95);

        if (p.life < 0.5) allDone = false;
      });

      impactLight.intensity *= 0.85;

      if (!allDone) {
        requestAnimationFrame(animateImpact);
      } else {
        impactParticles.forEach(p => { p.mesh.dispose(); p.mat.dispose(); });
        impactLight.dispose();
      }
    };

    animateImpact();
  }

  createExplosion(position, radius, damage, enemies, playerStats, collisionCapsule, onGameOver) {
    const explosion = BABYLON.MeshBuilder.CreateSphere('explosion', { diameter: 0.5, segments: 16 }, this.scene);
    const explosionMat = new BABYLON.StandardMaterial('explosionMat', this.scene);
    explosionMat.emissiveColor = new BABYLON.Color3(1, 0.6, 0);
    explosionMat.alpha = 0.9;
    explosion.material = explosionMat;
    explosion.position = position;

    const explosionLight = new BABYLON.PointLight('explosionLight', position, this.scene);
    explosionLight.diffuse = new BABYLON.Color3(1, 0.5, 0);
    explosionLight.intensity = 10;
    explosionLight.range = radius * 2;

    const particles = [];
    for (let i = 0; i < 30; i++) {
      const particle = BABYLON.MeshBuilder.CreateSphere('expParticle', { diameter: 0.2 + Math.random() * 0.3 }, this.scene);
      const mat = new BABYLON.StandardMaterial('expMat', this.scene);
      mat.emissiveColor = new BABYLON.Color3(1, 0.3 + Math.random() * 0.5, 0);
      mat.disableLighting = true;
      particle.material = mat;
      particle.position = position.clone();

      const vel = new BABYLON.Vector3(
        (Math.random() - 0.5) * 20,
        Math.random() * 15,
        (Math.random() - 0.5) * 20
      );

      particles.push({ mesh: particle, mat, vel, life: 0 });
    }

    const smokeParticles = [];
    for (let i = 0; i < 15; i++) {
      const smoke = BABYLON.MeshBuilder.CreateSphere('smoke', { diameter: 0.5 + Math.random() * 0.5 }, this.scene);
      const smokeMat = new BABYLON.StandardMaterial('smokeMat', this.scene);
      smokeMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
      smokeMat.alpha = 0.7;
      smoke.material = smokeMat;
      smoke.position = position.clone();

      const vel = new BABYLON.Vector3(
        (Math.random() - 0.5) * 5,
        2 + Math.random() * 3,
        (Math.random() - 0.5) * 5
      );

      smokeParticles.push({ mesh: smoke, mat: smokeMat, vel, life: 0 });
    }

    // 데미지 적용
    enemies.forEach(enemy => {
      if (enemy.mesh && !enemy.mesh.isDisposed()) {
        const dist = BABYLON.Vector3.Distance(position, enemy.mesh.position);
        if (dist < radius) {
          const damageFalloff = 1 - (dist / radius);
          enemy.health -= damage * damageFalloff;

          if (enemy.aggregate) {
            const knockbackDir = enemy.mesh.position.subtract(position);
            knockbackDir.y = 2;
            knockbackDir.normalize();
            enemy.aggregate.body.applyImpulse(
              knockbackDir.scale(500 * damageFalloff),
              enemy.mesh.position
            );
          }

          if (enemy.health <= 0) {
            this.game.enemySystem.killEnemy(enemy);
          }
        }
      }
    });

    // 플레이어 데미지
    if (collisionCapsule) {
      const distToPlayer = BABYLON.Vector3.Distance(position, collisionCapsule.position);
      if (distToPlayer < radius) {
        const damageFalloff = 1 - (distToPlayer / radius);
        playerStats.health -= Math.floor(damage * damageFalloff * 0.3);
        this.showDamageEffect();
        this.createShootShake();

        if (playerStats.health <= 0) {
          onGameOver();
        }
      }
    }

    let time = 0;
    const animateExplosion = () => {
      if (!this.scene || this.scene.isDisposed) {
        if (!explosion.isDisposed()) explosion.dispose();
        if (!explosionLight.isDisposed()) explosionLight.dispose();
        particles.forEach(p => { if (!p.mesh.isDisposed()) p.mesh.dispose(); p.mat.dispose(); });
        smokeParticles.forEach(s => { if (!s.mesh.isDisposed()) s.mesh.dispose(); s.mat.dispose(); });
        return;
      }

      time += 0.016;

      const scale = 1 + time * 20;
      explosion.scaling = new BABYLON.Vector3(scale, scale, scale);
      explosionMat.alpha = Math.max(0, 0.9 - time * 3);

      explosionLight.intensity = Math.max(0, 10 - time * 30);

      particles.forEach(p => {
        p.life += 0.016;
        p.vel.y -= 20 * 0.016;
        p.mesh.position.addInPlace(p.vel.scale(0.016));
        p.mat.alpha = Math.max(0, 1 - p.life * 2);
        p.mesh.scaling.scaleInPlace(0.97);
      });

      smokeParticles.forEach(s => {
        s.life += 0.016;
        s.mesh.position.addInPlace(s.vel.scale(0.016));
        s.mat.alpha = Math.max(0, 0.7 - s.life * 0.5);
        s.mesh.scaling.scaleInPlace(1.02);
      });

      if (time < 1.5) {
        requestAnimationFrame(animateExplosion);
      } else {
        explosion.dispose(); explosionMat.dispose();
        explosionLight.dispose();
        particles.forEach(p => { p.mesh.dispose(); p.mat.dispose(); });
        smokeParticles.forEach(s => { s.mesh.dispose(); s.mat.dispose(); });
      }
    };

    animateExplosion();
    this.game.audioManager.playExplosionSound();
  }

  createScreenFlash() {
    let flashOverlay = document.getElementById('shoot-flash');
    if (!flashOverlay) {
      flashOverlay = document.createElement('div');
      flashOverlay.id = 'shoot-flash';
      flashOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at 70% 60%, rgba(255, 200, 100, 0.25) 0%, transparent 40%);
        pointer-events: none;
        z-index: 999;
        opacity: 0;
        transition: opacity 0.03s;
      `;
      document.body.appendChild(flashOverlay);
    }

    flashOverlay.style.opacity = '1';
    setTimeout(() => {
      flashOverlay.style.opacity = '0';
    }, 30);
  }

  createShootShake() {
    if (!this.camera || !this.scene || this.scene.isDisposed) return;

    const shakeIntensity = 0.015;
    let shakeTime = 0;

    const shake = () => {
      if (!this.scene || this.scene.isDisposed) return;
      shakeTime += 0.016;
      if (shakeTime < 0.06) {
        this.camera.rotation.x += (Math.random() - 0.5) * shakeIntensity;
        this.camera.rotation.y += (Math.random() - 0.5) * shakeIntensity * 0.3;
        requestAnimationFrame(shake);
      }
    };
    shake();
  }

  createMuzzleSparks() {
    const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
    const right = this.camera.getDirection(BABYLON.Vector3.Right());
    const sparkPos = this.camera.position.add(forward.scale(0.6)).add(right.scale(0.2));
    sparkPos.y -= 0.15;

    const sparks = new BABYLON.ParticleSystem('muzzleSparks', 25, this.scene);
    sparks.emitter = sparkPos;
    sparks.minSize = 0.008;
    sparks.maxSize = 0.025;
    sparks.minLifeTime = 0.03;
    sparks.maxLifeTime = 0.1;
    sparks.emitRate = 400;
    sparks.manualEmitCount = 15;
    sparks.direction1 = forward.add(new BABYLON.Vector3(-0.2, 0.2, -0.2));
    sparks.direction2 = forward.add(new BABYLON.Vector3(0.2, 0.4, 0.2));
    sparks.minEmitPower = 8;
    sparks.maxEmitPower = 15;
    sparks.color1 = new BABYLON.Color4(1, 0.95, 0.4, 1);
    sparks.color2 = new BABYLON.Color4(1, 0.6, 0.2, 1);
    sparks.colorDead = new BABYLON.Color4(0.6, 0.2, 0.1, 0);
    sparks.gravity = new BABYLON.Vector3(0, -2, 0);
    sparks.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    sparks.start();

    setTimeout(() => {
      sparks.stop();
      setTimeout(() => sparks.dispose(), 150);
    }, 40);

    const smoke = new BABYLON.ParticleSystem('muzzleSmoke', 8, this.scene);
    smoke.emitter = sparkPos;
    smoke.minSize = 0.03;
    smoke.maxSize = 0.1;
    smoke.minLifeTime = 0.15;
    smoke.maxLifeTime = 0.4;
    smoke.emitRate = 80;
    smoke.manualEmitCount = 4;
    smoke.direction1 = forward.add(new BABYLON.Vector3(-0.15, 0.2, -0.15));
    smoke.direction2 = forward.add(new BABYLON.Vector3(0.15, 0.4, 0.15));
    smoke.minEmitPower = 0.5;
    smoke.maxEmitPower = 2;
    smoke.color1 = new BABYLON.Color4(0.5, 0.5, 0.5, 0.25);
    smoke.color2 = new BABYLON.Color4(0.35, 0.35, 0.35, 0.15);
    smoke.colorDead = new BABYLON.Color4(0.2, 0.2, 0.2, 0);
    smoke.gravity = new BABYLON.Vector3(0, 0.8, 0);
    smoke.start();

    setTimeout(() => {
      smoke.stop();
      setTimeout(() => smoke.dispose(), 500);
    }, 80);
  }

  createDustEffect(position) {
    const dust = new BABYLON.ParticleSystem('dust', 12, this.scene);
    dust.emitter = position;
    dust.minSize = 0.04;
    dust.maxSize = 0.12;
    dust.minLifeTime = 0.25;
    dust.maxLifeTime = 0.5;
    dust.emitRate = 80;
    dust.manualEmitCount = 8;
    dust.direction1 = new BABYLON.Vector3(-0.8, 0.8, -0.8);
    dust.direction2 = new BABYLON.Vector3(0.8, 1.5, 0.8);
    dust.minEmitPower = 0.8;
    dust.maxEmitPower = 2.5;
    dust.color1 = new BABYLON.Color4(0.55, 0.45, 0.35, 0.45);
    dust.color2 = new BABYLON.Color4(0.4, 0.35, 0.3, 0.3);
    dust.colorDead = new BABYLON.Color4(0.3, 0.25, 0.2, 0);
    dust.gravity = new BABYLON.Vector3(0, -1.5, 0);
    dust.start();

    setTimeout(() => {
      dust.stop();
      setTimeout(() => dust.dispose(), 600);
    }, 80);
  }

  createHitEffect(position) {
    const sparks = new BABYLON.ParticleSystem('hitSparks', 35, this.scene);
    sparks.emitter = position;
    sparks.minSize = 0.015;
    sparks.maxSize = 0.06;
    sparks.minLifeTime = 0.08;
    sparks.maxLifeTime = 0.35;
    sparks.emitRate = 250;
    sparks.manualEmitCount = 25;
    sparks.direction1 = new BABYLON.Vector3(-1.5, 0.8, -1.5);
    sparks.direction2 = new BABYLON.Vector3(1.5, 2.5, 1.5);
    sparks.minEmitPower = 2.5;
    sparks.maxEmitPower = 7;
    sparks.color1 = new BABYLON.Color4(1, 0.9, 0.35, 1);
    sparks.color2 = new BABYLON.Color4(1, 0.45, 0.12, 1);
    sparks.colorDead = new BABYLON.Color4(0.45, 0.1, 0, 0);
    sparks.gravity = new BABYLON.Vector3(0, -7, 0);
    sparks.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    sparks.start();

    setTimeout(() => {
      sparks.stop();
      setTimeout(() => sparks.dispose(), 400);
    }, 80);

    const blood = new BABYLON.ParticleSystem('blood', 20, this.scene);
    blood.emitter = position;
    blood.minSize = 0.025;
    blood.maxSize = 0.1;
    blood.minLifeTime = 0.15;
    blood.maxLifeTime = 0.5;
    blood.emitRate = 160;
    blood.manualEmitCount = 15;
    blood.direction1 = new BABYLON.Vector3(-1.2, 0.4, -1.2);
    blood.direction2 = new BABYLON.Vector3(1.2, 1.8, 1.2);
    blood.minEmitPower = 1.5;
    blood.maxEmitPower = 4;
    blood.color1 = new BABYLON.Color4(0.75, 0, 0, 1);
    blood.color2 = new BABYLON.Color4(0.45, 0, 0, 0.75);
    blood.colorDead = new BABYLON.Color4(0.25, 0, 0, 0);
    blood.gravity = new BABYLON.Vector3(0, -9, 0);
    blood.start();

    setTimeout(() => {
      blood.stop();
      setTimeout(() => blood.dispose(), 600);
    }, 120);

    const flash = BABYLON.MeshBuilder.CreateSphere('hitFlash', { diameter: 0.4 }, this.scene);
    flash.position = position.clone();
    const flashMat = new BABYLON.StandardMaterial('hitFlashMat', this.scene);
    flashMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0.35);
    flashMat.alpha = 0.75;
    flash.material = flashMat;

    let flashScale = 1;
    const animateFlash = () => {
      if (!this.scene || this.scene.isDisposed) {
        if (!flash.isDisposed()) flash.dispose();
        flashMat.dispose();
        return;
      }
      flashScale -= 0.18;
      flash.scaling = new BABYLON.Vector3(flashScale, flashScale, flashScale);
      flashMat.alpha = flashScale * 0.75;

      if (flashScale > 0.1) {
        requestAnimationFrame(animateFlash);
      } else {
        flash.dispose();
        flashMat.dispose();
      }
    };
    animateFlash();
  }

  createJumpPadEffect(position) {
    for (let i = 0; i < 10; i++) {
      const particle = BABYLON.MeshBuilder.CreateSphere('jumpParticle', { diameter: 0.1 }, this.scene);
      const mat = new BABYLON.StandardMaterial('jumpMat', this.scene);
      mat.emissiveColor = new BABYLON.Color3(0, 1, 1);
      mat.disableLighting = true;
      particle.material = mat;
      particle.position = position.clone();
      particle.position.y += 0.3;

      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      const vel = new BABYLON.Vector3(
        Math.cos(angle) * speed,
        3 + Math.random() * 2,
        Math.sin(angle) * speed
      );

      let life = 0;
      const animate = () => {
        if (!this.scene || this.scene.isDisposed) {
          if (!particle.isDisposed()) particle.dispose();
          mat.dispose();
          return;
        }
        life += 0.016;
        particle.position.addInPlace(vel.scale(0.016));
        vel.y -= 5 * 0.016;
        mat.alpha = 1 - life * 2;

        if (life < 0.5) {
          requestAnimationFrame(animate);
        } else {
          particle.dispose();
          mat.dispose();
        }
      };
      animate();
    }
  }

  showDamageEffect() {
    let damageOverlay = document.getElementById('damage-overlay');
    if (!damageOverlay) {
      damageOverlay = document.createElement('div');
      damageOverlay.id = 'damage-overlay';
      damageOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle, transparent 30%, rgba(255, 0, 0, 0.55) 100%);
        pointer-events: none;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.08s;
      `;
      document.body.appendChild(damageOverlay);
    }

    damageOverlay.style.opacity = '1';
    setTimeout(() => {
      damageOverlay.style.opacity = '0';
    }, 120);

    if (this.camera && this.scene && !this.scene.isDisposed) {
      const shakeIntensity = 0.12;
      let shakeTime = 0;

      const shake = () => {
        if (!this.scene || this.scene.isDisposed) return;
        shakeTime += 0.016;
        if (shakeTime < 0.15) {
          this.camera.rotation.x += (Math.random() - 0.5) * shakeIntensity;
          this.camera.rotation.y += (Math.random() - 0.5) * shakeIntensity * 0.5;
          requestAnimationFrame(shake);
        }
      };
      shake();
    }
  }

  showHealEffect() {
    let healOverlay = document.getElementById('heal-overlay');
    if (!healOverlay) {
      healOverlay = document.createElement('div');
      healOverlay.id = 'heal-overlay';
      healOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle, transparent 30%, rgba(0, 255, 100, 0.3) 100%);
        pointer-events: none;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.1s;
      `;
      document.body.appendChild(healOverlay);
    }

    healOverlay.style.opacity = '1';
    setTimeout(() => {
      healOverlay.style.opacity = '0';
    }, 200);
  }
}
