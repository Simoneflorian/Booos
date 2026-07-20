(() => {
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    const scoreEl = document.getElementById("score");
    const livesEl = document.getElementById("lives");
    const levelEl = document.getElementById("level");
    const levelCountEl = document.getElementById("levelCount");
    const overlay = document.getElementById("overlay");
    const overlayTitle = document.getElementById("overlayTitle");
    const overlayText = document.getElementById("overlayText");
    const overlayBtn = document.getElementById("overlayBtn");

    const GRAVITY = 1800;
    const MOVE_ACCEL = 2600;
    const MAX_SPEED = 260;
    const FRICTION = 2200;
    const JUMP_SPEED = 620;
    const MAX_FALL = 900;

    // ---- Level definitions -------------------------------------------------
    // Coordinates are in world pixels. ground is a platform too.
    function buildLevels() {
        return [
            {
                width: 2200,
                spawn: { x: 40, y: 360 },
                platforms: [
                    { x: 0, y: 440, w: 560, h: 40 },
                    { x: 640, y: 440, w: 260, h: 40 },
                    { x: 980, y: 440, w: 220, h: 40 },
                    { x: 1280, y: 380, w: 140, h: 20 },
                    { x: 1500, y: 440, w: 700, h: 40 },
                    { x: 900, y: 320, w: 120, h: 20 },
                    { x: 1100, y: 260, w: 120, h: 20 },
                ],
                coins: [
                    { x: 300, y: 400 }, { x: 340, y: 400 }, { x: 380, y: 400 },
                    { x: 700, y: 400 }, { x: 760, y: 400 },
                    { x: 930, y: 280 }, { x: 1130, y: 220 },
                    { x: 1550, y: 400 }, { x: 1600, y: 400 }, { x: 1650, y: 400 },
                ],
                enemies: [
                    { x: 700, y: 412, w: 32, h: 28, minX: 660, maxX: 880, speed: 70, dir: 1 },
                    { x: 1600, y: 412, w: 32, h: 28, minX: 1520, maxX: 1780, speed: 90, dir: -1 },
                ],
                goal: { x: 2140, y: 340, w: 40, h: 100 },
            },
            {
                width: 2600,
                spawn: { x: 40, y: 360 },
                platforms: [
                    { x: 0, y: 440, w: 300, h: 40 },
                    { x: 380, y: 440, w: 160, h: 40 },
                    { x: 620, y: 380, w: 140, h: 20 },
                    { x: 840, y: 440, w: 160, h: 40 },
                    { x: 1080, y: 380, w: 120, h: 20 },
                    { x: 1280, y: 320, w: 120, h: 20 },
                    { x: 1480, y: 380, w: 120, h: 20 },
                    { x: 1680, y: 440, w: 300, h: 40 },
                    { x: 2060, y: 380, w: 140, h: 20 },
                    { x: 2280, y: 440, w: 320, h: 40 },
                ],
                coins: [
                    { x: 420, y: 400 }, { x: 460, y: 400 },
                    { x: 660, y: 340 }, { x: 700, y: 340 },
                    { x: 1110, y: 340 }, { x: 1310, y: 280 }, { x: 1510, y: 340 },
                    { x: 1740, y: 400 }, { x: 1780, y: 400 }, { x: 1820, y: 400 },
                    { x: 2100, y: 340 }, { x: 2320, y: 400 }, { x: 2360, y: 400 },
                ],
                enemies: [
                    { x: 420, y: 412, w: 32, h: 28, minX: 380, maxX: 540, speed: 80, dir: 1 },
                    { x: 900, y: 412, w: 32, h: 28, minX: 840, maxX: 1000, speed: 100, dir: -1 },
                    { x: 1740, y: 412, w: 32, h: 28, minX: 1680, maxX: 1960, speed: 110, dir: 1 },
                    { x: 2340, y: 412, w: 32, h: 28, minX: 2280, maxX: 2560, speed: 90, dir: -1 },
                ],
                goal: { x: 2540, y: 340, w: 40, h: 100 },
            },
            {
                width: 3000,
                spawn: { x: 40, y: 360 },
                platforms: [
                    { x: 0, y: 440, w: 240, h: 40 },
                    { x: 320, y: 380, w: 100, h: 20 },
                    { x: 500, y: 320, w: 100, h: 20 },
                    { x: 680, y: 380, w: 100, h: 20 },
                    { x: 860, y: 440, w: 200, h: 40 },
                    { x: 1140, y: 380, w: 100, h: 20 },
                    { x: 1320, y: 320, w: 100, h: 20 },
                    { x: 1500, y: 260, w: 100, h: 20 },
                    { x: 1680, y: 320, w: 100, h: 20 },
                    { x: 1860, y: 380, w: 100, h: 20 },
                    { x: 2040, y: 440, w: 220, h: 40 },
                    { x: 2340, y: 380, w: 120, h: 20 },
                    { x: 2540, y: 440, w: 460, h: 40 },
                ],
                coins: [
                    { x: 340, y: 340 }, { x: 520, y: 280 }, { x: 700, y: 340 },
                    { x: 900, y: 400 }, { x: 940, y: 400 },
                    { x: 1160, y: 340 }, { x: 1340, y: 280 }, { x: 1520, y: 220 },
                    { x: 1700, y: 280 }, { x: 1880, y: 340 },
                    { x: 2080, y: 400 }, { x: 2120, y: 400 },
                    { x: 2600, y: 400 }, { x: 2650, y: 400 }, { x: 2700, y: 400 },
                ],
                enemies: [
                    { x: 900, y: 412, w: 32, h: 28, minX: 860, maxX: 1040, speed: 100, dir: 1 },
                    { x: 1350, y: 292, w: 32, h: 28, minX: 1320, maxX: 1400, speed: 90, dir: 1 },
                    { x: 1900, y: 412, w: 32, h: 28, minX: 1860, maxX: 1940, speed: 100, dir: -1 },
                    { x: 2100, y: 412, w: 32, h: 28, minX: 2040, maxX: 2240, speed: 130, dir: 1 },
                    { x: 2700, y: 412, w: 32, h: 28, minX: 2540, maxX: 2960, speed: 140, dir: -1 },
                ],
                goal: { x: 2940, y: 340, w: 40, h: 100 },
            },
        ];
    }

    const levels = buildLevels();
    levelCountEl.textContent = levels.length;

    // ---- State ---------------------------------------------------------------
    let state = "menu"; // menu | playing | paused | levelComplete | gameover | win
    let levelIndex = 0;
    let score = 0;
    let lives = 3;
    let cameraX = 0;
    let invincibleTimer = 0;
    let respawn = null;

    let level = null;
    let player = null;

    function loadLevel(idx) {
        level = JSON.parse(JSON.stringify(levels[idx]));
        level.coins.forEach(c => (c.collected = false));
        level.enemies.forEach(e => (e.alive = true));
        player = {
            x: level.spawn.x, y: level.spawn.y,
            w: 30, h: 40,
            vx: 0, vy: 0,
            onGround: false,
            facing: 1,
        };
        cameraX = 0;
        invincibleTimer = 1.2;
    }

    function resetGame() {
        levelIndex = 0;
        score = 0;
        lives = 3;
        loadLevel(levelIndex);
    }

    // ---- Input -----------------------------------------------------------
    const keys = {};
    window.addEventListener("keydown", (e) => {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
        keys[e.key.toLowerCase()] = true;
        if (e.key === " " || e.key === "ArrowUp") keys["jump"] = true;
        if ((e.key === "p" || e.key === "P")) togglePause();
        if (state === "menu" || state === "gameover" || state === "win" || state === "levelComplete") {
            if (e.key === "Enter" || e.key === " ") handleOverlayAction();
        }
    });
    window.addEventListener("keyup", (e) => {
        keys[e.key.toLowerCase()] = false;
        if (e.key === " " || e.key === "ArrowUp") keys["jump"] = false;
    });

    function togglePause() {
        if (state === "playing") { state = "paused"; showOverlay("Pause", "Weiter geht's mit P oder dem Button.", "Weiter"); }
        else if (state === "paused") { state = "playing"; hideOverlay(); }
    }

    function showOverlay(title, text, btnLabel) {
        overlayTitle.textContent = title;
        overlayText.innerHTML = text;
        overlayBtn.textContent = btnLabel;
        overlay.style.display = "flex";
    }
    function hideOverlay() { overlay.style.display = "none"; }

    function handleOverlayAction() {
        if (state === "menu") {
            resetGame();
            state = "playing";
            hideOverlay();
        } else if (state === "paused") {
            state = "playing";
            hideOverlay();
        } else if (state === "levelComplete") {
            levelIndex++;
            if (levelIndex >= levels.length) {
                state = "win";
                showOverlay("Geschafft! 🏆", `Alle Level gemeistert mit ${score} Sternen!`, "Nochmal spielen");
            } else {
                loadLevel(levelIndex);
                state = "playing";
                hideOverlay();
            }
        } else if (state === "gameover" || state === "win") {
            resetGame();
            state = "playing";
            hideOverlay();
        }
    }
    overlayBtn.addEventListener("click", handleOverlayAction);

    // ---- Collision helpers -------------------------------------------------
    function rectsOverlap(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function moveAndCollideX(entity, dx) {
        entity.x += dx;
        for (const p of level.platforms) {
            if (rectsOverlap(entity, p)) {
                if (dx > 0) entity.x = p.x - entity.w;
                else if (dx < 0) entity.x = p.x + p.w;
                entity.vx = 0;
            }
        }
    }

    function moveAndCollideY(entity, dy) {
        entity.y += dy;
        entity.onGround = false;
        for (const p of level.platforms) {
            if (rectsOverlap(entity, p)) {
                if (dy > 0) {
                    entity.y = p.y - entity.h;
                    entity.onGround = true;
                    entity.vy = 0;
                } else if (dy < 0) {
                    entity.y = p.y + p.h;
                    entity.vy = 0;
                }
            }
        }
    }

    // ---- Update --------------------------------------------------------------
    function update(dt) {
        if (state !== "playing") return;

        if (invincibleTimer > 0) invincibleTimer -= dt;

        // Horizontal movement
        const left = keys["arrowleft"] || keys["a"];
        const right = keys["arrowright"] || keys["d"];
        if (left && !right) {
            player.vx -= MOVE_ACCEL * dt;
            player.facing = -1;
        } else if (right && !left) {
            player.vx += MOVE_ACCEL * dt;
            player.facing = 1;
        } else {
            const sign = Math.sign(player.vx);
            player.vx -= sign * Math.min(Math.abs(player.vx), FRICTION * dt);
        }
        player.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, player.vx));

        // Jump
        if (keys["jump"] && player.onGround) {
            player.vy = -JUMP_SPEED;
            player.onGround = false;
        }

        // Gravity
        player.vy += GRAVITY * dt;
        player.vy = Math.min(player.vy, MAX_FALL);

        moveAndCollideX(player, player.vx * dt);
        moveAndCollideY(player, player.vy * dt);

        // World bounds
        if (player.x < 0) player.x = 0;
        if (player.x + player.w > level.width) player.x = level.width - player.w;

        // Fell into a pit
        if (player.y > H + 100) {
            loseLife();
            return;
        }

        // Enemies
        for (const e of level.enemies) {
            if (!e.alive) continue;
            e.x += e.dir * e.speed * dt;
            if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
            if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.dir = -1; }

            if (rectsOverlap(player, e)) {
                const stomping = player.vy > 60 && (player.y + player.h - e.y) < 18;
                if (stomping) {
                    e.alive = false;
                    player.vy = -JUMP_SPEED * 0.6;
                    score += 50;
                    updateHud();
                } else if (invincibleTimer <= 0) {
                    loseLife();
                    return;
                }
            }
        }

        // Coins
        for (const c of level.coins) {
            if (c.collected) continue;
            const coinBox = { x: c.x, y: c.y, w: 20, h: 20 };
            if (rectsOverlap(player, coinBox)) {
                c.collected = true;
                score += 10;
                updateHud();
            }
        }

        // Goal
        if (rectsOverlap(player, level.goal)) {
            state = "levelComplete";
            score += 100;
            updateHud();
            const isLast = levelIndex === levels.length - 1;
            showOverlay(
                "Level geschafft! 🚩",
                `Level ${levelIndex + 1} abgeschlossen mit ${score} Sternen.`,
                isLast ? "Zum Sieg" : "Nächstes Level"
            );
        }

        // Camera
        cameraX = player.x + player.w / 2 - W / 2;
        cameraX = Math.max(0, Math.min(cameraX, level.width - W));
    }

    function loseLife() {
        lives--;
        updateHud();
        if (lives <= 0) {
            state = "gameover";
            showOverlay("Game Over", `Du hast ${score} Sterne gesammelt. Versuch's nochmal!`, "Neu starten");
        } else {
            player.x = level.spawn.x;
            player.y = level.spawn.y;
            player.vx = 0;
            player.vy = 0;
            invincibleTimer = 1.5;
        }
    }

    function updateHud() {
        scoreEl.textContent = score;
        livesEl.textContent = lives;
        levelEl.textContent = levelIndex + 1;
    }

    // ---- Render ----------------------------------------------------------
    function render() {
        ctx.clearRect(0, 0, W, H);

        // Sky gradient + parallax hills
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#7ec8f2");
        grad.addColorStop(1, "#bfe8ff");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        if (!level) return;

        ctx.save();
        const parallax = cameraX * 0.4;
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        for (let i = 0; i < 8; i++) {
            const hx = (i * 300 - parallax % 300) - 100;
            ctx.beginPath();
            ctx.arc(hx, 380, 60, Math.PI, 0);
            ctx.fill();
        }
        ctx.restore();

        ctx.save();
        ctx.translate(-cameraX, 0);

        // Platforms
        for (const p of level.platforms) {
            ctx.fillStyle = "#5b3a29";
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.fillStyle = "#4caf50";
            ctx.fillRect(p.x, p.y, p.w, 10);
        }

        // Coins
        for (const c of level.coins) {
            if (c.collected) continue;
            ctx.fillStyle = "#fbbf24";
            ctx.beginPath();
            ctx.arc(c.x + 10, c.y + 10, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#b45309";
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Enemies
        for (const e of level.enemies) {
            if (!e.alive) continue;
            ctx.fillStyle = "#7c3aed";
            ctx.fillRect(e.x, e.y, e.w, e.h);
            ctx.fillStyle = "#fff";
            ctx.fillRect(e.x + 6, e.y + 8, 5, 5);
            ctx.fillRect(e.x + e.w - 11, e.y + 8, 5, 5);
        }

        // Goal flag
        const g = level.goal;
        ctx.fillStyle = "#94a3b8";
        ctx.fillRect(g.x + g.w / 2 - 3, g.y, 6, g.h);
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.moveTo(g.x + g.w / 2 + 3, g.y);
        ctx.lineTo(g.x + g.w, g.y + 15);
        ctx.lineTo(g.x + g.w / 2 + 3, g.y + 30);
        ctx.closePath();
        ctx.fill();

        // Player
        if (invincibleTimer <= 0 || Math.floor(invincibleTimer * 10) % 2 === 0) {
            ctx.fillStyle = "#ef4444";
            ctx.fillRect(player.x, player.y, player.w, player.h);
            ctx.fillStyle = "#fff";
            const eyeX = player.facing === 1 ? player.x + player.w - 12 : player.x + 4;
            ctx.fillRect(eyeX, player.y + 8, 8, 8);
        }

        ctx.restore();
    }

    // ---- Main loop ---------------------------------------------------------
    let lastTime = performance.now();
    function loop(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.033);
        lastTime = now;
        update(dt);
        render();
        requestAnimationFrame(loop);
    }

    updateHud();
    requestAnimationFrame(loop);
})();
