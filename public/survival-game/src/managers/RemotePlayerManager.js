// RemotePlayerManager - Renders and interpolates remote player meshes

export class RemotePlayerManager {
  constructor(game) {
    this.game = game;
    this.remotePlayers = new Map(); // playerId -> { mesh, nameTag, targetState, currentState, t }
  }

  get scene() {
    return this.game.scene;
  }

  updateFromServer(playersData) {
    const activeIds = new Set();

    for (const [id, state] of Object.entries(playersData)) {
      // Skip local player
      if (id === this.game.networkPlayerId) continue;
      activeIds.add(id);

      let entry = this.remotePlayers.get(id);
      if (!entry) {
        entry = this.createRemotePlayer(id, state);
        this.remotePlayers.set(id, entry);
      }

      // Update interpolation targets
      entry.currentState = entry.targetState || state;
      entry.targetState = state;
      entry.t = 0;

      // Handle death
      if (!state.alive && entry.mesh) {
        entry.mesh.setEnabled(false);
        if (entry.nameTag) entry.nameTag.setEnabled(false);
      }
    }

    // Remove disconnected players
    for (const [id, entry] of this.remotePlayers) {
      if (!activeIds.has(id)) {
        this.removeRemotePlayer(entry);
        this.remotePlayers.delete(id);
      }
    }
  }

  createRemotePlayer(id, state) {
    // Create a simple character mesh (similar to enemy but with player colors)
    const parent = BABYLON.MeshBuilder.CreateBox('remotePlayer_' + id, { size: 0.01 }, this.scene);
    parent.position = new BABYLON.Vector3(state.position.x, state.position.y, state.position.z);

    const bodyMat = new BABYLON.PBRMaterial('rpBodyMat_' + id, this.scene);
    bodyMat.albedoColor = new BABYLON.Color3(0.2, 0.5, 0.8); // Blue tint for remote players
    bodyMat.roughness = 0.6;

    // Body
    const body = BABYLON.MeshBuilder.CreateCylinder('rpBody', {
      height: 1.2, diameterTop: 0.5, diameterBottom: 0.4
    }, this.scene);
    body.position.y = 0.6;
    body.parent = parent;
    body.material = bodyMat;

    // Head
    const head = BABYLON.MeshBuilder.CreateSphere('rpHead', { diameter: 0.4 }, this.scene);
    head.position.y = 1.45;
    head.parent = parent;
    head.material = bodyMat;

    // Arms
    const leftArm = BABYLON.MeshBuilder.CreateCylinder('rpLArm', { height: 0.7, diameter: 0.12 }, this.scene);
    leftArm.rotation.x = Math.PI / 2;
    leftArm.position = new BABYLON.Vector3(-0.35, 0.9, 0.35);
    leftArm.parent = parent;
    leftArm.material = bodyMat;

    const rightArm = BABYLON.MeshBuilder.CreateCylinder('rpRArm', { height: 0.7, diameter: 0.12 }, this.scene);
    rightArm.rotation.x = Math.PI / 2;
    rightArm.position = new BABYLON.Vector3(0.35, 0.9, 0.35);
    rightArm.parent = parent;
    rightArm.material = bodyMat;

    // Legs
    const leftLeg = BABYLON.MeshBuilder.CreateCylinder('rpLLeg', { height: 0.6, diameter: 0.18 }, this.scene);
    leftLeg.position = new BABYLON.Vector3(-0.15, 0.15, 0);
    leftLeg.parent = parent;
    leftLeg.material = bodyMat;

    const rightLeg = BABYLON.MeshBuilder.CreateCylinder('rpRLeg', { height: 0.6, diameter: 0.18 }, this.scene);
    rightLeg.position = new BABYLON.Vector3(0.15, 0.15, 0);
    rightLeg.parent = parent;
    rightLeg.material = bodyMat;

    // Shadow
    parent.getChildMeshes().forEach(mesh => {
      if (this.game.shadowGenerator) {
        this.game.shadowGenerator.addShadowCaster(mesh);
      }
    });

    // Name tag
    const nameTag = BABYLON.MeshBuilder.CreatePlane('rpName_' + id, { width: 2, height: 0.3 }, this.scene);
    nameTag.position.y = 2.2;
    nameTag.parent = parent;
    nameTag.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    const nameMat = new BABYLON.StandardMaterial('rpNameMat_' + id, this.scene);
    const nameTexture = new BABYLON.DynamicTexture('rpNameTex_' + id, { width: 256, height: 40 }, this.scene);
    const ctx = nameTexture.getContext();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, 256, 40);
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(id.substring(0, 8), 128, 28);
    nameTexture.update();
    nameMat.diffuseTexture = nameTexture;
    nameMat.emissiveTexture = nameTexture;
    nameMat.useAlphaFromDiffuseTexture = true;
    nameMat.backFaceCulling = false;
    nameTag.material = nameMat;

    return {
      mesh: parent,
      bodyMat,
      nameTag,
      nameMat,
      targetState: state,
      currentState: state,
      t: 0,
    };
  }

  removeRemotePlayer(entry) {
    if (entry.mesh) {
      entry.mesh.getChildMeshes().forEach(m => {
        if (m.material) m.material.dispose();
        m.dispose();
      });
      entry.mesh.dispose();
    }
    if (entry.bodyMat) entry.bodyMat.dispose();
    if (entry.nameTag) {
      if (entry.nameMat) entry.nameMat.dispose();
      entry.nameTag.dispose();
    }
  }

  interpolate(deltaTime) {
    for (const entry of this.remotePlayers.values()) {
      if (!entry.currentState || !entry.targetState || !entry.mesh) continue;

      entry.t = Math.min(1, entry.t + deltaTime * 10);
      const t = entry.t;

      const current = entry.currentState;
      const target = entry.targetState;

      // Position interpolation
      const cx = current.position.x + (target.position.x - current.position.x) * t;
      const cy = current.position.y + (target.position.y - current.position.y) * t;
      const cz = current.position.z + (target.position.z - current.position.z) * t;
      entry.mesh.position.set(cx, cy, cz);

      // Rotation interpolation
      if (target.rotation) {
        entry.mesh.rotation.y = target.rotation.y || 0;
      }

      // Simple walk animation
      if (target.animation === 'walk' || target.animation === 'run') {
        const speed = target.animation === 'run' ? 0.01 : 0.005;
        const time = Date.now() * speed;
        const swing = target.animation === 'run' ? 0.4 : 0.2;

        const leftArm = entry.mesh.getChildMeshes().find(m => m.name === 'rpLArm');
        const rightArm = entry.mesh.getChildMeshes().find(m => m.name === 'rpRArm');
        if (leftArm) leftArm.rotation.x = Math.PI / 2 + Math.sin(time) * swing;
        if (rightArm) rightArm.rotation.x = Math.PI / 2 + Math.cos(time) * swing;
      }
    }
  }

  destroy() {
    for (const entry of this.remotePlayers.values()) {
      this.removeRemotePlayer(entry);
    }
    this.remotePlayers.clear();
  }
}
