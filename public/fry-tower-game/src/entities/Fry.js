// Pairs a cannon body with a three group; sync() copies the transform.
export class Fry {
  constructor(body, mesh) {
    this.body = body;
    this.mesh = mesh;
  }
  sync() {
    const p = this.body.position, q = this.body.quaternion;
    this.mesh.position.set(p.x, p.y, p.z);
    this.mesh.quaternion.set(q.x, q.y, q.z, q.w);
  }
}
