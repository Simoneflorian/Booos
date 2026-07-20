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
    const WATER_TOP = 458;

    // Real-world scale: the penguin (~1.1 m) is 40 px tall, so ~35 px per metre.
    // Leopard seal ~3 m, shark ~4.3 m, orca ~6.5 m.
    const ENEMY_SPECS = {
        seal:  { w: 110, h: 30, peek: 6,  swimSpeed: 60, lungeVy: 600, lungeVx: 170, range: 210, cooldownMin: 1.8, cooldownMax: 3.2 },
        shark: { w: 150, h: 44, peek: 8,  swimSpeed: 80, lungeVy: 690, lungeVx: 200, range: 270, cooldownMin: 2.2, cooldownMax: 3.8 },
        orca:  { w: 230, h: 64, peek: 10, swimSpeed: 90, lungeVy: 850, lungeVx: 230, range: 340, cooldownMin: 3.0, cooldownMax: 5.0 },
    };

    // ---- Level definitions -------------------------------------------------
    // Enemies live in the water gaps between the ice floes (gapMin..gapMax)
    // and leap out to hunt the penguin, like their real counterparts.
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
                    { type: "seal", gapMin: 560, gapMax: 640 },
                    { type: "shark", gapMin: 1200, gapMax: 1500 },
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
                    { type: "seal", gapMin: 300, gapMax: 380 },
                    { type: "shark", gapMin: 540, gapMax: 840 },
                    { type: "orca", gapMin: 1000, gapMax: 1680 },
                    { type: "seal", gapMin: 1980, gapMax: 2280 },
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
                    { type: "shark", gapMin: 240, gapMax: 860 },
                    { type: "seal", gapMin: 1060, gapMax: 1500 },
                    { type: "orca", gapMin: 1450, gapMax: 2040 },
                    { type: "shark", gapMin: 2260, gapMax: 2540 },
                ],
                goal: { x: 2940, y: 340, w: 40, h: 100 },
            },
        ];
    }

    const levels = buildLevels();
    levelCountEl.textContent = levels.length;

    // ---- State ---------------------------------------------------------------
    let state = "menu"; // menu | playing | caught | paused | levelComplete | gameover | win
    let levelIndex = 0;
    let score = 0;
    let lives = 3;
    let cameraX = 0;
    let invincibleTimer = 0;
    let caughtBy = null;
    let deathTimer = 0;
    let splashes = [];

    let level = null;
    let player = null;
    let terrainCanvas = null;

    // Seeded RNG so painterly brush strokes stay stable between frames.
    function rng(seed) {
        let a = seed >>> 0;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function makeEnemy(def, r) {
        const spec = ENEMY_SPECS[def.type];
        const gapW = def.gapMax - def.gapMin;
        let minX, maxX;
        if (gapW >= spec.w + 40) {
            minX = def.gapMin + 5;
            maxX = def.gapMax - 5;
        } else {
            // Water zone extends under the ice so big hunters can lurk beneath it.
            const cx = (def.gapMin + def.gapMax) / 2;
            minX = cx - (spec.w + 60) / 2;
            maxX = cx + (spec.w + 60) / 2;
        }
        return {
            type: def.type,
            w: spec.w, h: spec.h,
            gapMin: def.gapMin, gapMax: def.gapMax,
            minX, maxX,
            swimY: WATER_TOP - spec.peek,
            x: minX + r() * Math.max(1, (maxX - minX - spec.w)),
            y: WATER_TOP - spec.peek,
            vx: 0, vy: 0,
            dir: r() > 0.5 ? 1 : -1,
            mode: "swim", // swim | lunge | carry | dead | gone
            cooldown: 1.5 + r() * 2,
            phase: r() * Math.PI * 2,
            spec,
        };
    }

    function loadLevel(idx) {
        level = JSON.parse(JSON.stringify(levels[idx]));
        level.coins.forEach(c => (c.collected = false));
        const r = rng(1000 + idx);
        level.enemies = level.enemies.map(def => makeEnemy(def, r));
        player = {
            x: level.spawn.x, y: level.spawn.y,
            w: 30, h: 40,
            vx: 0, vy: 0,
            onGround: false,
            facing: 1,
        };
        cameraX = 0;
        invincibleTimer = 1.2;
        caughtBy = null;
        splashes = [];
        paintTerrain(idx);
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
                showOverlay("Geschafft! 🏆", `Der Pinguin hat allen Jägern getrotzt und ${score} Punkte gesammelt!`, "Nochmal spielen");
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

    // Enemy bodies are drawn as ellipses; shrink the hitbox so the empty
    // corners of the bounding box don't kill the player.
    function enemyHitbox(e) {
        return { x: e.x + e.w * 0.12, y: e.y + e.h * 0.15, w: e.w * 0.76, h: e.h * 0.7 };
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

    function addSplash(x, scale) {
        splashes.push({ x, t: 0, scale: scale || 1 });
    }

    // ---- Update --------------------------------------------------------------
    function update(dt) {
        for (const s of splashes) s.t += dt;
        splashes = splashes.filter(s => s.t < 0.7);

        if (state === "caught") { updateCaught(dt); return; }
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

        // Fell into the icy water
        if (player.y > WATER_TOP + 6) {
            addSplash(player.x + player.w / 2, 1);
            loseLife();
            return;
        }

        // Enemies: lurk in the water, then leap out to hunt the penguin
        const pcx = player.x + player.w / 2;
        for (const e of level.enemies) {
            if (e.mode === "gone") continue;

            if (e.mode === "dead") {
                e.y += 100 * dt;
                if (e.y > H + 80) e.mode = "gone";
                continue;
            }

            if (e.mode === "swim") {
                e.cooldown -= dt;
                e.x += e.dir * e.spec.swimSpeed * dt;
                if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
                if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.dir = -1; }
                e.y = e.swimY + Math.sin(performance.now() / 1000 * 2 + e.phase) * 2;

                const ecx = e.x + e.w / 2;
                const inGap = e.x + e.w > e.gapMin + 15 && e.x < e.gapMax - 15;
                if (e.cooldown <= 0 && inGap && Math.abs(pcx - ecx) < e.spec.range) {
                    e.mode = "lunge";
                    e.dir = pcx >= ecx ? 1 : -1;
                    e.vx = e.dir * e.spec.lungeVx;
                    e.vy = -e.spec.lungeVy;
                    addSplash(ecx, e.w / 110);
                }
            } else if (e.mode === "lunge") {
                e.vy += GRAVITY * 0.85 * dt;
                e.x += e.vx * dt;
                e.y += e.vy * dt;
                const lo = e.gapMin - 70;
                const hi = e.gapMax + 70 - e.w;
                if (e.x < lo) e.x = lo;
                if (e.x > hi) e.x = hi;
                if (e.vy > 0 && e.y >= e.swimY) {
                    e.y = e.swimY;
                    e.mode = "swim";
                    e.cooldown = e.spec.cooldownMin + Math.random() * (e.spec.cooldownMax - e.spec.cooldownMin);
                    addSplash(e.x + e.w / 2, e.w / 110);
                }

                const box = enemyHitbox(e);
                if (rectsOverlap(player, box)) {
                    const stomping = player.vy > 60 && (player.y + player.h - box.y) < 26;
                    if (stomping) {
                        e.mode = "dead";
                        player.vy = -JUMP_SPEED * 0.6;
                        score += 50;
                        updateHud();
                    } else if (invincibleTimer <= 0) {
                        startCatch(e);
                        return;
                    }
                }
            }
        }

        // Fish
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

        updateCamera();
    }

    // The hunter grabs the penguin and drags it down into the water.
    function startCatch(e) {
        state = "caught";
        caughtBy = e;
        deathTimer = 0;
        e.mode = "carry";
        e.vy = Math.max(e.vy, 40);
        e.splashed = false;
    }

    function updateCaught(dt) {
        deathTimer += dt;
        const e = caughtBy;
        const targetX = (e.gapMin + e.gapMax) / 2 - e.w / 2;
        const dx = targetX - e.x;
        e.x += Math.sign(dx) * Math.min(Math.abs(dx), 180 * dt);
        if (Math.abs(dx) > 4) e.dir = dx > 0 ? 1 : -1;
        e.y += 170 * dt;

        // Pin the penguin to the hunter's jaws
        const mouthX = e.dir === 1 ? e.x + e.w - 8 : e.x + 8;
        player.x = mouthX - player.w / 2;
        player.y = e.y - player.h * 0.35;
        player.facing = -e.dir;

        if (!e.splashed && e.y > WATER_TOP - e.h / 2) {
            e.splashed = true;
            addSplash(e.x + e.w / 2, e.w / 90);
        }

        updateCamera();

        if (e.y > H + 80 || deathTimer > 2.4) {
            e.mode = "swim";
            e.y = e.swimY;
            e.x = Math.max(e.minX, Math.min(targetX, e.maxX - e.w));
            e.cooldown = 3;
            caughtBy = null;
            state = "playing";
            loseLife();
        }
    }

    function updateCamera() {
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

    // ---- Painterly rendering ----------------------------------------------
    function ell(x, y, rx, ry, rot, fill, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.ellipse(x, y, Math.max(rx, 0.5), Math.max(ry, 0.5), rot, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Sky, painted once with soft layered brush strokes.
    const skyCanvas = document.createElement("canvas");
    skyCanvas.width = W; skyCanvas.height = H;
    (function paintSky() {
        const c = skyCanvas.getContext("2d");
        const r = rng(7);
        const g = c.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#7fa4c6");
        g.addColorStop(0.45, "#b5d0e3");
        g.addColorStop(0.72, "#e6dbd0");
        g.addColorStop(1, "#d6e6ef");
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);
        for (let i = 0; i < 70; i++) {
            const y = r() * H * 0.78;
            const x = r() * W;
            const len = 60 + r() * 240;
            const th = 4 + r() * 16;
            const warm = y > H * 0.45;
            c.fillStyle = warm
                ? `rgba(${232 + r() * 20 | 0}, ${208 + r() * 26 | 0}, ${186 + r() * 30 | 0}, ${0.05 + r() * 0.09})`
                : `rgba(${186 + r() * 44 | 0}, ${212 + r() * 32 | 0}, ${232 + r() * 22 | 0}, ${0.06 + r() * 0.1})`;
            c.beginPath();
            c.ellipse(x, y, len / 2, th / 2, (r() - 0.5) * 0.12, 0, Math.PI * 2);
            c.fill();
        }
        // Low polar sun with a soft halo
        const sx = W - 150, sy = 100;
        const halo = c.createRadialGradient(sx, sy, 5, sx, sy, 130);
        halo.addColorStop(0, "rgba(255,238,204,0.95)");
        halo.addColorStop(0.25, "rgba(255,226,180,0.4)");
        halo.addColorStop(1, "rgba(255,226,180,0)");
        c.fillStyle = halo;
        c.fillRect(sx - 140, sy - 140, 280, 280);
        c.fillStyle = "rgba(255,247,226,0.95)";
        c.beginPath(); c.arc(sx, sy, 30, 0, Math.PI * 2); c.fill();
    })();

    // Soft vignette, painted once.
    const vignetteCanvas = document.createElement("canvas");
    vignetteCanvas.width = W; vignetteCanvas.height = H;
    (function paintVignette() {
        const c = vignetteCanvas.getContext("2d");
        const g = c.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
        g.addColorStop(0, "rgba(30,50,70,0)");
        g.addColorStop(1, "rgba(24,42,60,0.32)");
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);
    })();

    // Distant icebergs (parallax layer), generated once.
    const bergs = [];
    (function makeBergs() {
        const r = rng(21);
        for (let i = 0; i < 12; i++) {
            const bx = i * 310 + r() * 120;
            const bw = 130 + r() * 130;
            const peak = 290 + r() * 90;
            bergs.push({
                x: bx, w: bw, peak,
                mid: 0.35 + r() * 0.3,
                notch: 0.5 + r() * 0.3,
            });
        }
    })();

    // Ice terrain, pre-painted per level with wobbly painterly edges.
    function paintTerrain(idx) {
        terrainCanvas = document.createElement("canvas");
        terrainCanvas.width = level.width;
        terrainCanvas.height = H;
        const c = terrainCanvas.getContext("2d");
        const r = rng(4200 + idx);

        for (const p of level.platforms) {
            // Body with jittered outline
            const g = c.createLinearGradient(0, p.y, 0, p.y + p.h + 14);
            g.addColorStop(0, "#d8ebf4");
            g.addColorStop(0.5, "#b3d2e4");
            g.addColorStop(1, "#88afc9");
            c.fillStyle = g;
            c.beginPath();
            c.moveTo(p.x + (r() - 0.5) * 4, p.y + (r() - 0.5) * 3);
            for (let x = p.x + 24; x < p.x + p.w; x += 24) {
                c.lineTo(x, p.y + (r() - 0.5) * 3.5);
            }
            c.lineTo(p.x + p.w + (r() - 0.5) * 5, p.y + (r() - 0.5) * 3);
            c.lineTo(p.x + p.w + (r() - 0.5) * 8, p.y + p.h * 0.5);
            c.lineTo(p.x + p.w + (r() - 0.5) * 6, p.y + p.h + (r() - 0.5) * 4);
            c.lineTo(p.x + (r() - 0.5) * 6, p.y + p.h + (r() - 0.5) * 4);
            c.lineTo(p.x + (r() - 0.5) * 8, p.y + p.h * 0.5);
            c.closePath();
            c.fill();

            // Cool shadow along the waterline
            c.fillStyle = "rgba(74, 112, 142, 0.35)";
            c.fillRect(p.x, p.y + p.h - 7, p.w, 7);

            // Snow cap: overlapping soft dabs
            for (let x = p.x - 4; x < p.x + p.w + 4; x += 16) {
                const rx = 12 + r() * 12;
                c.fillStyle = `rgba(255,255,255,${0.75 + r() * 0.25})`;
                c.beginPath();
                c.ellipse(x + r() * 8, p.y + 2.5 + (r() - 0.5) * 2.5, rx, 4.5 + r() * 2.5, (r() - 0.5) * 0.2, 0, Math.PI * 2);
                c.fill();
            }

            // Blue texture strokes in the ice
            const strokes = Math.max(3, p.w / 20 | 0);
            for (let i = 0; i < strokes; i++) {
                const sx = p.x + 8 + r() * (p.w - 16);
                const sy = p.y + 10 + r() * Math.max(4, p.h - 16);
                c.strokeStyle = `rgba(120, 160, 190, ${0.12 + r() * 0.14})`;
                c.lineWidth = 1.5 + r() * 2;
                c.beginPath();
                c.moveTo(sx, sy);
                c.lineTo(sx + 8 + r() * 16, sy + (r() - 0.5) * 6);
                c.stroke();
            }

            // Icicles under thin floating floes
            if (p.h <= 20) {
                const n = 2 + (r() * 3 | 0);
                for (let i = 0; i < n; i++) {
                    const ix = p.x + 10 + r() * (p.w - 20);
                    const il = 6 + r() * 12;
                    c.fillStyle = "rgba(190, 220, 240, 0.8)";
                    c.beginPath();
                    c.moveTo(ix - 3, p.y + p.h);
                    c.lineTo(ix, p.y + p.h + il);
                    c.lineTo(ix + 3, p.y + p.h);
                    c.closePath();
                    c.fill();
                }
            }
        }
    }

    function drawBergs() {
        const parallax = cameraX * 0.4;
        for (const b of bergs) {
            const bx = ((b.x - parallax) % 3800 + 3800) % 3800 - 300;
            if (bx > W + 200) continue;
            ctx.fillStyle = "rgba(240, 249, 253, 0.85)";
            ctx.beginPath();
            ctx.moveTo(bx, 448);
            ctx.lineTo(bx + b.w * b.mid * 0.6, b.peak + 40);
            ctx.lineTo(bx + b.w * b.mid, b.peak);
            ctx.lineTo(bx + b.w * b.notch, b.peak + 26);
            ctx.lineTo(bx + b.w * 0.8, b.peak + 14);
            ctx.lineTo(bx + b.w, 448);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "rgba(168, 205, 230, 0.55)";
            ctx.beginPath();
            ctx.moveTo(bx + b.w * b.mid, b.peak);
            ctx.lineTo(bx + b.w, 448);
            ctx.lineTo(bx + b.w * 0.55, 448);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawWaterBase(time) {
        const x0 = cameraX - 20, x1 = cameraX + W + 20;
        const g = ctx.createLinearGradient(0, WATER_TOP, 0, H);
        g.addColorStop(0, "#4187ae");
        g.addColorStop(1, "#123c5c");
        ctx.fillStyle = g;
        ctx.fillRect(x0, WATER_TOP, x1 - x0, H - WATER_TOP);
    }

    function drawWaterOverlay(time) {
        const x0 = cameraX - 20, x1 = cameraX + W + 20;
        // Murky translucent layer — submerged hunters show through as shadows
        ctx.fillStyle = "rgba(21, 74, 108, 0.55)";
        ctx.fillRect(x0, WATER_TOP, x1 - x0, H - WATER_TOP);

        // Wave crest along the waterline
        ctx.strokeStyle = "rgba(236, 248, 252, 0.65)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = x0; x <= x1; x += 14) {
            const y = WATER_TOP + Math.sin(x * 0.045 + time * 2.2) * 2.6;
            x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Lighter painterly wave bands
        for (let b = 0; b < 2; b++) {
            ctx.fillStyle = `rgba(126, 184, 212, ${0.18 - b * 0.06})`;
            ctx.beginPath();
            const base = WATER_TOP + 7 + b * 8;
            ctx.moveTo(x0, base);
            for (let x = x0; x <= x1; x += 22) {
                ctx.lineTo(x, base + Math.sin(x * 0.04 + time * (1.6 + b * 0.5) + b * 2) * 3);
            }
            ctx.lineTo(x1, base + 7);
            ctx.lineTo(x0, base + 7);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawSplashes() {
        for (const s of splashes) {
            const prog = s.t / 0.7;
            const a = 0.85 * (1 - prog);
            for (let i = 0; i < 6; i++) {
                const dx = (i - 2.5) * 9 * s.scale;
                const rise = Math.sin(Math.min(prog * 1.3, 1) * Math.PI) * (26 + (i % 3) * 8) * s.scale;
                ell(s.x + dx, WATER_TOP - rise, (4.5 - prog * 3) * s.scale, (3.5 - prog * 2.4) * s.scale, 0, "#eef8fc", a);
            }
        }
    }

    function drawPenguin(p) {
        const f = p.facing;
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        // tail
        ell(cx - f * 10, cy + 7, 8, 12, f * 0.5, "#16202b", 0.9);
        // body
        ell(cx, cy, p.w / 2, p.h / 2, f * 0.06, "#1d2836");
        ell(cx - f * 4, cy - 6, p.w / 2 - 6, p.h / 2 - 9, f * 0.16, "#3c516b", 0.45);
        // belly
        ell(cx + f * 3.5, cy + 5, p.w / 3, p.h / 3 + 2, 0, "#f3efe3", 0.95);
        ell(cx + f * 3, cy + 3, p.w / 4, p.h / 4, 0, "#fffdf4", 0.7);
        // emperor-penguin cheek patch
        ell(cx + f * 6, p.y + 12, 4.5, 6.5, f * 0.4, "#f0bd53", 0.85);
        // flipper
        ell(cx - f * 9, cy + 1, 4.5, 13, f * 0.28, "#131c26", 0.95);
        // eye
        const ex = cx + f * 7;
        ell(ex, p.y + 9, 2.2, 2.2, 0, "#0b1016");
        ell(ex + f * 0.7, p.y + 8.4, 0.8, 0.8, 0, "#e8eef2", 0.9);
        // beak
        ctx.fillStyle = "#d98a3d";
        const bx = f === 1 ? p.x + p.w - 3 : p.x + 3;
        ctx.beginPath();
        ctx.moveTo(bx, p.y + 12);
        ctx.lineTo(bx + f * 10, p.y + 15.5);
        ctx.lineTo(bx, p.y + 17.5);
        ctx.closePath();
        ctx.fill();
        // feet
        ctx.fillStyle = "#cf8b45";
        ctx.beginPath(); ctx.ellipse(p.x + 8, p.y + p.h - 2, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(p.x + p.w - 8, p.y + p.h - 2, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
    }

    function drawJaws(hx, hy, d, size, bodyColor) {
        // open jaws with pink mouth and teeth
        ctx.fillStyle = "#b95f6e";
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + d * size * 1.6, hy - size);
        ctx.lineTo(hx + d * size * 1.6, hy + size);
        ctx.closePath();
        ctx.fill();
        ell(hx + d * size * 0.9, hy - size * 0.75, size * 0.85, size * 0.4, d * 0.35, bodyColor);
        ell(hx + d * size * 0.85, hy + size * 0.75, size * 0.8, size * 0.35, -d * 0.3, bodyColor);
        ctx.fillStyle = "#f4f8f9";
        for (let i = 0; i < 4; i++) {
            const tx = hx + d * (size * 0.5 + i * size * 0.3);
            ctx.beginPath();
            ctx.moveTo(tx, hy - size * 0.45);
            ctx.lineTo(tx + d * size * 0.12, hy - size * 0.05);
            ctx.lineTo(tx + d * size * 0.24, hy - size * 0.45);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawSeal(e) {
        const d = e.dir, cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        const open = e.mode === "lunge" || e.mode === "carry";
        // rear flippers
        const tx = d === 1 ? e.x + 5 : e.x + e.w - 5;
        ctx.fillStyle = "#7c8d9b";
        ctx.beginPath();
        ctx.moveTo(tx, cy);
        ctx.lineTo(tx - d * 15, cy - 11);
        ctx.lineTo(tx - d * 13, cy + 12);
        ctx.closePath();
        ctx.fill();
        // sinuous body
        ell(cx, cy, e.w / 2, e.h / 2, d * 0.04, "#8b9dab");
        ell(cx, cy - e.h * 0.16, e.w / 2 * 0.9, e.h / 2 * 0.6, d * 0.04, "#5f7488", 0.8);
        ell(cx, cy + e.h * 0.2, e.w / 2 * 0.72, e.h / 2 * 0.45, 0, "#cbd5dc", 0.85);
        // leopard spots
        for (let i = 0; i < 9; i++) {
            ell(e.x + e.w * (0.16 + i * 0.078), cy + ((i % 3) - 1) * 5.5, 2.6, 1.8, 0.6, "#43556a", 0.5);
        }
        // fore flipper
        ell(cx - d * e.w * 0.06, cy + e.h * 0.34, 10, 4.5, d * 0.5, "#5c7083", 0.9);
        // head (leopard seals have a big reptilian head)
        const hx = d === 1 ? e.x + e.w - 12 : e.x + 12;
        const hy = e.y + e.h * 0.26;
        ell(hx, hy, 13.5, 10.5, 0, "#8b9dab");
        ell(hx, hy - 4, 11, 5.5, 0, "#5f7488", 0.6);
        if (open) {
            drawJaws(hx + d * 6, hy + 1, d, 11, "#8b9dab");
        } else {
            ell(hx + d * 11, hy + 2, 7.5, 4.5, 0, "#98a8b4");
            ctx.fillStyle = "#33414e";
            ctx.beginPath(); ctx.arc(hx + d * 17, hy + 1, 1.3, 0, Math.PI * 2); ctx.fill();
        }
        // eye
        ell(hx + d * 4, hy - 3.5, 2, 2, 0, "#101820");
    }

    function drawShark(e) {
        const d = e.dir, cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        const open = e.mode === "lunge" || e.mode === "carry";
        // tail fin
        const tx = d === 1 ? e.x + 6 : e.x + e.w - 6;
        ctx.fillStyle = "#54687c";
        ctx.beginPath();
        ctx.moveTo(tx, cy);
        ctx.lineTo(tx - d * 22, cy - e.h * 0.62);
        ctx.lineTo(tx - d * 10, cy);
        ctx.lineTo(tx - d * 18, cy + e.h * 0.42);
        ctx.closePath();
        ctx.fill();
        // torpedo body
        ell(cx, cy, e.w / 2, e.h / 2 * 0.82, d * 0.05, "#75899b");
        ell(cx, cy - e.h * 0.14, e.w / 2 * 0.92, e.h / 2 * 0.5, d * 0.05, "#4e6274", 0.85);
        ell(cx + d * e.w * 0.06, cy + e.h * 0.18, e.w / 2 * 0.78, e.h / 2 * 0.4, 0, "#dde6ec", 0.9);
        // dorsal fin
        ctx.fillStyle = "#4e6274";
        ctx.beginPath();
        ctx.moveTo(cx - d * e.w * 0.02, e.y + e.h * 0.14);
        ctx.lineTo(cx - d * e.w * 0.14, e.y - e.h * 0.42);
        ctx.lineTo(cx - d * e.w * 0.26, e.y + e.h * 0.2);
        ctx.closePath();
        ctx.fill();
        // pectoral fin
        ell(cx - d * e.w * 0.04, cy + e.h * 0.34, 14, 5.5, d * 0.55, "#5d7284", 0.9);
        // gill slits
        ctx.strokeStyle = "rgba(40, 56, 70, 0.55)";
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 3; i++) {
            const gx = cx + d * (e.w * 0.2 - i * 7);
            ctx.beginPath();
            ctx.arc(gx, cy - 2, 8, d === 1 ? -0.5 : Math.PI - 0.7, d === 1 ? 0.7 : Math.PI + 0.5);
            ctx.stroke();
        }
        // head + jaws
        const hx = d === 1 ? e.x + e.w - 14 : e.x + 14;
        const hy = cy - e.h * 0.05;
        if (open) {
            drawJaws(hx, hy + e.h * 0.12, d, 14, "#75899b");
        } else {
            ctx.strokeStyle = "rgba(30, 44, 56, 0.7)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(hx + d * 2, hy + e.h * 0.22);
            ctx.lineTo(hx + d * 11, hy + e.h * 0.14);
            ctx.stroke();
        }
        // eye
        ell(hx - d * 2, hy - e.h * 0.16, 2.6, 2.6, 0, "#0d1319");
    }

    function drawOrca(e) {
        const d = e.dir, cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        const open = e.mode === "lunge" || e.mode === "carry";
        // tail flukes
        const tx = d === 1 ? e.x + 8 : e.x + e.w - 8;
        ctx.fillStyle = "#0e141d";
        ctx.beginPath();
        ctx.moveTo(tx, cy);
        ctx.lineTo(tx - d * 30, cy - e.h * 0.42);
        ctx.lineTo(tx - d * 14, cy + 2);
        ctx.lineTo(tx - d * 30, cy + e.h * 0.42);
        ctx.closePath();
        ctx.fill();
        // body
        ell(cx, cy, e.w / 2, e.h / 2 * 0.88, d * 0.04, "#10161f");
        ell(cx, cy - e.h * 0.16, e.w / 2 * 0.9, e.h / 2 * 0.5, d * 0.04, "#2a3646", 0.6);
        // white belly and flank patch
        ell(cx + d * e.w * 0.05, cy + e.h * 0.26, e.w / 2 * 0.72, e.h / 2 * 0.34, 0, "#eef3f6", 0.95);
        ell(cx - d * e.w * 0.1, cy + e.h * 0.1, e.w * 0.09, e.h * 0.16, d * 0.9, "#e7edf1", 0.85);
        // tall dorsal fin
        ctx.fillStyle = "#0e141d";
        ctx.beginPath();
        ctx.moveTo(cx - d * e.w * 0.02, e.y + e.h * 0.1);
        ctx.quadraticCurveTo(cx - d * e.w * 0.1, e.y - e.h * 0.75, cx - d * e.w * 0.16, e.y - e.h * 0.25);
        ctx.lineTo(cx - d * e.w * 0.22, e.y + e.h * 0.16);
        ctx.closePath();
        ctx.fill();
        // pectoral paddle
        ell(cx + d * e.w * 0.02, cy + e.h * 0.4, 18, 8, d * 0.6, "#10161f");
        // head + jaws
        const hx = d === 1 ? e.x + e.w - 20 : e.x + 20;
        const hy = cy - e.h * 0.02;
        // white eye patch
        ell(hx - d * 6, hy - e.h * 0.22, 8.5, 4.5, d * 0.45, "#eef3f6", 0.95);
        if (open) {
            drawJaws(hx + d * 2, hy + e.h * 0.12, d, 18, "#10161f");
        } else {
            ctx.strokeStyle = "rgba(210, 222, 230, 0.35)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(hx + d * 4, hy + e.h * 0.2);
            ctx.lineTo(hx + d * 16, hy + e.h * 0.12);
            ctx.stroke();
        }
        // eye
        ell(hx - d * 2, hy - e.h * 0.12, 2.4, 2.4, 0, "#05080c");
    }

    const enemyPainters = { seal: drawSeal, orca: drawOrca, shark: drawShark };

    function drawEnemies() {
        for (const e of level.enemies) {
            if (e.mode === "gone") continue;
            if (e.x + e.w < cameraX - 60 || e.x > cameraX + W + 60) continue;
            (enemyPainters[e.type] || drawSeal)(e);
        }
    }

    function drawFish(c) {
        ell(c.x + 8, c.y + 10, 8.5, 5, 0.05, "#e08a3c");
        ell(c.x + 7, c.y + 8.5, 6, 3, 0.05, "#f2b168", 0.8);
        ctx.fillStyle = "#c9762f";
        ctx.beginPath();
        ctx.moveTo(c.x + 15, c.y + 10);
        ctx.lineTo(c.x + 21, c.y + 4.5);
        ctx.lineTo(c.x + 21, c.y + 15.5);
        ctx.closePath();
        ctx.fill();
        ell(c.x + 4, c.y + 9, 1.4, 1.4, 0, "#5c3210");
    }

    function drawGoal(time) {
        const g = level.goal;
        const px = g.x + g.w / 2;
        ctx.strokeStyle = "#5b6b78";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(px, g.y + g.h);
        ctx.quadraticCurveTo(px - 2, g.y + g.h / 2, px, g.y);
        ctx.stroke();
        // waving painterly flag
        const wave = Math.sin(time * 3) * 4;
        ctx.fillStyle = "#c8452f";
        ctx.beginPath();
        ctx.moveTo(px + 2, g.y);
        ctx.quadraticCurveTo(px + 24, g.y + 6 + wave, px + 40, g.y + 14 + wave);
        ctx.quadraticCurveTo(px + 22, g.y + 20 + wave * 0.5, px + 2, g.y + 28);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255, 200, 180, 0.35)";
        ctx.beginPath();
        ctx.moveTo(px + 2, g.y + 4);
        ctx.quadraticCurveTo(px + 20, g.y + 9 + wave, px + 32, g.y + 13 + wave);
        ctx.quadraticCurveTo(px + 18, g.y + 15, px + 2, g.y + 18);
        ctx.closePath();
        ctx.fill();
    }

    // Soft snowflake sprite
    const flake = document.createElement("canvas");
    flake.width = 12; flake.height = 12;
    (function paintFlake() {
        const c = flake.getContext("2d");
        const g = c.createRadialGradient(6, 6, 0.5, 6, 6, 6);
        g.addColorStop(0, "rgba(255,255,255,0.95)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, 12, 12);
    })();

    function render() {
        const time = performance.now() / 1000;
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(skyCanvas, 0, 0);

        if (!level) return;

        drawBergs();

        ctx.save();
        ctx.translate(-cameraX, 0);

        drawWaterBase(time);

        // Hunters (and a dragged penguin) live below the murky overlay,
        // so submerged bodies show through as looming shadows.
        drawEnemies();
        if (state === "caught") drawPenguin(player);

        drawWaterOverlay(time);
        drawSplashes();

        // Ice terrain
        const sx = Math.max(0, Math.min(cameraX, level.width - W));
        ctx.drawImage(terrainCanvas, sx, 0, W, H, sx, 0, W, H);

        for (const c of level.coins) {
            if (!c.collected) drawFish(c);
        }

        drawGoal(time);

        if (state !== "caught") {
            if (invincibleTimer <= 0 || Math.floor(invincibleTimer * 10) % 2 === 0) {
                drawPenguin(player);
            }
        }

        ctx.restore();

        // Falling snow (screen space)
        for (let i = 0; i < 46; i++) {
            const fx = (((i * 97 + Math.sin(time * 0.7 + i) * 30) % W) + W) % W;
            const fy = (i * 53 + time * (22 + (i % 4) * 12)) % H;
            const s = 5 + (i % 3) * 3;
            ctx.drawImage(flake, fx, fy, s, s);
        }

        ctx.drawImage(vignetteCanvas, 0, 0);
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
