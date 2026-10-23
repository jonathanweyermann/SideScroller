(() => {
  'use strict';

  const canvas = document.querySelector('#game-canvas');
  const ctx = canvas.getContext('2d');
  const stage = document.querySelector('#stage');
  const overlay = document.querySelector('#overlay');
  const title = document.querySelector('#overlay-title');
  const eyebrow = document.querySelector('#overlay-eyebrow');
  const description = document.querySelector('#overlay-description');
  const startButton = document.querySelector('#start-button');
  const scoreDisplay = document.querySelector('#score');
  const bestDisplay = document.querySelector('#best-score');
  const colors = { ink: '#1e2523', accent: '#ef7144', line: '#d9ddd3', pale: '#e9eadf' };
  const config = { gravity: 2100, jumpVelocity: -750, moveSpeed: 320, startX: 105, playerWidth: 24, playerHeight: 58 };

  let width = 0;
  let height = 0;
  let groundY = 0;
  let state = 'ready';
  let lastFrame = 0;
  let cameraX = 0;
  let maxProgress = 0;
  let nextObstacleX = 520;
  let obstacles = [];
  let particles = [];
  let clouds = [];
  let player = { x: config.startX, y: 0, velocity: 0, grounded: true, runTime: 0 };
  const input = { left: false, right: false };
  let best = loadBest();

  function loadBest() {
    try { return Number(localStorage.getItem('stickman-sprint-best')) || 0; }
    catch { return 0; }
  }
  function saveBest() {
    try { localStorage.setItem('stickman-sprint-best', String(best)); }
    catch { /* Storage is optional. */ }
  }
  function formatScore(value) { return String(Math.floor(value)).padStart(5, '0'); }

  function resize() {
    const rect = stage.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    groundY = height - 79;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    clouds = [{ x: 180, y: 65, scale: .85 }, { x: 600, y: 103, scale: 1.1 }, { x: 1030, y: 55, scale: .7 }];
    draw();
  }

  function reset() {
    cameraX = 0;
    maxProgress = 0;
    nextObstacleX = Math.max(520, width + 100);
    obstacles = [];
    particles = [];
    player = { x: config.startX, y: 0, velocity: 0, grounded: true, runTime: 0 };
    scoreDisplay.textContent = formatScore(0);
  }
  function showOverlay(mode) {
    overlay.classList.remove('is-hidden');
    if (mode === 'over') {
      eyebrow.textContent = 'END OF THE ROAD';
      title.innerHTML = 'Nice run.<br><em>Go again?</em>';
      description.textContent = `You made it ${formatScore(maxProgress / 10)} points. Give it another shot.`;
      startButton.innerHTML = 'RESTART RUN <span aria-hidden="true">↗</span>';
    } else if (mode === 'paused') {
      eyebrow.textContent = 'TAKE A BREATHER';
      title.innerHTML = 'On pause.<br><em>Ready?</em>';
      description.textContent = 'Your run is waiting for you.';
      startButton.innerHTML = 'RESUME RUN <span aria-hidden="true">↗</span>';
    }
  }
  function start() {
    if (state !== 'paused') { reset(); input.left = false; input.right = false; }
    state = 'running';
    overlay.classList.add('is-hidden');
    lastFrame = performance.now();
  }
  function jump() {
    if (state === 'ready' || state === 'over') start();
    if (state !== 'running' || !player.grounded) return;
    player.velocity = config.jumpVelocity;
    player.grounded = false;
    for (let i = 0; i < 5; i++) particles.push({ x: player.x + 12, y: groundY, vx: -30 - Math.random() * 90, vy: -30 - Math.random() * 60, life: .35 });
  }
  function pause() {
    if (state === 'running') { state = 'paused'; showOverlay('paused'); }
    else if (state === 'paused') start();
  }

  function spawnObstacle() {
    const tall = Math.random() < .45;
    obstacles.push({ x: nextObstacleX, width: tall ? 27 : 40, height: tall ? 54 : 32, type: tall ? 'pillar' : 'crate' });
    nextObstacleX += 370 + Math.random() * 140;
  }
  function collision(obstacle) {
    const px = player.x + 4;
    const py = groundY - config.playerHeight + player.y + 7;
    const pw = config.playerWidth - 8;
    const ph = config.playerHeight - 10;
    return px < obstacle.x + obstacle.width - 3 && px + pw > obstacle.x + 3 && py < groundY - 4 && py + ph > groundY - obstacle.height + 5;
  }
  function endRun() {
    state = 'over';
    input.left = false;
    input.right = false;
    const score = Math.floor(maxProgress / 10);
    if (score > best) { best = score; bestDisplay.textContent = formatScore(best); saveBest(); }
    showOverlay('over');
  }
  function update(dt) {
    if (state !== 'running') return;
    const direction = Number(input.right) - Number(input.left);
    player.x = Math.max(0, player.x + direction * config.moveSpeed * dt);
    if (direction) player.runTime += dt;
    maxProgress = Math.max(maxProgress, player.x - config.startX);
    cameraX = Math.max(0, player.x - Math.min(width * .33, 180));
    while (nextObstacleX < cameraX + width + 240) spawnObstacle();
    if (!player.grounded) {
      player.velocity += config.gravity * dt;
      player.y += player.velocity * dt;
      if (player.y >= 0) { player.y = 0; player.velocity = 0; player.grounded = true; }
    }
    for (const obstacle of obstacles) {
      if (collision(obstacle)) { endRun(); break; }
    }
    for (const particle of particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt; }
    particles = particles.filter(particle => particle.life > 0);
    scoreDisplay.textContent = formatScore(maxProgress / 10);
  }

  function line(x1, y1, x2, y2, stroke = colors.ink, thickness = 4) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function drawCloud(x, y, scale) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.strokeStyle = colors.line; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(-29, 12); ctx.bezierCurveTo(-38, 12, -38, -1, -26, -3);
    ctx.bezierCurveTo(-21, -20, 1, -23, 10, -8);
    ctx.bezierCurveTo(25, -13, 34, -2, 30, 9);
    ctx.lineTo(19, 12); ctx.stroke(); ctx.restore();
  }
  function drawGround() {
    line(0, groundY + 2, width, groundY + 2, colors.ink, 2);
    ctx.fillStyle = colors.line;
    const offset = cameraX % 46;
    for (let x = -offset; x < width; x += 46) ctx.fillRect(x, groundY + 19, 18, 2);
    for (let x = 20 - (cameraX % 130); x < width; x += 130) ctx.fillRect(x, groundY + 46, 6, 2);
  }
  function drawObstacle(obstacle) {
    const x = obstacle.x - cameraX, y = groundY - obstacle.height;
    ctx.fillStyle = colors.accent; ctx.fillRect(x, y, obstacle.width, obstacle.height);
    ctx.strokeStyle = colors.ink; ctx.lineWidth = 2; ctx.strokeRect(x, y, obstacle.width, obstacle.height);
    if (obstacle.type === 'crate') {
      line(x + 7, y + 7, x + obstacle.width - 7, y + obstacle.height - 7, colors.ink, 1.5);
      line(x + obstacle.width - 7, y + 7, x + 7, y + obstacle.height - 7, colors.ink, 1.5);
    } else {
      line(x + 7, y + 12, x + obstacle.width - 7, y + 12, colors.ink, 1.5);
      line(x + 7, y + 20, x + obstacle.width - 7, y + 20, colors.ink, 1.5);
    }
  }
  function drawPlayer() {
    const x = player.x - cameraX + 12, footY = groundY + player.y;
    const moving = input.left !== input.right;
    const swing = player.grounded && state === 'running' && moving ? Math.sin(player.runTime * 17) * 10 : 0;
    ctx.fillStyle = colors.ink; ctx.beginPath(); ctx.arc(x, footY - 49, 8, 0, Math.PI * 2); ctx.fill();
    line(x, footY - 40, x, footY - 19);
    line(x, footY - 34, x - 11 + swing * .5, footY - 23, colors.ink, 3.5);
    line(x, footY - 34, x + 11 - swing * .5, footY - 23, colors.ink, 3.5);
    line(x, footY - 19, x - 10 + swing, footY - 2);
    line(x, footY - 19, x + 10 - swing, footY - 2);
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fbfaf5'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = colors.pale; ctx.beginPath(); ctx.arc(width * .78 - cameraX * .08, height * .3, 44, 0, Math.PI * 2); ctx.fill();
    for (const cloud of clouds) {
      const cloudX = ((cloud.x - cameraX * .12) % (width + 130) + width + 130) % (width + 130) - 50;
      drawCloud(cloudX, cloud.y, cloud.scale);
    }
    drawGround();
    for (const obstacle of obstacles) if (obstacle.x + obstacle.width >= cameraX && obstacle.x <= cameraX + width) drawObstacle(obstacle);
    ctx.fillStyle = colors.line;
    for (const particle of particles) ctx.fillRect(particle.x - cameraX, particle.y, 4, 4);
    drawPlayer();
  }
  function frame(timestamp) {
    const dt = Math.min((timestamp - (lastFrame || timestamp)) / 1000, .032);
    lastFrame = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  document.addEventListener('keydown', event => {
    const direction = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' }[event.code];
    if (direction) {
      event.preventDefault();
      if (state === 'ready') start();
      if (state === 'running') input[direction] = true;
    } else if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
      event.preventDefault();
      if (!event.repeat) jump();
    } else if (event.code === 'KeyP') {
      event.preventDefault();
      if (!event.repeat) pause();
    } else if (event.code === 'KeyR' && state !== 'running') start();
  });
  document.addEventListener('keyup', event => {
    if (['ArrowLeft', 'KeyA'].includes(event.code)) input.left = false;
    if (['ArrowRight', 'KeyD'].includes(event.code)) input.right = false;
  });
  stage.addEventListener('pointerdown', event => { if (!event.target.closest('button')) jump(); });
  for (const [id, direction] of [['#left-button', 'left'], ['#right-button', 'right']]) {
    const button = document.querySelector(id);
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (state === 'ready') start();
      if (state === 'running') input[direction] = true;
      button.setPointerCapture(event.pointerId);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(type, () => { input[direction] = false; });
    }
  }
  document.querySelector('#jump-button').addEventListener('click', jump);
  startButton.addEventListener('click', start);
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'running') pause(); });
  window.addEventListener('blur', () => { input.left = false; input.right = false; if (state === 'running') pause(); });
  new ResizeObserver(resize).observe(stage);
  bestDisplay.textContent = formatScore(best);
  requestAnimationFrame(frame);
})();
