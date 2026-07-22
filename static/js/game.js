(() => {
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const CFG = window.GAME_CONFIG;

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
    let pal = null;

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

    // Seedable 2D simplex noise (Gustavson/Wagner style) for organic silhouettes.
    function makeNoise2D(seed) {
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        const rand = rng(seed);
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            const t = p[i]; p[i] = p[j]; p[j] = t;
        }
        const perm = new Uint8Array(512);
        const permMod12 = new Uint8Array(512);
        for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; permMod12[i] = perm[i] % 12; }
        const g3 = [1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1];
        const F2 = 0.5 * (Math.sqrt(3) - 1);
        const G2 = (3 - Math.sqrt(3)) / 6;
        return function (xin, yin) {
            let n0 = 0, n1 = 0, n2 = 0;
            const s = (xin + yin) * F2;
            const i = Math.floor(xin + s);
            const j = Math.floor(yin + s);
            const t = (i + j) * G2;
            const x0 = xin - (i - t);
            const y0 = yin - (j - t);
            let i1, j1;
            if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
            const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
            const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
            const ii = i & 255, jj = j & 255;
            let t0 = 0.5 - x0 * x0 - y0 * y0;
            if (t0 >= 0) { t0 *= t0; const gi = permMod12[ii + perm[jj]] * 3; n0 = t0 * t0 * (g3[gi] * x0 + g3[gi + 1] * y0); }
            let t1 = 0.5 - x1 * x1 - y1 * y1;
            if (t1 >= 0) { t1 *= t1; const gi = permMod12[ii + i1 + perm[jj + j1]] * 3; n1 = t1 * t1 * (g3[gi] * x1 + g3[gi + 1] * y1); }
            let t2 = 0.5 - x2 * x2 - y2 * y2;
            if (t2 >= 0) { t2 *= t2; const gi = permMod12[ii + 1 + perm[jj + 1]] * 3; n2 = t2 * t2 * (g3[gi] * x2 + g3[gi + 1] * y2); }
            return 70 * (n0 + n1 + n2);
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

    // ======================================================================
    //  Time-of-day palette system (config-driven, coupled to the clock)
    // ======================================================================
    const PALETTE_KEYS = CFG.palettes;

    function lerp(a, b, t) { return a + (b - a) * t; }
    function lerpRGB(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
    function rgb(c, a) {
        return a === undefined
            ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
            : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
    }

    function currentHour() {
        if (typeof window.__hourOverride === "number") return window.__hourOverride;
        const d = new Date();
        return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    }

    function samplePalette(hour) {
        const K = PALETTE_KEYS;
        let a = K[0], b = K[0], t = 0;
        for (let i = 0; i < K.length; i++) {
            const cur = K[i], nxt = K[(i + 1) % K.length];
            let h0 = cur.h, h1 = nxt.h; if (h1 <= h0) h1 += 24;
            let hh = hour; if (hh < h0) hh += 24;
            if (hh >= h0 && hh <= h1) { a = cur; b = nxt; t = (hh - h0) / (h1 - h0); break; }
        }
        const ts = t * t * (3 - 2 * t); // smoothstep — no hard jumps
        return {
            sky: a.sky.map((s, i) => [s[0], lerpRGB(s[1], b.sky[i][1], ts)]),
            ice: lerpRGB(a.ice, b.ice, ts),
            iceShadow: lerpRGB(a.iceShadow, b.iceShadow, ts),
            iceLight: lerpRGB(a.iceLight, b.iceLight, ts),
            light: lerpRGB(a.light, b.light, ts),
            fog: lerpRGB(a.fog, b.fog, ts),
            particle: lerpRGB(a.particle, b.particle, ts),
            water: [lerpRGB(a.water[0], b.water[0], ts), lerpRGB(a.water[1], b.water[1], ts)],
            accent: lerpRGB(a.accent, b.accent, ts),
        };
    }

    // Sun / crescent moon arcing across the sky with the clock.
    function skyBody(hour) {
        const ds = CFG.body.dayStart, de = CFG.body.dayEnd;
        const dayLen = de - ds, nightLen = 24 - dayLen;
        const isDay = hour >= ds && hour < de;
        const frac = isDay ? (hour - ds) / dayLen : (((hour - de) + 24) % 24) / nightLen;
        const alt = Math.sin(frac * Math.PI);
        return { x: 40 + frac * (W - 80), y: 300 - alt * 240, alt, isDay, frac };
    }

    function starAlpha(h) {
        if (h >= 20 || h < 5) return 1;
        if (h >= 5 && h < 7) return (7 - h) / 2;
        if (h >= 18 && h < 20) return (h - 18) / 2;
        return 0;
    }

    // ======================================================================
    //  Painterly rendering
    // ======================================================================
    function ell(x, y, rx, ry, rot, fill, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.ellipse(x, y, Math.max(rx, 0.5), Math.max(ry, 0.5), rot, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // ---- Noise-based iceberg / mountain silhouettes (unique seed each) ------
    function makeBergShape(seed, opt, scale) {
        opt = opt || {}; scale = scale || 1;
        const n = makeNoise2D(seed);
        const r = rng(seed * 131 + 7);
        const w = lerp(opt.wMin != null ? opt.wMin : 110, opt.wMax != null ? opt.wMax : 290, r()) * scale;
        const h = lerp(opt.hMin != null ? opt.hMin : 80, opt.hMax != null ? opt.hMax : 220, r()) * scale;
        const peakX = lerp(opt.peakMin != null ? opt.peakMin : 0.28, opt.peakMax != null ? opt.peakMax : 0.72, r());
        const jag = lerp(opt.jagMin != null ? opt.jagMin : 0.10, opt.jagMax != null ? opt.jagMax : 0.28, r());
        const segs = 16 + (r() * 10 | 0);
        const pts = [{ x: 0, y: 0 }];
        for (let i = 1; i < segs; i++) {
            const fx = i / segs;
            const tri = fx < peakX ? fx / peakX : 1 - (fx - peakX) / (1 - peakX);
            let y = -h * Math.pow(Math.max(tri, 0), 0.85);
            y += n(fx * 4.0, seed * 0.01) * h * jag;
            y += n(fx * 12.0, 3) * h * jag * 0.4;
            y = Math.min(y, -2);
            const x = fx * w + n(fx * 6, 7) * 7;
            pts.push({ x, y });
        }
        pts.push({ x: w, y: 0 });
        return { w, h, pts };
    }

    // Paint a silhouette to its own sprite in NEUTRAL ice tones with brush
    // strokes — baked once, then cheaply re-tinted per palette bucket.
    function paintBerg(shape, seed) {
        const pad = 12;
        const cw = Math.ceil(shape.w) + pad * 2;
        const ch = Math.ceil(shape.h) + pad * 2;
        const cvs = document.createElement("canvas");
        cvs.width = cw; cvs.height = ch;
        const c = cvs.getContext("2d");
        const baseY = ch - pad;
        const r = rng(seed * 17 + 3);

        c.beginPath();
        c.moveTo(pad + shape.pts[0].x, baseY + shape.pts[0].y);
        for (const p of shape.pts) c.lineTo(pad + p.x, baseY + p.y);
        c.closePath();
        c.save();
        c.clip();

        const g = c.createLinearGradient(0, baseY - shape.h, 0, baseY);
        g.addColorStop(0, "#f2f7fb");
        g.addColorStop(0.55, "#d6e6f0");
        g.addColorStop(1, "#a8c6da");
        c.fillStyle = g;
        c.fillRect(0, 0, cw, ch);

        const count = Math.max(120, shape.w * 0.9 | 0);
        for (let i = 0; i < count; i++) {
            const bx = pad + r() * shape.w;
            const by = baseY - r() * shape.h;
            const sh = r();
            const tone = sh < 0.5 ? [255, 255, 255] : (sh < 0.8 ? [198, 222, 236] : [150, 184, 208]);
            c.globalAlpha = 0.05 + r() * 0.09;
            c.fillStyle = `rgb(${tone[0]},${tone[1]},${tone[2]})`;
            c.save();
            c.translate(bx, by);
            c.rotate((r() - 0.5) * 1.2);
            c.beginPath();
            c.ellipse(0, 0, 6 + r() * 14, 1.5 + r() * 2.5, 0, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }
        c.globalAlpha = 1;
        c.restore();

        c.strokeStyle = "rgba(255,255,255,0.5)";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(pad + shape.pts[0].x, baseY + shape.pts[0].y);
        for (const p of shape.pts) c.lineTo(pad + p.x, baseY + p.y);
        c.stroke();

        return { cvs, pad, baseY };
    }

    // Tint a neutral sprite for atmospheric perspective: wash toward the
    // palette ice/fog colour, blur for distance. Cached per palette bucket.
    function tintSprite(neu, tier, p) {
        const s = neu.cvs, cw = s.width, ch = s.height;
        const c = document.createElement("canvas");
        c.width = cw; c.height = ch;
        const g = c.getContext("2d");
        if (tier.blur > 0) g.filter = `blur(${tier.blur}px)`;
        g.drawImage(s, 0, 0);
        g.filter = "none";
        g.globalCompositeOperation = "source-atop";
        const grad = g.createLinearGradient(0, 0, 0, ch);
        grad.addColorStop(0, rgb(p.iceLight));
        grad.addColorStop(1, rgb(p.ice));
        g.globalAlpha = 0.5;
        g.fillStyle = grad;
        g.fillRect(0, 0, cw, ch);
        if (tier.haze > 0) {
            g.globalAlpha = tier.haze;
            g.fillStyle = rgb(p.fog);
            g.fillRect(0, 0, cw, ch);
        }
        if (tier.darken) {
            g.globalAlpha = tier.darken;
            g.fillStyle = rgb(p.iceShadow);
            g.fillRect(0, 0, cw, ch);
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
        return { cvs: c, pad: neu.pad, baseY: neu.baseY };
    }

    // Build the depth tiers once (neutral sprites + instance placement).
    const tiers = CFG.tiers.map(def => {
        const r = rng((def.seedBase || 1000) + 91);
        const instances = [];
        for (let i = 0; i < def.count; i++) {
            const seed = (def.seedBase || 1000) + i * 13;
            const shape = makeBergShape(seed, def.shape, def.sizeScale);
            const neutral = paintBerg(shape, seed);
            instances.push({
                x: i * def.spacing + r() * def.spacing * 0.4,
                base: def.baseY + (r() - 0.5) * 2 * def.jitterY,
                phase: r() * Math.PI * 2,
                neutral, tinted: null,
            });
        }
        return Object.assign({}, def, { instances, span: def.count * def.spacing });
    });

    // Re-tint cached tiers only when the palette bucket changes (or on resize).
    let lastTintSig = null;
    function ensureTint(p, hour) {
        const sig = Math.floor(hour * (60 / (CFG.retintMinutes || 10)));
        if (sig === lastTintSig) return;
        lastTintSig = sig;
        for (const tier of tiers) {
            for (const inst of tier.instances) inst.tinted = tintSprite(inst.neutral, tier, p);
        }
        buildSky(p);
        buildVignette(p);
    }

    function drawTier(tier, time) {
        const parallax = cameraX * tier.parallax;
        const span = tier.span;
        for (const inst of tier.instances) {
            if (!inst.tinted) continue;
            const bx = ((inst.x - parallax) % span + span) % span - 340;
            if (bx > W + 320 || bx < -380) continue;
            const bob = tier.bob ? Math.sin(time * 0.5 + inst.phase) * tier.bob : 0;
            const t = inst.tinted;
            ctx.save();
            if (tier.alpha != null) ctx.globalAlpha = tier.alpha;
            ctx.drawImage(t.cvs, bx - t.pad, inst.base - t.baseY + bob);
            ctx.restore();
        }
    }

    // ---- Sky, sun/moon, stars, noise-edged clouds --------------------------
    const skyStrokes = [];
    (function makeSkyStrokes() {
        const r = rng(555);
        for (let i = 0; i < 80; i++) {
            skyStrokes.push({
                x: r() * W, y: r() * (WATER_TOP - 40),
                len: 60 + r() * 240, th: 4 + r() * 16,
                rot: (r() - 0.5) * 0.12, tone: r(), a: 0.05 + r() * 0.08,
            });
        }
    })();

    const stars = [];
    (function makeStars() {
        const r = rng(909);
        for (let i = 0; i < 70; i++) {
            stars.push({ x: r() * W, y: r() * (WATER_TOP - 120), s: 0.6 + r() * 1.4, tw: r() * Math.PI * 2 });
        }
    })();

    const clouds = [];
    (function makeClouds() {
        const r = rng(333);
        for (let i = 0; i < 5; i++) {
            const seed = 400 + i * 9;
            const n = makeNoise2D(seed);
            const cw = 120 + r() * 160;
            const chh = 26 + r() * 26;
            const puffs = [];
            const count = 10 + (r() * 6 | 0);
            for (let k = 0; k < count; k++) {
                const fx = k / (count - 1);
                const arch = Math.sin(fx * Math.PI);
                puffs.push({
                    dx: (fx - 0.5) * cw,
                    dy: -arch * chh * (0.5 + n(fx * 3, 0) * 0.4),
                    rx: 16 + arch * 26 + n(fx * 5, 2) * 10,
                    ry: 10 + arch * 14,
                });
            }
            clouds.push({ x: r() * 2400, y: 90 + r() * 150, puffs, speed: 4 + r() * 6 });
        }
    })();

    // Static sky (gradient + painterly strokes) — baked once per palette
    // bucket to an offscreen canvas, then blitted each frame.
    const skyCanvas = document.createElement("canvas");
    skyCanvas.width = W; skyCanvas.height = H;
    const skyCtx = skyCanvas.getContext("2d");
    function buildSky(p) {
        const c = skyCtx;
        c.clearRect(0, 0, W, H);
        const g = c.createLinearGradient(0, 0, 0, WATER_TOP);
        for (const s of p.sky) g.addColorStop(s[0], rgb(s[1]));
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);
        for (const s of skyStrokes) {
            const col = lerpRGB(p.fog, p.light, s.tone);
            c.save();
            c.globalAlpha = s.a;
            c.fillStyle = rgb(col);
            c.translate(s.x, s.y);
            c.rotate(s.rot);
            c.beginPath();
            c.ellipse(0, 0, s.len / 2, s.th / 2, 0, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }
    }

    function drawBody(p, body) {
        const { x, y, alt, isDay } = body;
        const col = isDay ? p.accent : [232, 238, 252];
        const R = isDay ? 24 + (1 - alt) * 12 : 20;
        const halo = ctx.createRadialGradient(x, y, 2, x, y, R * 4.2);
        halo.addColorStop(0, rgb(col, 0.5));
        halo.addColorStop(1, rgb(col, 0));
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(x, y, R * 4.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgb(col, 0.96);
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
        if (!isDay) {
            ctx.fillStyle = rgb(p.sky[0][1]);
            ctx.beginPath(); ctx.arc(x + R * 0.45, y - R * 0.3, R * 0.92, 0, Math.PI * 2); ctx.fill();
        }
    }

    function drawStars(hour, time) {
        const a = starAlpha(hour);
        if (a <= 0) return;
        ctx.fillStyle = "#ffffff";
        for (const st of stars) {
            const tw = 0.55 + 0.45 * Math.sin(time * 2 + st.tw);
            ctx.globalAlpha = a * tw * 0.9;
            ctx.beginPath();
            ctx.arc(st.x, st.y, st.s, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawClouds(p, time) {
        const col = lerpRGB(p.fog, p.particle, 0.5);
        for (const cl of clouds) {
            const parallax = cameraX * 0.22;
            const cx = ((cl.x - time * cl.speed - parallax) % 2600 + 2600) % 2600 - 400;
            if (cx > W + 260 || cx < -300) continue;
            for (let pass = 0; pass < 2; pass++) {
                ctx.globalAlpha = pass === 0 ? 0.16 : 0.1;
                ctx.fillStyle = rgb(pass === 0 ? col : p.light);
                for (const pf of cl.puffs) {
                    ctx.beginPath();
                    ctx.ellipse(cx + pf.dx, cl.y + pf.dy - pass * 3, pf.rx, pf.ry, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.globalAlpha = 1;
    }

    // ---- Drifting, pulsing fog bands between the planes --------------------
    function drawFogBand(fb, p, time) {
        const a = Math.max(0, fb.baseAlpha + Math.sin(time * fb.pulseSpeed) * fb.pulse);
        const g = ctx.createLinearGradient(0, fb.y, 0, fb.y + fb.h);
        g.addColorStop(0, rgb(p.fog, 0));
        g.addColorStop(0.5, rgb(p.fog, a));
        g.addColorStop(1, rgb(p.fog, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, fb.y, W, fb.h);

        ctx.globalAlpha = a * 0.8;
        ctx.fillStyle = rgb(p.fog);
        const wrap = W + 420;
        for (let k = 0; k < fb.puffs; k++) {
            const px = ((k * 220 - time * fb.drift) % wrap + wrap) % wrap - 210;
            const py = fb.y + fb.h * 0.5 + Math.sin(time * 0.3 + k) * 6;
            ctx.beginPath();
            ctx.ellipse(px, py, 120 + (k % 3) * 40, fb.h * 0.34, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ---- Ice terrain, noise-edged with painterly brush strokes -------------
    function paintTerrain(idx) {
        terrainCanvas = document.createElement("canvas");
        terrainCanvas.width = level.width;
        terrainCanvas.height = H;
        const c = terrainCanvas.getContext("2d");
        const r = rng(4200 + idx);
        const n = makeNoise2D(9001 + idx);

        for (const p of level.platforms) {
            const topPts = [];
            for (let x = p.x; x <= p.x + p.w; x += 8) {
                const e = n(x * 0.05, p.y * 0.01) * 3 + n(x * 0.15, 7) * 1.5;
                topPts.push({ x, y: p.y + e });
            }

            c.beginPath();
            c.moveTo(p.x, p.y + p.h);
            for (const tp of topPts) c.lineTo(tp.x, tp.y);
            c.lineTo(p.x + p.w, p.y + p.h);
            for (let x = p.x + p.w; x >= p.x; x -= 10) {
                c.lineTo(x, p.y + p.h + n(x * 0.06, 50) * 3);
            }
            c.closePath();
            c.save();
            c.clip();

            const g = c.createLinearGradient(0, p.y - 4, 0, p.y + p.h + 16);
            g.addColorStop(0, "#f4f9fc");
            g.addColorStop(0.5, "#d3e6f0");
            g.addColorStop(1, "#a4c4d8");
            c.fillStyle = g;
            c.fillRect(p.x - 6, p.y - 10, p.w + 12, p.h + 34);

            const strokes = Math.max(8, p.w / 8 | 0);
            for (let i = 0; i < strokes; i++) {
                const sx = p.x + r() * p.w;
                const sy = p.y + 2 + r() * Math.max(6, p.h);
                const sh = r();
                const tone = sh < 0.5 ? [255, 255, 255] : (sh < 0.8 ? [200, 222, 236] : [150, 184, 208]);
                c.globalAlpha = 0.05 + r() * 0.08;
                c.fillStyle = `rgb(${tone[0]},${tone[1]},${tone[2]})`;
                c.save();
                c.translate(sx, sy);
                c.rotate((r() - 0.5) * 0.8);
                c.beginPath();
                c.ellipse(0, 0, 5 + r() * 12, 1.4 + r() * 2, 0, 0, Math.PI * 2);
                c.fill();
                c.restore();
            }
            c.globalAlpha = 1;
            c.fillStyle = "rgba(70,104,134,0.32)";
            c.fillRect(p.x, p.y + p.h - 7, p.w, 7);
            c.restore();

            c.beginPath();
            c.moveTo(topPts[0].x, topPts[0].y + 1);
            for (const tp of topPts) {
                const s = 3 + (n(tp.x * 0.1, 20) + 1) * 3;
                c.lineTo(tp.x, tp.y - s);
            }
            for (let i = topPts.length - 1; i >= 0; i--) c.lineTo(topPts[i].x, topPts[i].y + 1);
            c.closePath();
            c.fillStyle = "rgba(255,255,255,0.95)";
            c.fill();

            if (p.h <= 20) {
                const cnt = 2 + (r() * 3 | 0);
                for (let i = 0; i < cnt; i++) {
                    const ix = p.x + 10 + r() * (p.w - 20);
                    const il = 6 + r() * 12;
                    c.fillStyle = "rgba(206,226,240,0.85)";
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

    // ---- Water (shimmering reflections) ------------------------------------
    function drawWaterBase(p) {
        const x0 = cameraX - 20, x1 = cameraX + W + 20;
        const g = ctx.createLinearGradient(0, WATER_TOP, 0, H);
        g.addColorStop(0, rgb(p.water[0]));
        g.addColorStop(1, rgb(p.water[1]));
        ctx.fillStyle = g;
        ctx.fillRect(x0, WATER_TOP, x1 - x0, H - WATER_TOP);
    }

    function drawWaterOverlay(p, time) {
        const x0 = cameraX - 20, x1 = cameraX + W + 20;
        ctx.fillStyle = rgb(p.water[1], 0.5);
        ctx.fillRect(x0, WATER_TOP, x1 - x0, H - WATER_TOP);

        ctx.strokeStyle = rgb(p.particle, 0.6);
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = x0; x <= x1; x += 14) {
            const y = WATER_TOP + Math.sin(x * 0.045 + time * 2.2) * 2.6;
            x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();

        for (let b = 0; b < 2; b++) {
            ctx.fillStyle = rgb(p.light, 0.14 - b * 0.05);
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

        // wandering specular glints
        ctx.fillStyle = rgb(p.light, 0.16);
        for (let i = 0; i < 5; i++) {
            const gx = x0 + ((i * 260 + time * 30) % (x1 - x0));
            const gy = WATER_TOP + 14 + (i % 3) * 10 + Math.sin(time * 1.5 + i) * 3;
            ctx.beginPath();
            ctx.ellipse(gx, gy, 22 + Math.sin(time + i) * 6, 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawSplashes(p) {
        for (const s of splashes) {
            const prog = s.t / 0.7;
            const a = 0.85 * (1 - prog);
            for (let i = 0; i < 6; i++) {
                const dx = (i - 2.5) * 9 * s.scale;
                const rise = Math.sin(Math.min(prog * 1.3, 1) * Math.PI) * (26 + (i % 3) * 8) * s.scale;
                ell(s.x + dx, WATER_TOP - rise, (4.5 - prog * 3) * s.scale, (3.5 - prog * 2.4) * s.scale, 0, rgb(p.particle), a);
            }
        }
    }

    // ---- Penguin: painterly + idle animation + rimlight + cast shadow ------
    function penguinScreenX(p) { return p.x - cameraX + p.w / 2; }

    function drawPenguinShadow(p, body) {
        if (!p.onGround) return;
        const groundY = p.y + p.h;
        const dir = body.x < penguinScreenX(p) ? 1 : -1; // opposite the light
        const stretch = 1 + (1 - Math.max(0, body.alt)) * 0.9;
        const a = 0.22 * Math.max(0.12, body.alt);
        ell(p.x + p.w / 2 + dir * 9, groundY + 3, p.w * 0.62 * stretch, 4.5, 0, rgb(pal.iceShadow), a);
        ell(p.x + p.w / 2 + dir * 9, groundY + 3, p.w * 0.4 * stretch, 3, 0, rgb(pal.iceShadow), a * 0.7);
    }

    function drawPenguin(p, time, body, plain) {
        const f = p.facing;
        const idle = !plain;
        let breathe = 0, wob = 0, blink = false;
        if (idle) {
            breathe = Math.sin(time * 2.2) * 0.5;
            const moving = Math.abs(p.vx) > 12;
            wob = (p.onGround && !moving) ? Math.sin(time * 1.6) * 0.03 : 0;
            blink = (time % 3.4) < 0.12;
        }

        ctx.save();
        if (idle) {
            const fx = p.x + p.w / 2, fy = p.y + p.h;
            ctx.translate(fx, fy);
            ctx.rotate(wob);
            ctx.scale(1, 1 - breathe * 0.006);
            ctx.translate(-fx, -fy);
        }

        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;

        // rimlight in the current light colour on the sun-facing side
        if (idle && body) {
            const dir = body.x < penguinScreenX(p) ? -1 : 1;
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = 0.16 * Math.max(0.25, body.alt);
            ctx.fillStyle = rgb(pal.light);
            ctx.beginPath();
            ctx.ellipse(cx + dir * 4, cy, p.w / 2, p.h / 2, f * 0.06, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ell(cx - f * 10, cy + 7, 8, 12, f * 0.5, "#16202b", 0.9);
        ell(cx, cy, p.w / 2, p.h / 2, f * 0.06, "#1d2836");
        ell(cx - f * 4, cy - 6, p.w / 2 - 6, p.h / 2 - 9, f * 0.16, "#3c516b", 0.45);
        ell(cx + f * 3.5, cy + 5, p.w / 3, p.h / 3 + 2, 0, "#f3efe3", 0.95);
        ell(cx + f * 3, cy + 3, p.w / 4, p.h / 4, 0, "#fffdf4", 0.7);
        ell(cx + f * 6, p.y + 12, 4.5, 6.5, f * 0.4, "#f0bd53", 0.85);
        ell(cx - f * 9, cy + 1, 4.5, 13, f * 0.28, "#131c26", 0.95);
        const ex = cx + f * 7;
        if (blink) {
            ctx.strokeStyle = "#0b1016";
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(ex - 2.4, p.y + 9);
            ctx.lineTo(ex + 2.4, p.y + 9);
            ctx.stroke();
        } else {
            ell(ex, p.y + 9, 2.2, 2.2, 0, "#0b1016");
            ell(ex + f * 0.7, p.y + 8.4, 0.8, 0.8, 0, "#e8eef2", 0.9);
        }
        ctx.fillStyle = "#d98a3d";
        const bx = f === 1 ? p.x + p.w - 3 : p.x + 3;
        ctx.beginPath();
        ctx.moveTo(bx, p.y + 12);
        ctx.lineTo(bx + f * 10, p.y + 15.5);
        ctx.lineTo(bx, p.y + 17.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#cf8b45";
        ctx.beginPath(); ctx.ellipse(p.x + 8, p.y + p.h - 2, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(p.x + p.w - 8, p.y + p.h - 2, 6, 3, 0, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }

    function drawJaws(hx, hy, d, size, bodyColor) {
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
        const tx = d === 1 ? e.x + 5 : e.x + e.w - 5;
        ctx.fillStyle = "#7c8d9b";
        ctx.beginPath();
        ctx.moveTo(tx, cy);
        ctx.lineTo(tx - d * 15, cy - 11);
        ctx.lineTo(tx - d * 13, cy + 12);
        ctx.closePath();
        ctx.fill();
        ell(cx, cy, e.w / 2, e.h / 2, d * 0.04, "#8b9dab");
        ell(cx, cy - e.h * 0.16, e.w / 2 * 0.9, e.h / 2 * 0.6, d * 0.04, "#5f7488", 0.8);
        ell(cx, cy + e.h * 0.2, e.w / 2 * 0.72, e.h / 2 * 0.45, 0, "#cbd5dc", 0.85);
        for (let i = 0; i < 9; i++) {
            ell(e.x + e.w * (0.16 + i * 0.078), cy + ((i % 3) - 1) * 5.5, 2.6, 1.8, 0.6, "#43556a", 0.5);
        }
        ell(cx - d * e.w * 0.06, cy + e.h * 0.34, 10, 4.5, d * 0.5, "#5c7083", 0.9);
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
        ell(hx + d * 4, hy - 3.5, 2, 2, 0, "#101820");
    }

    function drawShark(e) {
        const d = e.dir, cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        const open = e.mode === "lunge" || e.mode === "carry";
        const tx = d === 1 ? e.x + 6 : e.x + e.w - 6;
        ctx.fillStyle = "#54687c";
        ctx.beginPath();
        ctx.moveTo(tx, cy);
        ctx.lineTo(tx - d * 22, cy - e.h * 0.62);
        ctx.lineTo(tx - d * 10, cy);
        ctx.lineTo(tx - d * 18, cy + e.h * 0.42);
        ctx.closePath();
        ctx.fill();
        ell(cx, cy, e.w / 2, e.h / 2 * 0.82, d * 0.05, "#75899b");
        ell(cx, cy - e.h * 0.14, e.w / 2 * 0.92, e.h / 2 * 0.5, d * 0.05, "#4e6274", 0.85);
        ell(cx + d * e.w * 0.06, cy + e.h * 0.18, e.w / 2 * 0.78, e.h / 2 * 0.4, 0, "#dde6ec", 0.9);
        ctx.fillStyle = "#4e6274";
        ctx.beginPath();
        ctx.moveTo(cx - d * e.w * 0.02, e.y + e.h * 0.14);
        ctx.lineTo(cx - d * e.w * 0.14, e.y - e.h * 0.42);
        ctx.lineTo(cx - d * e.w * 0.26, e.y + e.h * 0.2);
        ctx.closePath();
        ctx.fill();
        ell(cx - d * e.w * 0.04, cy + e.h * 0.34, 14, 5.5, d * 0.55, "#5d7284", 0.9);
        ctx.strokeStyle = "rgba(40, 56, 70, 0.55)";
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 3; i++) {
            const gx = cx + d * (e.w * 0.2 - i * 7);
            ctx.beginPath();
            ctx.arc(gx, cy - 2, 8, d === 1 ? -0.5 : Math.PI - 0.7, d === 1 ? 0.7 : Math.PI + 0.5);
            ctx.stroke();
        }
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
        ell(hx - d * 2, hy - e.h * 0.16, 2.6, 2.6, 0, "#0d1319");
    }

    function drawOrca(e) {
        const d = e.dir, cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        const open = e.mode === "lunge" || e.mode === "carry";
        const tx = d === 1 ? e.x + 8 : e.x + e.w - 8;
        ctx.fillStyle = "#0e141d";
        ctx.beginPath();
        ctx.moveTo(tx, cy);
        ctx.lineTo(tx - d * 30, cy - e.h * 0.42);
        ctx.lineTo(tx - d * 14, cy + 2);
        ctx.lineTo(tx - d * 30, cy + e.h * 0.42);
        ctx.closePath();
        ctx.fill();
        ell(cx, cy, e.w / 2, e.h / 2 * 0.88, d * 0.04, "#10161f");
        ell(cx, cy - e.h * 0.16, e.w / 2 * 0.9, e.h / 2 * 0.5, d * 0.04, "#2a3646", 0.6);
        ell(cx + d * e.w * 0.05, cy + e.h * 0.26, e.w / 2 * 0.72, e.h / 2 * 0.34, 0, "#eef3f6", 0.95);
        ell(cx - d * e.w * 0.1, cy + e.h * 0.1, e.w * 0.09, e.h * 0.16, d * 0.9, "#e7edf1", 0.85);
        ctx.fillStyle = "#0e141d";
        ctx.beginPath();
        ctx.moveTo(cx - d * e.w * 0.02, e.y + e.h * 0.1);
        ctx.quadraticCurveTo(cx - d * e.w * 0.1, e.y - e.h * 0.75, cx - d * e.w * 0.16, e.y - e.h * 0.25);
        ctx.lineTo(cx - d * e.w * 0.22, e.y + e.h * 0.16);
        ctx.closePath();
        ctx.fill();
        ell(cx + d * e.w * 0.02, cy + e.h * 0.4, 18, 8, d * 0.6, "#10161f");
        const hx = d === 1 ? e.x + e.w - 20 : e.x + 20;
        const hy = cy - e.h * 0.02;
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

    function drawFish(c, time) {
        const bob = Math.sin(time * 2.4 + c.x * 0.05) * 1.6;
        const wig = Math.sin(time * 6 + c.x * 0.05) * 0.12;
        const y = c.y + bob;
        ell(c.x + 8, y + 10, 8.5, 5, 0.05, "#e08a3c");
        ell(c.x + 7, y + 8.5, 6, 3, 0.05, "#f2b168", 0.8);
        ctx.save();
        ctx.translate(c.x + 15, y + 10);
        ctx.rotate(wig);
        ctx.fillStyle = "#c9762f";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(6, -5.5);
        ctx.lineTo(6, 5.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ell(c.x + 4, y + 9, 1.4, 1.4, 0, "#5c3210");
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

    // ---- Multi-layer snow with per-particle drift, blur and sine sway ------
    function makeFlake(soft) {
        const cv = document.createElement("canvas");
        cv.width = 16; cv.height = 16;
        const c = cv.getContext("2d");
        const g = c.createRadialGradient(8, 8, 0.5, 8, 8, 8);
        const core = Math.max(0, 1 - soft);
        g.addColorStop(0, "rgba(255,255,255,0.98)");
        g.addColorStop(core, "rgba(255,255,255,0.9)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, 16, 16);
        return cv;
    }

    const snowLayers = CFG.snow.map((L, li) => {
        const r = rng(700 + li);
        const parts = [];
        for (let i = 0; i < L.count; i++) {
            parts.push({
                x: r() * W, y0: r() * H,
                size: lerp(L.sizeMin, L.sizeMax, r()),
                speed: lerp(L.speedMin, L.speedMax, r()),
                amp: L.driftAmp * (0.5 + r()),
                freq: lerp(L.driftFreqMin, L.driftFreqMax, r()),
                phase: r() * Math.PI * 2,
                alpha: lerp(L.alphaMin, L.alphaMax, r()),
            });
        }
        return { def: L, parts, sprite: makeFlake(L.soft) };
    });

    function drawSnow(p, time) {
        for (const layer of snowLayers) {
            const crisp = layer.def.crisp;
            if (crisp) ctx.fillStyle = rgb(p.particle);
            for (const pt of layer.parts) {
                const y = (pt.y0 + time * pt.speed) % (H + 20);
                const x = ((pt.x + Math.sin(time * pt.freq + pt.phase) * pt.amp) % W + W) % W;
                ctx.globalAlpha = pt.alpha;
                if (crisp) {
                    ctx.beginPath();
                    ctx.arc(x, y, pt.size, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    const s = pt.size * 3.2;
                    ctx.drawImage(layer.sprite, x - s / 2, y - s / 2, s, s);
                }
            }
        }
        ctx.globalAlpha = 1;
    }

    // ---- Global grading + coloured vignette + grain ------------------------
    function drawGrade(p, body) {
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = rgb(p.fog);
        ctx.fillRect(0, 0, W, H);

        ctx.globalCompositeOperation = "soft-light";
        ctx.globalAlpha = body.isDay ? 0.5 : 0.32;
        const lg = ctx.createRadialGradient(body.x, body.y, 20, body.x, body.y, W * 0.95);
        lg.addColorStop(0, rgb(p.light));
        lg.addColorStop(1, rgb(p.light, 0));
        ctx.fillStyle = lg;
        ctx.fillRect(0, 0, W, H);

        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = 0.14;
        const shadowSide = body.x < W / 2 ? W : 0;
        const sg = ctx.createLinearGradient(body.x, 0, shadowSide, 0);
        sg.addColorStop(0, "rgb(255,255,255)");
        sg.addColorStop(1, rgb(p.iceShadow));
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    // Coloured vignette — also baked per palette bucket.
    const vignetteCanvas = document.createElement("canvas");
    vignetteCanvas.width = W; vignetteCanvas.height = H;
    const vignetteCtx = vignetteCanvas.getContext("2d");
    function buildVignette(p) {
        const c = vignetteCtx;
        c.clearRect(0, 0, W, H);
        const col = lerpRGB(p.fog, p.iceShadow, CFG.vignette.mixShadow);
        const g = c.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.05);
        g.addColorStop(0, rgb(col, 0));
        g.addColorStop(1, rgb(col, CFG.vignette.alpha));
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);
    }

    const grainPattern = (function makeGrain() {
        const n = CFG.grain.tile;
        const tile = document.createElement("canvas");
        tile.width = n; tile.height = n;
        const c = tile.getContext("2d");
        const img = c.createImageData(n, n);
        for (let i = 0; i < img.data.length; i += 4) {
            const v = 128 + (Math.random() - 0.5) * 64;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
            img.data[i + 3] = 255;
        }
        c.putImageData(img, 0, 0);
        return ctx.createPattern(tile, "repeat");
    })();

    function drawGrain() {
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = CFG.grain.alpha;
        ctx.fillStyle = grainPattern;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    // ---- Frame -------------------------------------------------------------
    const fgTier = tiers.find(t => t.id === "fg");
    function render() {
        const time = performance.now() / 1000;
        const hour = currentHour();
        pal = samplePalette(hour);
        const body = skyBody(hour);
        ensureTint(pal, hour);

        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(skyCanvas, 0, 0);
        drawBody(pal, body);
        drawStars(hour, time);
        drawClouds(pal, time);

        // Parallax depth: far mountains → fog → mid bergs → fog → near bergs
        for (const tier of tiers) {
            if (tier.id === "far") { drawTier(tier, time); drawFogBand(CFG.fogBands[0], pal, time); }
            else if (tier.id === "mid") { drawTier(tier, time); drawFogBand(CFG.fogBands[1], pal, time); }
            else if (tier.id === "near") { drawTier(tier, time); }
        }

        if (level) {
            ctx.save();
            ctx.translate(-cameraX, 0);
            drawWaterBase(pal);
            drawEnemies();
            if (state === "caught") drawPenguin(player, time, body, true);
            drawWaterOverlay(pal, time);
            drawSplashes(pal);

            const sx = Math.max(0, Math.min(cameraX, level.width - W));
            ctx.drawImage(terrainCanvas, sx, 0, W, H, sx, 0, W, H);

            for (const c of level.coins) if (!c.collected) drawFish(c, time);
            drawGoal(time);

            if (state !== "caught") {
                if (invincibleTimer <= 0 || Math.floor(invincibleTimer * 10) % 2 === 0) {
                    drawPenguinShadow(player, body);
                    drawPenguin(player, time, body, false);
                }
            }
            ctx.restore();
        }

        if (fgTier) drawTier(fgTier, time);   // foreground detail plane

        drawSnow(pal, time);
        drawGrade(pal, body);
        ctx.drawImage(vignetteCanvas, 0, 0);
        drawGrain();
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
