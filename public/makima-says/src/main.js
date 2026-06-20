import { mulberry32, reactionWindow, scoreFor, nextCommand, judge } from "./logic.js";
import { createAudio } from "./audio.js";

const GLYPH = { up: "⬆️", down: "⬇️", left: "⬅️", right: "➡️" };
const LABEL = { up: "위", down: "아래", left: "왼쪽", right: "오른쪽" };
const $ = (id) => document.getElementById(id);
const audio = createAudio();

let rng, round, score, combo, best = 0, lives, command, accepting, inputLocked, timer, raf, ringStart;

const state = { running: false };
window.__makima = {
  get command() { return command; },
  get combo() { return combo; },
  get lives() { return lives; },
  get score() { return score; },
  get best() { return best; },
  get round() { return round; },
  get running() { return state.running; },
  // test hook: resolve the current round with a given input direction.
  _forceInput(dir) { handleInput(dir); },
};

function setActivePanel(speaker) {
  $("m-panel").classList.toggle("active", speaker === "makima");
  $("r-panel").classList.toggle("active", speaker === "reze");
}

function renderHud() {
  $("score").textContent = score;
  $("combo-n").textContent = combo;
  $("combo").classList.toggle("hot", combo >= 3);
  $("best").textContent = best;
  $("lives").textContent = "💣".repeat(Math.max(0, lives)) || "—";
}

function start() {
  audio.resume();
  rng = mulberry32(((performance.now() | 0) ^ 0x9e3779b9) >>> 0);
  round = 0; score = 0; combo = 0; lives = 3;
  state.running = true;
  $("start").classList.add("off");
  $("result").classList.add("off");
  renderHud();
  nextRound();
}

function nextRound() {
  if (!state.running) return;
  command = nextCommand(round, rng);
  accepting = true; inputLocked = false;
  setActivePanel(command.speaker);
  $("glyph").textContent = GLYPH[command.dir];
  $("caption").textContent = `${command.speaker === "makima" ? "마키마" : "레제"}: ${LABEL[command.dir]}`;
  audio.playVoice(command.speaker, command.dir);

  const win = reactionWindow(round) * 1000;
  ringStart = performance.now();
  animateRing(win);
  timer = setTimeout(() => resolve(null), win);
}

function animateRing(win) {
  cancelAnimationFrame(raf);
  const tick = () => {
    const p = Math.min(1, (performance.now() - ringStart) / win);
    $("ring").style.borderTopColor = `hsl(${(1 - p) * 120}, 90%, 60%)`;
    $("ring").style.transform = `rotate(${p * 360}deg)`;
    if (accepting && p < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

function handleInput(dir) {
  if (!state.running || !accepting || inputLocked) return;
  inputLocked = true;
  clearTimeout(timer);
  resolve(dir);
}

function resolve(input) {
  if (!accepting) return;
  accepting = false;
  clearTimeout(timer);
  cancelAnimationFrame(raf);
  const verdict = judge(command, input);
  if (verdict === "hit") {
    combo += 1;
    score += scoreFor(combo);
    best = Math.max(best, combo);
    audio.ding();
    flashOk();
    renderHud();
    round += 1;
    setTimeout(nextRound, 420);
  } else {
    combo = 0;
    lives -= 1;
    audio.boom();
    if (command.speaker === "reze") audio.playVoice("reze", "laugh");
    else audio.playVoice("makima", "fail");
    flashBad();
    renderHud();
    if (lives <= 0) { setTimeout(gameOver, 700); return; }
    round += 1;
    setTimeout(nextRound, 800);
  }
}

function flashOk() {
  $("glyph").style.color = "#5dff8f";
  setTimeout(() => ($("glyph").style.color = "#fff"), 200);
}

function flashBad() {
  const f = $("flash");
  f.style.opacity = "1";
  setTimeout(() => (f.style.opacity = "0"), 160);
  $("stage").classList.add("shake");
  setTimeout(() => $("stage").classList.remove("shake"), 300);
}

function gameOver() {
  state.running = false;
  setActivePanel(null);
  $("glyph").textContent = "";
  $("caption").textContent = "";
  $("result-title").textContent = "💥 게임 오버";
  $("result-sub").textContent = `점수 ${score} · 최고 콤보 ${best} · ${round}라운드 버팀`;
  $("result").classList.remove("off");
}

// ---- input bindings ----
const KEYMAP = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
window.addEventListener("keydown", (e) => {
  if (KEYMAP[e.key]) { e.preventDefault(); handleInput(KEYMAP[e.key]); }
});
$("pad").querySelectorAll("button").forEach((b) =>
  b.addEventListener("click", () => handleInput(b.dataset.dir)));
$("startbtn").addEventListener("click", start);
$("replaybtn").addEventListener("click", start);
$("mute").addEventListener("click", () => {
  audio.setMuted(!audio.isMuted());
  const btn = $("mute");
  btn.textContent = audio.isMuted() ? "🔇" : "🔊";
  btn.setAttribute("aria-pressed", String(audio.isMuted()));
});
$("mute").textContent = audio.isMuted() ? "🔇" : "🔊";
