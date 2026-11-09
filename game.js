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
  const livesDisplay = document.querySelector('#lives');
  const countdownDisplay = document.querySelector('#countdown');
  const colors = { ink: '#1e2523', accent: '#ef7144', line: '#d9ddd3', pale: '#e9eadf' };
  const config = { gravity: 2100, jumpVelocity: -750, moveSpeed: 320, startX: 105, playerWidth: 24, playerHeight: 58 };

  let width = 0;
  let height = 0;
  let groundY = 0;
  let state = 'ready';
  let speedMultiplier = .85;
  let selectedLevel = 'medium';
  let runLevel = 'medium';
  let lives = 3;
  let countdown = 0;
  let invulnerable = 0;
  let lastFrame = 0;
  let cameraX = 0;
  let maxProgress = 0;
  let enemyBonus = 0;
  let coinBonus = 0;
  let coins = [];
  let nextCoinX = 350;
  let nextObstacleX = 520;
  let obstacles = [];
  let ledges = [];
  let nextLedgeX = 360;
  let enemies = [];
  let particles = [];
  let clouds = [];
  let player = { x: config.startX, y: 0, velocity: 0, grounded: true, airJumpUsed: false, runTime: 0 };
  const input = { left: false, right: false };
  const bestScores = { easy: loadBest('easy'), medium: loadBest('medium'), hard: loadBest('hard') };
  // Apply this requested score once so future Hard records can still increase.
  try {
    if (localStorage.getItem('rainbow-run-hard-5250-applied') !== 'true') {
      bestScores.hard = 5250;
      localStorage.setItem('stickman-sprint-best-hard', '5250');
      localStorage.setItem('rainbow-run-hard-5250-applied', 'true');
    }
  } catch { bestScores.hard = Math.max(bestScores.hard, 5250); }

  function loadBest(level) {
    try {
      const value = Number(localStorage.getItem(`stickman-sprint-best-${level}`));
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    }
    catch { return 0; }
  }
  function saveBest(level) {
    try { localStorage.setItem(`stickman-sprint-best-${level}`, String(bestScores[level])); }
    catch { /* Storage is optional. */ }
  }
  function showBest() {
    bestDisplay.textContent = formatScore(bestScores[selectedLevel]);
    bestDisplay.setAttribute('aria-label', `${selectedLevel} best score: ${bestScores[selectedLevel]}`);
  }
  function formatScore(value) { return String(Math.floor(value)).padStart(5, '0'); }
  function currentScore() { return Math.floor(maxProgress / 10) + enemyBonus + coinBonus; }
  function showLives() {
    livesDisplay.innerHTML = `<span aria-hidden="true">${'♥ '.repeat(lives).trim()}</span>`;
    livesDisplay.setAttribute('aria-label', `${lives} ${lives === 1 ? 'life' : 'lives'} remaining`);
  }
  function showCountdown() {
    countdownDisplay.innerHTML = `Get ready!<strong>${Math.ceil(countdown)}</strong>`;
  }
  function beginCountdown() {
    state = 'countdown';
    countdown = 3;
    countdownDisplay.hidden = false;
    showCountdown();
  }
  function loseLife() {
    if (state !== 'running' || invulnerable > 0) return;
    lives--;
    showLives();
    input.left = false;
    input.right = false;
    if (lives === 0) { endRun(); return; }
    beginCountdown();
  }

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
    runLevel = selectedLevel;
    lives = 3;
    countdown = 0;
    invulnerable = 0;
    countdownDisplay.hidden = true;
    showLives();
    cameraX = 0;
    maxProgress = 0;
    enemyBonus = 0;
    coinBonus = 0;
    coins = [];
    nextCoinX = 350;
    nextObstacleX = Math.max(520, width + 100);
    obstacles = [];
    ledges = [];
    nextLedgeX = 360;
    enemies = [];
    particles = [];
    player = { x: config.startX, y: 0, velocity: 0, grounded: true, airJumpUsed: false, runTime: 0 };
    scoreDisplay.textContent = formatScore(0);
  }
  function showOverlay(mode) {
    overlay.classList.remove('is-hidden');
    if (mode === 'over') {
      eyebrow.textContent = 'END OF THE ROAD';
      title.innerHTML = 'Nice run.<br><em>Go again?</em>';
      description.textContent = `You made it ${formatScore(currentScore())} points. Give it another shot.`;
      startButton.innerHTML = 'RESTART RUN <span aria-hidden="true">↗</span>';
    } else if (mode === 'paused') {
      eyebrow.textContent = 'TAKE A BREATHER';
      title.innerHTML = 'On pause.<br><em>Ready?</em>';
      description.textContent = 'Your run is waiting for you.';
      startButton.innerHTML = 'RESUME RUN <span aria-hidden="true">↗</span>';
    }
  }
  function start() {
    if (state === 'countdown') return;
    if (state !== 'paused') {
      reset(); input.left = false; input.right = false;
      beginCountdown();
    } else {
      state = 'running';
    }
    overlay.classList.add('is-hidden');
    setLevelButtonsLocked(true);
    lastFrame = performance.now();
  }
  function jump() {
    if (state === 'ready') start();
    if (state !== 'running' || (!player.grounded && player.airJumpUsed)) return;
    if (player.grounded) {
      player.velocity = config.jumpVelocity;
    } else {
      // Preserve upward momentum so a quick second press still adds height.
      const upwardSpeed = Math.min(0, player.velocity);
      player.velocity = -Math.hypot(upwardSpeed, 450);
      player.airJumpUsed = true;
    }
    player.grounded = false;
    for (let i = 0; i < 5; i++) particles.push({ x: player.x + 12, y: groundY + player.y, vx: -30 - Math.random() * 90, vy: -30 - Math.random() * 60, life: .35 });
  }
  function pause() {
    if (state === 'running') { state = 'paused'; showOverlay('paused'); }
    else if (state === 'paused') start();
  }

  function spawnObstacle() {
    const previous = obstacles[obstacles.length - 1];
    const patrolLeft = previous ? previous.x + previous.width + 55 : 290;
    const patrolRight = Math.min(patrolLeft + 160, nextObstacleX - 70);
    if (patrolRight > patrolLeft) {
      enemies.push({ x: patrolLeft, width: 30, height: 42, left: patrolLeft, right: patrolRight, direction: 1, speed: 65 + Math.random() * 25, walkTime: 0 });
    }
    const tall = Math.random() < .45;
    obstacles.push({ x: nextObstacleX, width: tall ? 27 : 40, height: tall ? 54 : 32, type: tall ? 'pillar' : 'crate' });
    nextObstacleX += 370 + Math.random() * 140;
  }
  function collision(obstacle) {
    // A monster on a ledge cannot hurt a player approaching from underneath.
    // Only enable its damage once the player's feet reach the ledge surface.
    if (obstacle.baseHeight > 0 && player.y > -obstacle.baseHeight) return false;
    const px = player.x + 4;
    // Ledge monsters only hurt the body; brushing them with the head is safe.
    const hitboxHeight = obstacle.baseHeight > 0 ? 40 : config.playerHeight - 7;
    const py = groundY + player.y - hitboxHeight;
    const pw = config.playerWidth - 8;
    const ph = hitboxHeight - 3;
    const baseY = groundY - (obstacle.baseHeight || 0);
    return px < obstacle.x + obstacle.width - 3 && px + pw > obstacle.x + 3 && py < baseY - 4 && py + ph > baseY - obstacle.height + 5;
  }
  function spawnLedge(ledge, monsterChance) {
    ledges.push(ledge);
    if (Math.random() < monsterChance) {
      const left = ledge.x + 10;
      const right = ledge.x + ledge.width - 30;
      enemies.push({ x: left, width: 20, height: 28, baseHeight: ledge.height, left, right, direction: 1, speed: (65 + Math.random() * 25) * .75, walkTime: 0 });
    }
    if (Math.random() < .5) {
      coins.push({ x: ledge.x + ledge.width / 2, y: -ledge.height - 34 });
    }
  }
  function endRun() {
    state = 'over';
    setLevelButtonsLocked(false);
    input.left = false;
    input.right = false;
    const score = currentScore();
    if (score > bestScores[runLevel]) { bestScores[runLevel] = score; saveBest(runLevel); }
    showBest();
    showOverlay('over');
  }
  function update(dt) {
    if (state === 'countdown') {
      if (document.hidden) return;
      countdown = Math.max(0, countdown - dt);
      if (countdown > 0) showCountdown();
      else {
        state = 'running';
        countdownDisplay.hidden = true;
        invulnerable = lives < 3 ? 2 : 0;
      }
      return;
    }
    if (state !== 'running') return;
    invulnerable = Math.max(0, invulnerable - dt);
    player.colorTime = (player.colorTime || 0) + dt;
    const direction = 1;
    const previousX = player.x;
    const previousY = player.y;
    player.x = Math.max(0, player.x + direction * config.moveSpeed * speedMultiplier * dt);
    // Solid box sides stop horizontal movement without hurting the player.
    for (const obstacle of obstacles) {
      if (previousY <= -obstacle.height) continue;
      const left = obstacle.x + 3;
      const right = obstacle.x + obstacle.width - 3;
      if (direction > 0 && previousX + config.playerWidth - 4 <= left && player.x + config.playerWidth - 4 > left) {
        player.x = left - config.playerWidth + 4;
      } else if (direction < 0 && previousX + 4 >= right && player.x + 4 < right) {
        player.x = right - 4;
      }
    }
    if (direction) player.facing = direction;
    if (player.grounded) player.runTime += (player.x - previousX) / config.moveSpeed;
    maxProgress = Math.max(maxProgress, player.x - config.startX);
    cameraX = Math.max(0, player.x - Math.min(width * .33, 180));
    while (nextObstacleX < cameraX + width + 240) spawnObstacle();
    while (nextLedgeX < cameraX + width + 240) {
      const ledge = { x: nextLedgeX, width: 180 + Math.random() * 60, height: 145 + Math.random() * 10 };
      spawnLedge(ledge, .45 * .85);
      spawnLedge({ x: ledge.x + ledge.width * .55, width: 150 + Math.random() * 40, height: ledge.height + 110, upper: true }, .35 * .85);
      nextLedgeX += 450 + Math.random() * 200;
    }
    while (nextCoinX < cameraX + width + 240) {
      const box = obstacles.find(obstacle => nextCoinX + 12 > obstacle.x && nextCoinX - 12 < obstacle.x + obstacle.width);
      coins.push({ x: nextCoinX, y: -(box ? box.height : 0) - 34 });
      nextCoinX += 650 + Math.random() * 400;
    }
    const overlapsPlayer = obstacle => player.x + 4 < obstacle.x + obstacle.width - 3 && player.x + config.playerWidth - 4 > obstacle.x + 3;
    const surfaces = [...obstacles, ...ledges];
    // Recheck support after moving so walking off a box or ledge starts a fall.
    if (player.grounded && player.y < 0 && !surfaces.some(surface => overlapsPlayer(surface) && player.y === -surface.height)) {
      player.grounded = false;
    }
    if (!player.grounded) {
      player.velocity += config.gravity * dt;
      player.y += player.velocity * dt;
      if (player.velocity < 0) {
        const ceiling = ledges.filter(ledge => overlapsPlayer(ledge) && previousY - config.playerHeight >= -ledge.height + 12 && player.y - config.playerHeight <= -ledge.height + 12)
          .sort((a, b) => a.height - b.height)[0];
        if (ceiling) {
          player.y = -ceiling.height + 12 + config.playerHeight;
          player.velocity = 0;
        }
      }
      if (player.velocity >= 0) {
        const landing = surfaces.filter(obstacle => overlapsPlayer(obstacle) && previousY <= -obstacle.height && player.y >= -obstacle.height)
          .sort((a, b) => b.height - a.height)[0];
        if (landing) { player.y = -landing.height; player.velocity = 0; player.grounded = true; player.airJumpUsed = false; }
      }
      if (player.y >= 0) { player.y = 0; player.velocity = 0; player.grounded = true; player.airJumpUsed = false; }
    }
    for (const enemy of enemies) {
      enemy.x += enemy.direction * enemy.speed * speedMultiplier * dt;
      enemy.walkTime += dt * speedMultiplier;
      if (enemy.x >= enemy.right) { enemy.x = enemy.right; enemy.direction = -1; }
      else if (enemy.x <= enemy.left) { enemy.x = enemy.left; enemy.direction = 1; }
    }
    if (state === 'running') {
      const enemyTop = enemy => -(enemy.baseHeight || 0) - enemy.height;
      const stomped = enemies.filter(enemy => player.velocity >= 0 && previousY <= enemyTop(enemy) && player.y >= enemyTop(enemy) && overlapsPlayer(enemy));
      if (stomped.length) {
        player.y = Math.min(...stomped.map(enemyTop));
        player.velocity = config.jumpVelocity * .6;
        player.grounded = false;
        enemyBonus += stomped.length * 50;
        enemies = enemies.filter(enemy => !stomped.includes(enemy));
      }
      if (enemies.some(collision)) loseLife();
    }
    if (state === 'running') {
      coins = coins.filter(coin => {
        const collected = player.x < coin.x + 12 && player.x + config.playerWidth > coin.x - 12 && player.y > coin.y - 12 && player.y - config.playerHeight < coin.y + 12;
        if (collected) coinBonus += 100;
        return !collected;
      });
    }
    for (const particle of particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt; }
    particles = particles.filter(particle => particle.life > 0);
    scoreDisplay.textContent = formatScore(currentScore());
  }

  function line(x1, y1, x2, y2, stroke = colors.ink, thickness = 4) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function drawCloud(x, y, scale) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath();
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
    const hue = ((player.colorTime || 0) * 75) % 360;
    const rainbow = ctx.createLinearGradient(x - 12, footY - 58, x + 12, footY);
    rainbow.addColorStop(0, `hsl(${hue}, 80%, 58%)`);
    rainbow.addColorStop(.5, `hsl(${(hue + 90) % 360}, 80%, 58%)`);
    rainbow.addColorStop(1, `hsl(${(hue + 180) % 360}, 80%, 58%)`);
    const moving = state === 'running';
    const walking = player.grounded && moving && state !== 'ready';
    const facing = player.facing || 1;
    const phase = ((player.runTime / .22) % 1 + 1) % 1;
    const swing = walking ? Math.sin(phase * Math.PI * 2) * 10 : 0;
    const hipY = footY - 19;
    function drawLeg(offset, restingX, stroke) {
      const step = (phase + offset) % 1;
      // Plant the foot for half a stride, then lift it past the other foot.
      const progress = step < .5 ? step * 2 : (step - .5) * 2;
      const footX = x + (walking ? (step < .5 ? 17.6 - 35.2 * progress : -17.6 + 35.2 * progress) : restingX);
      const ankleY = footY - 2 - (walking && step >= .5 ? Math.sin(progress * Math.PI) * 9 : 0);
      const dx = footX - x, dy = ankleY - hipY;
      const distance = Math.hypot(dx, dy);
      // Two equal-length segments keep the knee bending forward throughout.
      const bend = Math.sqrt(Math.max(0, 13 * 13 - distance * distance / 4));
      const kneeX = (x + footX) / 2 + facing * dy / distance * bend;
      const kneeY = (hipY + ankleY) / 2 - facing * dx / distance * bend;
      line(x, hipY, kneeX, kneeY, stroke);
      line(kneeX, kneeY, footX, ankleY, stroke);
      line(footX, ankleY, footX + facing * 4, ankleY, stroke, 3);
    }
    drawLeg(.5, -7, rainbow);
    ctx.fillStyle = rainbow; ctx.beginPath(); ctx.arc(x, footY - 49, 8, 0, Math.PI * 2); ctx.fill();
    line(x, footY - 40, x, footY - 19, rainbow);
    line(x, footY - 34, x - 11 + swing * .5, footY - 23, rainbow, 3.5);
    line(x, footY - 34, x + 11 - swing * .5, footY - 23, rainbow, 3.5);
    drawLeg(0, 7, rainbow);
  }
  function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x - cameraX, groundY - (enemy.baseHeight || 0));
    ctx.scale(enemy.width / 30, enemy.height / 42);
    const x = 0;
    const stride = Math.sin(enemy.walkTime * 10) * 5;
    const y = -42;
    const hue = (enemy.walkTime * 75 + enemy.left * .7) % 360;
    const rainbow = ctx.createLinearGradient(x, y, x + 30, -9);
    rainbow.addColorStop(0, `hsl(${hue}, 80%, 58%)`);
    rainbow.addColorStop(.5, `hsl(${(hue + 90) % 360}, 80%, 58%)`);
    rainbow.addColorStop(1, `hsl(${(hue + 180) % 360}, 80%, 58%)`);
    ctx.fillStyle = rainbow;
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x + 2, y, 26, 33, 7);
    ctx.fill(); ctx.stroke();
    // Slanted brows and bright eyes distinguish the patrols from the player.
    line(x + 7, y + 8, x + 12, y + 11, colors.ink, 2);
    line(x + 18, y + 11, x + 23, y + 8, colors.ink, 2);
    ctx.fillStyle = '#fbfaf5';
    ctx.fillRect(x + 8, y + 13, 4, 4);
    ctx.fillRect(x + 18, y + 13, 4, 4);
    line(x + 10, -10, x + 9 + stride, -2, colors.ink, 3);
    line(x + 20, -10, x + 21 - stride, -2, colors.ink, 3);
    ctx.restore();
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, '#79c5f2');
    sky.addColorStop(1, '#d5efff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fbfaf5'; ctx.fillRect(0, groundY, width, height - groundY);
    ctx.fillStyle = '#fff2b5'; ctx.beginPath(); ctx.arc(width * .78 - cameraX * .08, height * .3, 44, 0, Math.PI * 2); ctx.fill();
    for (const cloud of clouds) {
      const cloudX = ((cloud.x - cameraX * .12) % (width + 130) + width + 130) % (width + 130) - 50;
      drawCloud(cloudX, cloud.y, cloud.scale);
    }
    drawGround();
    for (const ledge of ledges) {
      if (ledge.x + ledge.width < cameraX || ledge.x > cameraX + width) continue;
      const x = ledge.x - cameraX, y = groundY - ledge.height;
      ctx.fillStyle = ledge.upper ? '#9a9bd4' : '#90b6a0';
      ctx.fillRect(x, y, ledge.width, 12);
      ctx.strokeStyle = colors.ink; ctx.lineWidth = 2;
      ctx.strokeRect(x, y, ledge.width, 12);
      line(x + 6, y + 4, x + ledge.width - 6, y + 4, '#dcebdc', 2);
    }
    for (const coin of coins) {
      if (coin.x + 12 < cameraX || coin.x - 12 > cameraX + width) continue;
      const x = coin.x - cameraX, y = groundY + coin.y;
      ctx.fillStyle = '#f5c542';
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#b47b18';
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
      line(x, y - 4, x, y + 4, '#b47b18', 2);
    }
    for (const obstacle of obstacles) if (obstacle.x + obstacle.width >= cameraX && obstacle.x <= cameraX + width) drawObstacle(obstacle);
    for (const enemy of enemies) if (enemy.x + enemy.width >= cameraX && enemy.x <= cameraX + width) drawEnemy(enemy);
    ctx.fillStyle = colors.line;
    for (const particle of particles) ctx.fillRect(particle.x - cameraX, particle.y, 4, 4);
    if (invulnerable > 0) {
      const x = player.x - cameraX + 12;
      const y = groundY + player.y - 29;
      ctx.save();
      const rainbow = ctx.createLinearGradient(x - 30, y - 40, x + 30, y + 40);
      ['#ff5263', '#ffab40', '#ffe35a', '#64df84', '#49cfff', '#8d77ff', '#ef83e8'].forEach((color, index) => rainbow.addColorStop(index / 6, color));
      ctx.beginPath(); ctx.ellipse(x, y, 32, 40, 0, 0, Math.PI * 2);
      ctx.globalAlpha = .16;
      ctx.fillStyle = rainbow; ctx.fill();
      ctx.globalAlpha = .9;
      ctx.strokeStyle = rainbow; ctx.lineWidth = 4;
      ctx.shadowColor = '#82cfff'; ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    }
    drawPlayer();
  }
  function frame(timestamp) {
    const elapsed = (timestamp - (lastFrame || timestamp)) / 1000;
    const dt = state === 'countdown' ? elapsed : Math.min(elapsed, .032);
    lastFrame = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  const speedLevels = { easy: .7, medium: .85, hard: 1 };
  function setLevelButtonsLocked(locked) {
    for (const level of Object.keys(speedLevels)) {
      const button = document.querySelector(`#speed-${level}`);
      button.disabled = locked;
      button.title = locked ? 'Choose a level before your next run' : '';
    }
  }
  for (const [level, multiplier] of Object.entries(speedLevels)) {
    document.querySelector(`#speed-${level}`).addEventListener('click', () => {
      if (state !== 'ready' && state !== 'over') return;
      selectedLevel = level;
      speedMultiplier = multiplier;
      showBest();
      for (const name of Object.keys(speedLevels)) {
        document.querySelector(`#speed-${name}`).setAttribute('aria-pressed', String(name === level));
      }
    });
  }

  document.addEventListener('keydown', event => {
    if (['ArrowLeft', 'KeyA'].includes(event.code)) { event.preventDefault(); return; }
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
    } else if (event.code === 'KeyR' && !event.repeat && state !== 'running') start();
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
  document.querySelector('#jump-button').addEventListener('pointerdown', event => {
    event.preventDefault();
    jump();
  });
  startButton.addEventListener('click', start);
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'running') pause(); });
  window.addEventListener('blur', () => { input.left = false; input.right = false; if (state === 'running') pause(); });
  new ResizeObserver(resize).observe(stage);
  showBest();
  requestAnimationFrame(frame);
})();
