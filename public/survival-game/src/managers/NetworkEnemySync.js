// NetworkEnemySync - Syncs enemy states from server to client rendering

export class NetworkEnemySync {
  constructor(game) {
    this.game = game;
    this.serverEnemies = new Map(); // enemyId -> { mesh, state, targetState, t }
  }

  get scene() {
    return this.game.scene;
  }

  /**
   * Update enemy states from server data
   * In multiplayer, enemies are spawned/managed by server; client only renders
   */
  updateFromServer(enemiesData) {
    if (!Array.isArray(enemiesData)) return;

    const activeIds = new Set();

    for (const serverEnemy of enemiesData) {
      activeIds.add(serverEnemy.id);

      let entry = this.serverEnemies.get(serverEnemy.id);
      if (!entry) {
        // Create new enemy mesh
        const mesh = this.game.enemySystem.createEnemyCharacter(
          new BABYLON.Vector3(
            serverEnemy.position.x,
            serverEnemy.position.y,
            serverEnemy.position.z,
          ),
        );
        entry = {
          mesh: mesh.parent,
          aggregate: mesh.aggregate,
          targetState: serverEnemy,
          currentState: serverEnemy,
          t: 0,
        };
        this.serverEnemies.set(serverEnemy.id, entry);
      }

      // Update interpolation
      entry.currentState = entry.targetState || serverEnemy;
      entry.targetState = serverEnemy;
      entry.t = 0;
    }

    // Remove enemies that are no longer on server
    for (const [id, entry] of this.serverEnemies) {
      if (!activeIds.has(id)) {
        if (entry.aggregate) entry.aggregate.dispose();
        if (entry.mesh) {
          entry.mesh.getChildMeshes().forEach(m => {
            if (m.material) m.material.dispose();
            m.dispose();
          });
          entry.mesh.dispose();
        }
        this.serverEnemies.delete(id);
      }
    }
  }

  /**
   * Interpolate enemy positions each frame
   */
  interpolate(deltaTime) {
    for (const entry of this.serverEnemies.values()) {
      if (!entry.mesh || !entry.targetState) continue;

      entry.t = Math.min(1, entry.t + deltaTime * 10);
      const t = entry.t;

      const current = entry.currentState;
      const target = entry.targetState;

      if (current.position && target.position) {
        const x = current.position.x + (target.position.x - current.position.x) * t;
        const y = current.position.y + (target.position.y - current.position.y) * t;
        const z = current.position.z + (target.position.z - current.position.z) * t;
        entry.mesh.position.set(x, y, z);
      }

      if (typeof target.rotation === 'number') {
        entry.mesh.rotation.y = target.rotation;
      }

      // Animation based on state
      const time = Date.now() * (target.state === 'chase' ? 0.01 : 0.005);
      const armSwing = target.state === 'chase' ? 0.4 : 0.2;

      const leftArm = entry.mesh.getChildMeshes().find(m => m.name === 'leftArm');
      const rightArm = entry.mesh.getChildMeshes().find(m => m.name === 'rightArm');
      if (leftArm) leftArm.rotation.x = Math.PI / 2 + Math.sin(time) * armSwing;
      if (rightArm) rightArm.rotation.x = Math.PI / 2 + Math.cos(time) * armSwing;
    }
  }

  destroy() {
    for (const entry of this.serverEnemies.values()) {
      if (entry.aggregate) entry.aggregate.dispose();
      if (entry.mesh) entry.mesh.dispose();
    }
    this.serverEnemies.clear();
  }
}
