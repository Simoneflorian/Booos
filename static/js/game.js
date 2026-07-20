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
                    { x: 700, y: 416, w: 46, h: 24, minX: 660, maxX: 880, speed: 70, dir: 1, type: "seal" },
                    { x: 1600, y: 414, w: 48, h: 26, minX: 1520, maxX: 1780, speed: 90, dir: -1, type: "shark" },
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
                    { x: 420, y: 416, w: 46, h: 24, minX: 380, maxX: 540, speed: 80, dir: 1, type: "seal" },
                    { x: 900, y: 414, w: 48, h: 26, minX: 840, maxX: 1000, speed: 100, dir: -1, type: "shark" },
                    { x: 1740, y: 410, w: 60, h: 30, minX: 1680, maxX: 1960, speed: 110, dir: 1, type: "orca" },
                    { x: 2340, y: 416, w: 46, h: 24, minX: 2280, maxX: 2560, speed: 90, dir: -1, type: "seal" },
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
                    { x: 900, y: 414, w: 48, h: 26, minX: 860, maxX: 1040, speed: 100, dir: 1, type: "shark" },
                    { x: 1330, y: 296, w: 46, h: 24, minX: 1320, maxX: 1420, speed: 90, dir: 1, type: "seal" },
                    { x: 1880, y: 416, w: 46, h: 24, minX: 1860, maxX: 1960, speed: 100, dir: -1, type: "seal" },
                    { x: 2100, y: 410, w: 60, h: 30, minX: 2040, maxX: 2240, speed: 130, dir: 1, type: "orca" },
                    { x: 2700, y: 410, w: 60, h: 30, minX: 2540, maxX: 2960, speed: 140, dir: -1, type: "orca" },
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
        updateHud();
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
                showOverlay("Geschafft! 🏆", `Der Pinguin hat alle Level gemeistert und ${score} Punkte gesammelt!`, "Nochmal spielen");
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
                `Level ${levelIndex + 1} abgeschlossen mit ${score} Punkten.`,
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
            showOverlay("Game Over", `Dein Pinguin hat ${score} Punkte gesammelt. Versuch's nochmal!`, "Neu starten");
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
    function drawPenguin(p) {
        const f = p.facing;
        const cx = p.x + p.w / 2;
        // body
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.ellipse(cx, p.y + p.h / 2, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // white belly
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.ellipse(cx + f * 3, p.y + p.h / 2 + 5, p.w / 3, p.h / 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // flipper (on the back side)
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.ellipse(cx - f * 11, p.y + p.h / 2, 5, 12, f * 0.25, 0, Math.PI * 2);
        ctx.fill();
        // eye
        const eyeX = cx + f * 7;
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(eyeX, p.y + 10, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.beginPath(); ctx.arc(eyeX + f, p.y + 10, 2, 0, Math.PI * 2); ctx.fill();
        // beak
        ctx.fillStyle = "#f59e0b";
        const bx = f === 1 ? p.x + p.w - 2 : p.x + 2;
        ctx.beginPath();
        ctx.moveTo(bx, p.y + 13);
        ctx.lineTo(bx + f * 9, p.y + 16);
        ctx.lineTo(bx, p.y + 19);
        ctx.closePath();
        ctx.fill();
        // feet
        ctx.fillStyle = "#f59e0b";
        ctx.fillRect(p.x + 4, p.y + p.h - 3, 9, 3);
        ctx.fillRect(p.x + p.w - 13, p.y + p.h - 3, 9, 3);
    }

    function drawSeal(e) {
        const d = e.dir;
        const headX = d === 1 ? e.x + e.w - 7 : e.x + 7;
        // body
        ctx.fillStyle = "#94a3b8";
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2 + 2, e.w / 2, e.h / 2 - 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // tail flipper
        const tailX = d === 1 ? e.x + 2 : e.x + e.w - 2;
        ctx.beginPath();
        ctx.moveTo(tailX, e.y + e.h / 2 + 2);
        ctx.lineTo(tailX - d * 7, e.y + e.h / 2 - 5);
        ctx.lineTo(tailX - d * 7, e.y + e.h / 2 + 9);
        ctx.closePath();
        ctx.fill();
        // head
        ctx.beginPath(); ctx.arc(headX, e.y + 8, 8, 0, Math.PI * 2); ctx.fill();
        // leopard spots
        ctx.fillStyle = "#475569";
        ctx.beginPath(); ctx.arc(e.x + e.w / 2 - 7, e.y + e.h / 2 + 2, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e.x + e.w / 2 + 5, e.y + e.h / 2 - 1, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(e.x + e.w / 2 - 1, e.y + e.h / 2 + 7, 2, 0, Math.PI * 2); ctx.fill();
        // eye + snout
        ctx.fillStyle = "#0f172a";
        ctx.beginPath(); ctx.arc(headX + d * 3, e.y + 6, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(headX + d * 7, e.y + 10, 1.5, 0, Math.PI * 2); ctx.fill();
    }

    function drawOrca(e) {
        const d = e.dir;
        const headX = d === 1 ? e.x + e.w - 13 : e.x + 13;
        // body
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2 + 3, e.w / 2, e.h / 2 - 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // dorsal fin
        ctx.beginPath();
        ctx.moveTo(e.x + e.w / 2 - 8, e.y + 10);
        ctx.lineTo(e.x + e.w / 2 - d * 3, e.y - 4);
        ctx.lineTo(e.x + e.w / 2 + 8, e.y + 10);
        ctx.closePath();
        ctx.fill();
        // tail fluke
        const tailX = d === 1 ? e.x + 2 : e.x + e.w - 2;
        ctx.beginPath();
        ctx.moveTo(tailX, e.y + e.h / 2 + 2);
        ctx.lineTo(tailX - d * 9, e.y + e.h / 2 - 7);
        ctx.lineTo(tailX - d * 9, e.y + e.h / 2 + 9);
        ctx.closePath();
        ctx.fill();
        // white belly
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.y + e.h - 4, e.w / 2 - 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // white eye patch
        ctx.beginPath();
        ctx.ellipse(headX, e.y + 9, 5, 3, d * 0.4, 0, Math.PI * 2);
        ctx.fill();
        // eye
        ctx.fillStyle = "#0f172a";
        ctx.beginPath(); ctx.arc(headX + d * 2, e.y + 12, 1.5, 0, Math.PI * 2); ctx.fill();
    }

    function drawShark(e) {
        const d = e.dir;
        const headX = d === 1 ? e.x + e.w - 10 : e.x + 10;
        // body
        ctx.fillStyle = "#64748b";
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2 + 3, e.w / 2, e.h / 2 - 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // dorsal fin
        ctx.beginPath();
        ctx.moveTo(e.x + e.w / 2 - 8, e.y + 9);
        ctx.lineTo(e.x + e.w / 2 - d * 3, e.y - 3);
        ctx.lineTo(e.x + e.w / 2 + 6, e.y + 9);
        ctx.closePath();
        ctx.fill();
        // tail fin
        const tailX = d === 1 ? e.x + 2 : e.x + e.w - 2;
        ctx.beginPath();
        ctx.moveTo(tailX, e.y + e.h / 2 + 2);
        ctx.lineTo(tailX - d * 8, e.y + e.h / 2 - 8);
        ctx.lineTo(tailX - d * 8, e.y + e.h / 2 + 8);
        ctx.closePath();
        ctx.fill();
        // light belly
        ctx.fillStyle = "#cbd5e1";
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.y + e.h - 4, e.w / 2 - 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // eye
        ctx.fillStyle = "#0f172a";
        ctx.beginPath(); ctx.arc(headX, e.y + 9, 2, 0, Math.PI * 2); ctx.fill();
        // mouth with teeth
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(headX + d * 2, e.y + 15);
        ctx.lineTo(headX + d * 8, e.y + 15);
        ctx.stroke();
    }

    const enemyPainters = { seal: drawSeal, orca: drawOrca, shark: drawShark };

    function render() {
        ctx.clearRect(0, 0, W, H);

        // Polar sky
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "#a8d4ee");
        grad.addColorStop(0.7, "#d8edf9");
        grad.addColorStop(1, "#eef8fe");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // low polar sun
        ctx.fillStyle = "rgba(255,244,214,0.9)";
        ctx.beginPath();
        ctx.arc(W - 140, 90, 34, 0, Math.PI * 2);
        ctx.fill();

        if (!level) return;

        // parallax icebergs
        const parallax = cameraX * 0.4;
        for (let i = 0; i < 8; i++) {
            const bx = (i * 320 - (parallax % 320)) - 120;
            const peak = 300 + (i % 3) * 35;
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.beginPath();
            ctx.moveTo(bx, 445);
            ctx.lineTo(bx + 75, peak);
            ctx.lineTo(bx + 160, 445);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "rgba(176,216,240,0.7)";
            ctx.beginPath();
            ctx.moveTo(bx + 75, peak);
            ctx.lineTo(bx + 160, 445);
            ctx.lineTo(bx + 108, 445);
            ctx.closePath();
            ctx.fill();
        }

        ctx.save();
        ctx.translate(-cameraX, 0);

        // ocean in the gaps between the ice floes
        ctx.fillStyle = "#1d6fa5";
        ctx.fillRect(0, 458, level.width, H - 458);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(0, 458, level.width, 3);

        // Ice platforms
        for (const p of level.platforms) {
            ctx.fillStyle = "#a9d6ef";
            ctx.fillRect(p.x, p.y, p.w, p.h);
            ctx.fillStyle = "#8bc2e2";
            ctx.fillRect(p.x, p.y + p.h - 6, p.w, 6);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(p.x, p.y, p.w, 8);
        }

        // Fish (collectibles)
        for (const c of level.coins) {
            if (c.collected) continue;
            ctx.fillStyle = "#fb923c";
            ctx.beginPath();
            ctx.ellipse(c.x + 8, c.y + 10, 8, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(c.x + 15, c.y + 10);
            ctx.lineTo(c.x + 20, c.y + 5);
            ctx.lineTo(c.x + 20, c.y + 15);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#7c2d12";
            ctx.beginPath();
            ctx.arc(c.x + 4, c.y + 9, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Enemies
        for (const e of level.enemies) {
            if (!e.alive) continue;
            (enemyPainters[e.type] || drawSeal)(e);
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

        // Player (penguin)
        if (invincibleTimer <= 0 || Math.floor(invincibleTimer * 10) % 2 === 0) {
            drawPenguin(player);
        }

        ctx.restore();

        // falling snow (screen space)
        const t = performance.now() / 1000;
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        for (let i = 0; i < 40; i++) {
            const sx = (((i * 97 + Math.sin(t + i) * 25) % W) + W) % W;
            const sy = (i * 53 + t * (25 + (i % 4) * 12)) % H;
            ctx.beginPath();
            ctx.arc(sx, sy, 1.5 + (i % 2), 0, Math.PI * 2);
            ctx.fill();
        }
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
