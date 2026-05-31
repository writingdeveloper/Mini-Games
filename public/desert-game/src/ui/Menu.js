export class Menu {
  constructor(game, car, sky) {
    this.game = game;
    this.car = car;
    this.sky = sky;
    this.pause = document.getElementById('pause');
    this.paused = false;
    document.getElementById('resume-btn').addEventListener('click', () => this.toggle(false));
    document.getElementById('restart-btn').addEventListener('click', () => {
      this.car.resetTo(0, 0);
      this.sky.t = 0.18;
      this.toggle(false);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.game.started) this.toggle(!this.paused);
    });
  }

  toggle(on) {
    this.paused = on;
    this.pause.classList.toggle('hidden', !on);
    if (on) this.game.stop();
    else this.game.start();
  }
}
