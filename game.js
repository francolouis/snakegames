const canvas = document.querySelector('#game');
const context = canvas.getContext('2d');
const scoreElement = document.querySelector('#score');
const bestElement = document.querySelector('#best');
const statusElement = document.querySelector('#status');
const startPrompt = document.querySelector('#startPrompt');
const pauseButton = document.querySelector('#pauseButton');
const soundButton = document.querySelector('#soundButton');

const gridSize = 20;
const stepTime = 115;
const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};
const keyDirections = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
let snake;
let apple;
let direction;
let queuedDirection;
let score;
let best = Number(localStorage.getItem('snake-best') || 0);
let running = false;
let gameOver = false;
let timer;
let resetTimer;
let audioContext;
let muted = false;
let paused = false;
let inputLocked = false;
let directionName = 'right';
let queuedDirectionName = 'right';

bestElement.textContent = formatScore(best);

function formatScore(value) { return String(value).padStart(2, '0'); }

function playTone(frequency, duration, type = 'square', volume = 0.035) {
  if (muted) return;
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function resetGame() {
  window.clearTimeout(resetTimer);
  snake = [{ x: 10, y: 12 }, { x: 9, y: 12 }, { x: 8, y: 12 }];
  direction = directions.right;
  queuedDirection = direction;
  directionName = 'right';
  queuedDirectionName = 'right';
  score = 0;
  apple = placeApple();
  running = false;
  gameOver = false;
  paused = false;
  inputLocked = false;
  scoreElement.textContent = formatScore(score);
  statusElement.textContent = 'READY';
  pauseButton.textContent = 'PAUSE';
  pauseButton.disabled = false;
  startPrompt.innerHTML = '<span class="prompt-icon">↑</span><span>PRESS AN ARROW<br>TO BEGIN</span>';
  startPrompt.classList.remove('hidden');
  draw();
}

function placeApple() {
  const openCells = [];
  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      if (!snake.some(segment => segment.x === x && segment.y === y)) openCells.push({ x, y });
    }
  }
  return openCells[Math.floor(Math.random() * openCells.length)];
}

function setDirection(name) {
  const next = directions[name];
  if (!next) return;
  if (gameOver || paused || inputLocked) return;
  if (queuedDirection && next.x + queuedDirection.x === 0 && next.y + queuedDirection.y === 0) return;
  if (queuedDirectionName !== name) playTone(220 + Object.keys(directions).indexOf(name) * 55, 0.055);
  queuedDirection = next;
  queuedDirectionName = name;
  inputLocked = true;
  if (!running) {
    running = true;
    gameOver = false;
    statusElement.textContent = 'IN MOTION';
    startPrompt.classList.add('hidden');
    timer = setInterval(tick, stepTime);
  }
}

function tick() {
  direction = queuedDirection;
  directionName = queuedDirectionName;
  inputLocked = false;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
  const hitWall = head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
  const hitBody = snake.some(segment => segment.x === head.x && segment.y === head.y);
  if (hitWall || hitBody) {
    playTone(90, 0.28, 'sawtooth', 0.05);
    endGame();
    return;
  }
  snake.unshift(head);
  if (head.x === apple.x && head.y === apple.y) {
    playTone(660, 0.08, 'square', 0.045);
    window.setTimeout(() => playTone(880, 0.09, 'square', 0.035), 45);
    score += 1;
    best = Math.max(best, score);
    localStorage.setItem('snake-best', best);
    scoreElement.textContent = formatScore(score);
    bestElement.textContent = formatScore(best);
    apple = placeApple();
  } else {
    snake.pop();
  }
  draw();
}

function endGame() {
  clearInterval(timer);
  running = false;
  gameOver = true;
  paused = false;
  pauseButton.disabled = true;
  statusElement.textContent = 'FIELD RESET';
  startPrompt.innerHTML = '<span class="prompt-icon">↻</span><span>RESETTING<br>THE FIELD</span>';
  startPrompt.classList.remove('hidden');
  draw(true);
  resetTimer = window.setTimeout(resetGame, 700);
}

function togglePause() {
  if (gameOver || (!running && !paused)) return;
  if (paused) {
    paused = false;
    running = true;
    statusElement.textContent = 'IN MOTION';
    pauseButton.textContent = 'PAUSE';
    timer = window.setInterval(tick, stepTime);
  } else {
    paused = true;
    running = false;
    clearInterval(timer);
    statusElement.textContent = 'PAUSED';
    pauseButton.textContent = 'RESUME';
  }
}

function toggleSound() {
  muted = !muted;
  soundButton.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  soundButton.setAttribute('aria-pressed', String(muted));
}

function draw(crashed = false) {
  const cell = canvas.width / gridSize;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#14231e';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = 'rgba(201, 240, 107, .075)';
  context.lineWidth = 1;
  for (let index = 1; index < gridSize; index += 1) {
    context.beginPath(); context.moveTo(index * cell, 0); context.lineTo(index * cell, canvas.height); context.stroke();
    context.beginPath(); context.moveTo(0, index * cell); context.lineTo(canvas.width, index * cell); context.stroke();
  }
  context.fillStyle = '#ff765d';
  context.beginPath();
  context.arc((apple.x + .5) * cell, (apple.y + .5) * cell, cell * .28, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#c9f06b';
  snake.forEach((segment, index) => {
    const inset = index === 0 ? cell * .13 : cell * .18;
    context.globalAlpha = crashed ? .48 : 1;
    context.fillRect(segment.x * cell + inset, segment.y * cell + inset, cell - inset * 2, cell - inset * 2);
  });
  context.globalAlpha = 1;
  context.fillStyle = '#08110f';
  const head = snake[0];
  const eyeSize = cell * .07;
  const eyeOffset = cell * .29;
  const eyes = direction === directions.left || direction === directions.right ? [[head.x * cell + cell / 2, head.y * cell + cell / 2 - eyeOffset], [head.x * cell + cell / 2, head.y * cell + cell / 2 + eyeOffset]] : [[head.x * cell + cell / 2 - eyeOffset, head.y * cell + cell / 2], [head.x * cell + cell / 2 + eyeOffset, head.y * cell + cell / 2]];
  eyes.forEach(([x, y]) => context.fillRect(x - eyeSize / 2, y - eyeSize / 2, eyeSize, eyeSize));
}

document.addEventListener('keydown', event => {
  if (event.code === 'Space' && gameOver) { event.preventDefault(); resetGame(); return; }
  if (event.key.toLowerCase() === 'p') { event.preventDefault(); togglePause(); return; }
  const name = keyDirections[event.key];
  if (name) { event.preventDefault(); setDirection(name); }
});
document.querySelectorAll('.control').forEach(button => button.addEventListener('click', () => setDirection(button.dataset.direction)));
pauseButton.addEventListener('click', togglePause);
soundButton.addEventListener('click', toggleSound);
resetGame();
