/* ──────────────── Element Config ──────────────── */
const ELEMENT_CONFIG = {
    fire:      { kanji: "火", color: "#ff4500", glow: "#ff7040", bg: "rgba(80,10,0,0.7)" },
    water:     { kanji: "水", color: "#0099ff", glow: "#40bbff", bg: "rgba(0,20,80,0.7)" },
    lightning: { kanji: "雷", color: "#ffe000", glow: "#fff080", bg: "rgba(20,20,0,0.7)" },
    earth:     { kanji: "土", color: "#8b6914", glow: "#c8943a", bg: "rgba(30,20,0,0.7)" },
    wind:      { kanji: "風", color: "#00cc88", glow: "#40eeaa", bg: "rgba(0,40,20,0.7)" },
    shadow:    { kanji: "影", color: "#8800ff", glow: "#bb66ff", bg: "rgba(20,0,40,0.75)" },
    smoke:     { kanji: "煙", color: "#aaaaaa", glow: "#dddddd", bg: "rgba(20,20,20,0.8)" },
    energy:    { kanji: "力", color: "#00ccff", glow: "#80eeff", bg: "rgba(0,20,40,0.7)" },
};

const CONFIDENCE_MAP = { high: 1.0, medium: 0.65, low: 0.35 };

/* ──────────────── DOM ──────────────── */
const video          = document.getElementById("video");
const noCamera       = document.getElementById("noCamera");
const captureBtn     = document.getElementById("captureBtn");
const loadingOverlay = document.getElementById("loadingOverlay");
const statusText     = document.getElementById("statusText");
const resultCard     = document.getElementById("resultCard");
const resultPlaceholder = document.getElementById("resultPlaceholder");
const noDetection    = document.getElementById("noDetection");
const jutsuOverlay   = document.getElementById("jutsuOverlay");
const jutsuCanvas    = document.getElementById("jutsuCanvas");
const jutsuElementKanji = document.getElementById("jutsuElementKanji");
const jutsuNameDisplay  = document.getElementById("jutsuNameDisplay");

/* ──────────────── Camera ──────────────── */
let stream = null;

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
        });
        video.srcObject = stream;
        noCamera.style.display = "none";
        setStatus("Kamera aktiv");
    } catch {
        noCamera.style.display = "flex";
        setStatus("Kein Zugriff");
    }
}

function setStatus(text) {
    statusText.textContent = text;
}

/* ──────────────── Capture & Identify ──────────────── */
async function captureAndIdentify() {
    if (!stream) { await startCamera(); return; }

    captureBtn.disabled = true;
    loadingOverlay.style.display = "flex";
    setStatus("Analysiere…");

    const imageData = captureFrame();

    try {
        const res = await fetch("/api/identify-seal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: imageData }),
        });
        const data = await res.json();

        loadingOverlay.style.display = "none";

        if (!res.ok || data.error) {
            showError(data.error || "Unbekannter Fehler");
            return;
        }

        if (data.detected) {
            showResult(data);
            triggerJutsuAnimation(data.element, data.jutsu);
            setStatus(data.seal + " erkannt");
        } else {
            showNoDetection();
            setStatus("Kein Siegel erkannt");
        }
    } catch (err) {
        loadingOverlay.style.display = "none";
        showError("Netzwerkfehler: " + err.message);
    } finally {
        captureBtn.disabled = false;
    }
}

function captureFrame() {
    const canvas = document.createElement("canvas");
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
}

/* ──────────────── UI Results ──────────────── */
function showResult(data) {
    resultPlaceholder.style.display = "none";
    noDetection.style.display = "none";
    resultCard.style.display = "block";

    const cfg = ELEMENT_CONFIG[data.element] || ELEMENT_CONFIG.energy;
    const conf = CONFIDENCE_MAP[data.confidence] ?? 0.5;

    document.getElementById("resultSeal").textContent = data.seal_kanji || "印";
    document.getElementById("resultSeal").style.color = cfg.glow;

    document.getElementById("resultSealName").textContent =
        `${data.seal_japanese || ""} · ${data.seal || ""}`;

    const fill = document.getElementById("confidenceFill");
    fill.style.width = (conf * 100) + "%";
    fill.style.background = cfg.color;

    document.getElementById("resultJutsu").textContent = data.jutsu || "";
    document.getElementById("resultJutsu").style.color = cfg.glow;

    document.getElementById("resultJutsuDe").textContent = data.jutsu_de || "";

    const badge = document.getElementById("resultElementBadge");
    badge.textContent = cfg.kanji + " " + (data.element || "").toUpperCase();
    badge.className = `result-element-badge elem-${data.element || "energy"}`;

    document.getElementById("resultDescription").textContent = data.description || "";
}

function showNoDetection() {
    resultPlaceholder.style.display = "none";
    resultCard.style.display = "none";
    noDetection.style.display = "flex";
}

function showError(msg) {
    setStatus("Fehler");
    noDetection.style.display = "flex";
    noDetection.querySelector("p").textContent = "Fehler: " + msg;
}

/* ──────────────── Jutsu Animation ──────────────── */
let animFrame = null;
let animTimeout = null;

function triggerJutsuAnimation(element, jutsuName) {
    const cfg = ELEMENT_CONFIG[element] || ELEMENT_CONFIG.energy;

    jutsuCanvas.width  = window.innerWidth;
    jutsuCanvas.height = window.innerHeight;

    jutsuElementKanji.textContent = cfg.kanji;
    jutsuElementKanji.style.color = cfg.glow;
    jutsuNameDisplay.textContent  = jutsuName || "";
    jutsuNameDisplay.style.color  = cfg.glow;

    jutsuOverlay.style.display = "block";
    jutsuOverlay.classList.add("active");

    requestAnimationFrame(() => {
        jutsuElementKanji.classList.add("show");
        jutsuNameDisplay.classList.add("show");
    });

    const ctx = jutsuCanvas.getContext("2d");
    const particles = buildParticles(element, jutsuCanvas.width, jutsuCanvas.height);

    let startTime = performance.now();
    const duration = 3500;

    function frame(now) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const alpha = t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15;

        ctx.clearRect(0, 0, jutsuCanvas.width, jutsuCanvas.height);
        ctx.fillStyle = cfg.bg;
        ctx.fillRect(0, 0, jutsuCanvas.width, jutsuCanvas.height);

        updateAndDraw(ctx, particles, element, elapsed, alpha, cfg);

        if (t < 1) {
            animFrame = requestAnimationFrame(frame);
        } else {
            endAnimation();
        }
    }

    if (animFrame) cancelAnimationFrame(animFrame);
    if (animTimeout) clearTimeout(animTimeout);
    animFrame = requestAnimationFrame(frame);

    animTimeout = setTimeout(endAnimation, duration + 300);
}

function endAnimation() {
    jutsuElementKanji.classList.remove("show");
    jutsuNameDisplay.classList.remove("show");
    jutsuOverlay.classList.remove("active");
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
}

jutsuOverlay.addEventListener("click", endAnimation);

/* ──────────────── Particle System ──────────────── */
function buildParticles(element, W, H) {
    const count = element === "lightning" ? 8 : 120;
    const particles = [];

    for (let i = 0; i < count; i++) {
        particles.push(makeParticle(element, W, H, i, count));
    }
    return particles;
}

function makeParticle(element, W, H, i, total) {
    const cx = W / 2, cy = H / 2;
    switch (element) {
        case "fire":
            return {
                x: cx + (Math.random() - 0.5) * W * 0.5,
                y: H + 10,
                vx: (Math.random() - 0.5) * 3,
                vy: -(2 + Math.random() * 5),
                size: 4 + Math.random() * 18,
                life: 0.6 + Math.random() * 0.4,
                decay: 0.004 + Math.random() * 0.006,
                hue: 20 + Math.random() * 30,
            };
        case "water":
            return {
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                size: 3 + Math.random() * 8,
                life: 0.7 + Math.random() * 0.3,
                decay: 0.003 + Math.random() * 0.004,
                phase: Math.random() * Math.PI * 2,
            };
        case "lightning":
            return {
                x1: Math.random() * W, y1: 0,
                x2: cx + (Math.random() - 0.5) * 200,
                y2: cy + (Math.random() - 0.5) * 200,
                life: 1,
                branches: [],
            };
        case "earth":
            return {
                x: (i / total) * W * 1.1 - W * 0.05 + (Math.random() - 0.5) * 80,
                y: H + 20,
                vy: -(3 + Math.random() * 4),
                width: 20 + Math.random() * 60,
                height: 80 + Math.random() * 200,
                life: 1,
                delay: Math.random() * 0.5,
            };
        case "wind":
            const angle = (i / total) * Math.PI * 2;
            const r = 50 + Math.random() * 200;
            return {
                x: cx + Math.cos(angle) * r,
                y: cy + Math.sin(angle) * r,
                angle,
                r,
                speed: 0.02 + Math.random() * 0.04,
                size: 2 + Math.random() * 6,
                life: 0.8 + Math.random() * 0.2,
                decay: 0.002 + Math.random() * 0.003,
            };
        case "shadow":
            return {
                x: Math.random() > 0.5 ? -20 : W + 20,
                y: Math.random() * H,
                tx: cx + (Math.random() - 0.5) * 300,
                ty: cy + (Math.random() - 0.5) * 300,
                progress: 0,
                speed: 0.005 + Math.random() * 0.008,
                size: 2 + Math.random() * 4,
                life: 0.8 + Math.random() * 0.2,
            };
        case "smoke":
            return {
                x: cx + (Math.random() - 0.5) * 200,
                y: cy + (Math.random() - 0.5) * 200,
                vx: (Math.random() - 0.5) * 1.5,
                vy: -(0.5 + Math.random() * 1.5),
                size: 20 + Math.random() * 60,
                life: 0.6 + Math.random() * 0.4,
                decay: 0.002 + Math.random() * 0.003,
            };
        case "energy":
        default:
            return {
                x: cx, y: cy,
                r: 10 + i * (Math.min(W, H) / total) * 1.5,
                life: 1,
                speed: 1.5 + Math.random() * 1.5,
                size: 2 + Math.random() * 3,
            };
    }
}

function updateAndDraw(ctx, particles, element, elapsed, globalAlpha, cfg) {
    ctx.save();
    ctx.globalAlpha = globalAlpha;

    const W = jutsuCanvas.width, H = jutsuCanvas.height;
    const cx = W / 2, cy = H / 2;
    const t = elapsed / 1000;

    switch (element) {
        case "fire":
            drawFire(ctx, particles, W, H, cfg);
            break;
        case "water":
            drawWater(ctx, particles, W, H, t, cfg);
            break;
        case "lightning":
            drawLightning(ctx, particles, W, H, cx, cy, t, cfg);
            break;
        case "earth":
            drawEarth(ctx, particles, W, H, t, cfg);
            break;
        case "wind":
            drawWind(ctx, particles, cx, cy, t, cfg);
            break;
        case "shadow":
            drawShadow(ctx, particles, cx, cy, cfg);
            break;
        case "smoke":
            drawSmoke(ctx, particles, cfg);
            break;
        case "energy":
        default:
            drawEnergy(ctx, particles, cx, cy, t, cfg);
    }

    ctx.restore();
}

/* ── Fire ── */
function drawFire(ctx, particles, W, H, cfg) {
    particles.forEach(p => {
        p.x += p.vx + Math.sin(p.y * 0.02) * 0.5;
        p.y += p.vy;
        p.vx += (Math.random() - 0.5) * 0.3;
        p.life -= p.decay;
        if (p.life <= 0 || p.y < -20) {
            p.x = W / 2 + (Math.random() - 0.5) * W * 0.5;
            p.y = H + 10;
            p.vx = (Math.random() - 0.5) * 3;
            p.vy = -(2 + Math.random() * 5);
            p.life = 0.6 + Math.random() * 0.4;
            p.hue = 20 + Math.random() * 30;
        }

        const lifeRatio = Math.max(0, p.life);
        const brightness = 40 + lifeRatio * 50;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * lifeRatio);
        grad.addColorStop(0, `hsla(${p.hue + lifeRatio * 30}, 100%, ${brightness}%, ${lifeRatio})`);
        grad.addColorStop(0.5, `hsla(${p.hue}, 100%, 30%, ${lifeRatio * 0.6})`);
        grad.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.fillStyle = grad;
        ctx.arc(p.x, p.y, p.size * lifeRatio, 0, Math.PI * 2);
        ctx.fill();
    });
}

/* ── Water ── */
function drawWater(ctx, particles, W, H, t, cfg) {
    for (let wave = 0; wave < 5; wave++) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0, 180, 255, ${0.15 + wave * 0.06})`;
        ctx.lineWidth = 2;
        for (let x = 0; x <= W; x += 5) {
            const y = H / 2 + Math.sin(x * 0.01 + t * 2 + wave) * (30 + wave * 20)
                             + Math.sin(x * 0.02 - t * 1.5 + wave * 0.7) * 20;
            wave === 0 && x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    particles.forEach(p => {
        p.x += p.vx + Math.cos(p.phase + t * 2) * 0.5;
        p.y += p.vy + Math.sin(p.phase + t * 2) * 0.5;
        p.life -= p.decay;
        if (p.life <= 0) {
            p.x = Math.random() * W;
            p.y = Math.random() * H;
            p.life = 0.7 + Math.random() * 0.3;
        }

        ctx.beginPath();
        ctx.fillStyle = `rgba(0, 200, 255, ${p.life * 0.6})`;
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    });
}

/* ── Lightning ── */
function drawLightning(ctx, particles, W, H, cx, cy, t, cfg) {
    if (Math.floor(t * 8) % 2 === 0) {
        ctx.fillStyle = "rgba(255, 240, 80, 0.04)";
        ctx.fillRect(0, 0, W, H);
    }

    particles.forEach((bolt, i) => {
        if (Math.random() > 0.4) {
            drawBolt(
                ctx,
                Math.random() * W,
                0,
                cx + (Math.random() - 0.5) * 400,
                cy + (Math.random() - 0.5) * 400,
                `rgba(220, 230, 255, ${0.6 + Math.random() * 0.4})`,
                2 + Math.random() * 2,
                4
            );
        }
    });

    drawBolt(ctx, cx, 0, cx, H, "rgba(255, 255, 180, 0.9)", 3, 6);
}

function drawBolt(ctx, x1, y1, x2, y2, color, width, segments) {
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();

    const dx = (x2 - x1) / segments;
    const dy = (y2 - y1) / segments;

    ctx.moveTo(x1, y1);
    for (let i = 1; i <= segments; i++) {
        const px = x1 + dx * i + (i < segments ? (Math.random() - 0.5) * 80 : 0);
        const py = y1 + dy * i + (i < segments ? (Math.random() - 0.5) * 40 : 0);
        ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
}

/* ── Earth ── */
function drawEarth(ctx, particles, W, H, t, cfg) {
    particles.forEach(p => {
        if (t < p.delay) return;
        const elapsed = t - p.delay;
        const riseH = Math.min(p.height, elapsed * 300);
        const y = H - riseH;

        const grad = ctx.createLinearGradient(p.x, y, p.x, H);
        grad.addColorStop(0, "#c8943a");
        grad.addColorStop(0.3, "#8b6914");
        grad.addColorStop(1, "#4a3000");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect
            ? ctx.roundRect(p.x - p.width / 2, y, p.width, riseH, [6, 6, 0, 0])
            : ctx.rect(p.x - p.width / 2, y, p.width, riseH);
        ctx.fill();

        ctx.fillStyle = "rgba(255, 200, 100, 0.3)";
        ctx.fillRect(p.x - p.width / 2, y, p.width, 4);
    });

    for (let i = 0; i < 30; i++) {
        const bx = Math.random() * W;
        const by = H - Math.random() * 60;
        const bs = 2 + Math.random() * 6;
        ctx.beginPath();
        ctx.fillStyle = `rgba(180, 130, 50, ${Math.random() * 0.6})`;
        ctx.arc(bx, by, bs, 0, Math.PI * 2);
        ctx.fill();
    }
}

/* ── Wind ── */
function drawWind(ctx, particles, cx, cy, t, cfg) {
    particles.forEach(p => {
        p.angle += p.speed;
        p.r += 0.5;
        p.life -= p.decay;
        if (p.life <= 0 || p.r > Math.max(cx, cy) * 1.5) {
            p.angle = Math.random() * Math.PI * 2;
            p.r = 30 + Math.random() * 100;
            p.life = 0.8 + Math.random() * 0.2;
        }

        p.x = cx + Math.cos(p.angle) * p.r;
        p.y = cy + Math.sin(p.angle) * p.r;

        ctx.beginPath();
        ctx.fillStyle = `rgba(0, 220, 140, ${p.life * 0.5})`;
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
    });

    for (let ring = 0; ring < 3; ring++) {
        const r = (50 + ring * 80 + (t * 40) % 240) % 300;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0, 200, 120, ${0.15 * (1 - r / 300)})`;
        ctx.lineWidth = 2;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
    }
}

/* ── Shadow ── */
function drawShadow(ctx, particles, cx, cy, cfg) {
    particles.forEach(p => {
        p.progress = Math.min(1, p.progress + p.speed);
        const x = p.x + (p.tx - p.x) * p.progress;
        const y = p.y + (p.ty - p.y) * p.progress;

        ctx.beginPath();
        ctx.strokeStyle = `rgba(150, 50, 255, ${p.life * (1 - p.progress) * 0.6})`;
        ctx.lineWidth = p.size;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = `rgba(100, 0, 200, ${p.life * 0.7})`;
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (p.progress >= 1) {
            p.x = Math.random() > 0.5 ? -20 : jutsuCanvas.width + 20;
            p.y = Math.random() * jutsuCanvas.height;
            p.tx = cx + (Math.random() - 0.5) * 300;
            p.ty = cy + (Math.random() - 0.5) * 300;
            p.progress = 0;
        }
    });

    ctx.beginPath();
    const sGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200);
    sGrad.addColorStop(0, "rgba(80, 0, 160, 0.3)");
    sGrad.addColorStop(1, "transparent");
    ctx.fillStyle = sGrad;
    ctx.arc(cx, cy, 200, 0, Math.PI * 2);
    ctx.fill();
}

/* ── Smoke ── */
function drawSmoke(ctx, particles, cfg) {
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.size += 1;
        p.life -= p.decay;
        if (p.life <= 0) {
            const cx = jutsuCanvas.width / 2;
            const cy = jutsuCanvas.height / 2;
            p.x = cx + (Math.random() - 0.5) * 200;
            p.y = cy + (Math.random() - 0.5) * 200;
            p.size = 20 + Math.random() * 40;
            p.life = 0.6 + Math.random() * 0.4;
        }

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, `rgba(200, 200, 200, ${p.life * 0.4})`);
        grad.addColorStop(1, "transparent");

        ctx.beginPath();
        ctx.fillStyle = grad;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
}

/* ── Energy ── */
function drawEnergy(ctx, particles, cx, cy, t, cfg) {
    particles.forEach(p => {
        p.r += p.speed;
        if (p.r > Math.max(cx, cy) * 1.5) p.r = 10;

        const alpha = Math.max(0, 1 - p.r / (Math.max(cx, cy) * 1.5));
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0, 210, 255, ${alpha * 0.6})`;
        ctx.lineWidth = p.size;
        ctx.arc(cx, cy, p.r, 0, Math.PI * 2);
        ctx.stroke();
    });

    const pulse = Math.abs(Math.sin(t * 3)) * 0.3 + 0.1;
    const pGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
    pGrad.addColorStop(0, `rgba(0, 200, 255, ${pulse})`);
    pGrad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.fillStyle = pGrad;
    ctx.arc(cx, cy, 120, 0, Math.PI * 2);
    ctx.fill();
}

/* ──────────────── Init ──────────────── */
startCamera();
