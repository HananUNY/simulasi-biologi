/**
 * SIMULASI HEMODINAMIKA FISIOLOGIS
 * Engine: HTML5 Canvas + JS Physics
 * Version: 6.2 (Moodle/LMS Embed Friendly)
 */

// --- CONFIG & STATE ---
const config = {
    particleCount: 300, // Reduced slightly for performance on older school PCs
    zones: { arteryEnd: 0.35, capillaryEnd: 0.65 }
};

const state = {
    bpm: 70,
    isStiff: false,
    hasValves: true,
    plaqueLevel: 0,
    isZoomed: false,
    graphMode: 'spatial', // 'spatial', 'artery', 'vein'
    time: 0,
    cyclePhase: 0,
    systolicP: 120,
    diastolicP: 80,
    calculatedSys: 120,
    history: []
};

// --- DOM ELEMENTS ---
const simCanvas = document.getElementById('simCanvas');
const simCtx = simCanvas.getContext('2d');
const graphCanvas = document.getElementById('graphCanvas');
const graphCtx = graphCanvas.getContext('2d');
const zoomCanvas = document.getElementById('zoomCanvas');
const zoomCtx = zoomCanvas.getContext('2d');

// --- PARTICLES ---
class Particle {
    constructor() { this.reset(); this.x = Math.random() * simCanvas.width; }

    reset() {
        this.x = 0;
        this.yOffset = (Math.random() - 0.5) * 0.8;
        this.radius = Math.random() * 2 + 1.5;
        this.baseSpeed = Math.random() * 2 + 2;
    }

    update(dims, w) {
        const artEnd = w * config.zones.arteryEnd;
        const capEnd = w * config.zones.capillaryEnd;
        let speed = 0;

        // 1. ARTERY ZONE
        if (this.x < artEnd) {
            const pulse = state.isStiff
                ? Math.pow(Math.sin(state.cyclePhase * Math.PI), 10)
                : Math.sin(state.cyclePhase * Math.PI);

            const systole = state.cyclePhase < 0.5;
            const forwardForce = systole ? pulse * 6 : 0.5;
            speed = this.baseSpeed * 2 + (forwardForce * 2);

            // Plaque Bernoulli Effect
            const plaqueCenter = artEnd * 0.6;
            const plaqueWidth = artEnd * 0.3;
            if (state.plaqueLevel > 0 && Math.abs(this.x - plaqueCenter) < plaqueWidth / 2) {
                const dist = Math.abs(this.x - plaqueCenter);
                const normDist = dist / (plaqueWidth / 2);
                const constriction = state.plaqueLevel / 100 * (1 - Math.pow(normDist, 2));
                const openRatio = 1 - constriction;

                this.yOffset = this.yOffset * 0.9 + (this.yOffset * 0.95) * 0.1;

                speed *= (1 / Math.max(0.1, openRatio));
                if (speed > 15) speed = 15;

                this.color = `hsl(350, 90%, 50%)`;
            } else {
                this.color = `hsl(350, 90%, 50%)`;
            }
        }
        // 2. CAPILLARY ZONE
        else if (this.x < capEnd) {
            speed = this.baseSpeed * 0.4;
            const progress = (this.x - artEnd) / (capEnd - artEnd);
            this.color = `hsl(${350 - (progress * 110)}, 70%, 50%)`;
        }
        // 3. VEIN ZONE
        else {
            this.color = `hsl(240, 80%, 60%)`;
            speed = this.baseSpeed * 0.8;

            const veinLen = w - capEnd;
            const valves = [capEnd + veinLen * 0.3, capEnd + veinLen * 0.6, capEnd + veinLen * 0.9];

            if (state.hasValves) {
                valves.forEach(vx => {
                    if (Math.abs(this.x - vx) < 15) {
                        speed *= 1.5;
                    }
                });
            } else {
                if (state.cyclePhase > 0.5) speed = -1.0;
            }
        }

        this.x += speed;
        if (this.x > w) this.reset();
        if (this.x < 0) this.x = 0;
    }

    draw(ctx, tubeY, tubeH) {
        const y = tubeY + (this.yOffset * tubeH);
        ctx.beginPath();
        ctx.arc(this.x, y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

let particles = Array.from({ length: config.particleCount }, () => new Particle());

// --- VISUALIZATION LOGIC ---

function drawVessels(ctx, w, h) {
    const cy = h / 2;
    const tubeH = h * 0.4;
    const halfH = tubeH / 2;
    const artEnd = w * config.zones.arteryEnd;
    const capEnd = w * config.zones.capillaryEnd;

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#ef4444');
    grad.addColorStop(config.zones.arteryEnd, '#ef4444');
    grad.addColorStop(config.zones.capillaryEnd, '#3b82f6');
    grad.addColorStop(1, '#3b82f6');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';

    let rPulse = 0;
    if (state.cyclePhase < 0.4 && !state.isStiff) {
        rPulse = Math.sin(state.cyclePhase / 0.4 * Math.PI) * 8;
    }

    const drawWall = (isTop) => {
        const sign = isTop ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(0, cy + (sign * (halfH + rPulse)));
        ctx.lineTo(artEnd, cy + (sign * halfH));
        ctx.bezierCurveTo(artEnd + 50, cy + (sign * halfH), artEnd + 50, cy + (sign * 10), (artEnd + capEnd) / 2, cy + (sign * 10));
        ctx.bezierCurveTo(capEnd - 50, cy + (sign * 10), capEnd - 50, cy + (sign * halfH), capEnd, cy + (sign * halfH));
        ctx.lineTo(w, cy + (sign * halfH));
        ctx.stroke();
    };
    drawWall(true);
    drawWall(false);

    if (state.plaqueLevel > 0) {
        const pCenter = artEnd * 0.6;
        const pWidth = artEnd * 0.3;
        const plaqueH = (state.plaqueLevel / 100) * (halfH * 0.85);
        ctx.fillStyle = '#eab308';

        ctx.beginPath();
        ctx.moveTo(pCenter - pWidth / 2, cy - halfH);
        ctx.quadraticCurveTo(pCenter, cy - halfH + plaqueH * 2, pCenter + pWidth / 2, cy - halfH);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(pCenter - pWidth / 2, cy + halfH);
        ctx.quadraticCurveTo(pCenter, cy + halfH - plaqueH * 2, pCenter + pWidth / 2, cy + halfH);
        ctx.fill();
    }

    const veinLen = w - capEnd;
    const valves = [capEnd + veinLen * 0.3, capEnd + veinLen * 0.6, capEnd + veinLen * 0.9];
    ctx.strokeStyle = state.hasValves ? "rgba(255,255,255,0.4)" : "rgba(255,0,0,0.3)";
    ctx.lineWidth = 2;

    valves.forEach(vx => {
        if (state.hasValves) {
            const isOpen = state.cyclePhase < 0.6;
            const gap = isOpen ? 10 : 0;
            ctx.beginPath(); ctx.moveTo(vx, cy - halfH); ctx.lineTo(vx + 15, cy - gap); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(vx, cy + halfH); ctx.lineTo(vx + 15, cy + gap); ctx.stroke();
        } else {
            ctx.beginPath(); ctx.moveTo(vx, cy - halfH); ctx.lineTo(vx + 5, cy - halfH + 10); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(vx, cy + halfH); ctx.lineTo(vx + 5, cy + halfH - 10); ctx.stroke();
        }
    });

    return { tubeY: cy, tubeH };
}

// --- GRAPHING ENGINE ---

function updateGraphData() {
    const resistance = 1 + (state.plaqueLevel / 100) * 0.5;
    state.calculatedSys = state.isStiff ? 170 : 120 * resistance;

    const beat = Math.sin(state.cyclePhase * Math.PI);
    const pWave = state.cyclePhase < 0.4 ? beat : 0;

    const pArt = state.diastolicP + (state.calculatedSys - state.diastolicP) * pWave;
    const vArt = (state.cyclePhase < 0.4 ? 80 : 15);

    let pVein = 10 + (Math.sin(state.time * 2) * 2);
    let vVein = 20;
    if (!state.hasValves && state.cyclePhase > 0.5) vVein = -10;

    state.history.push({ pArt, vArt, pVein, vVein });
    if (state.history.length > 300) state.history.shift();
}

function drawGrid(w, h, paddingBottom) {
    const chartHeight = h - paddingBottom;
    graphCtx.font = "10px JetBrains Mono";
    graphCtx.textBaseline = "middle";
    graphCtx.lineWidth = 1;

    // Levels: 0, 50, 100, 150, 200
    const pLevels = [0, 50, 100, 150, 200];
    pLevels.forEach(p => {
        const y = chartHeight - (p / 200 * chartHeight);
        graphCtx.strokeStyle = "rgba(51, 65, 85, 0.4)";
        graphCtx.beginPath();
        graphCtx.moveTo(25, y);
        graphCtx.lineTo(w - 25, y);
        graphCtx.stroke();

        graphCtx.fillStyle = "#ef4444";
        graphCtx.textAlign = "right";
        graphCtx.fillText(p, 22, y);
    });

    const vLevels = [0, 50, 100, 150];
    vLevels.forEach(v => {
        const y = chartHeight - (v / 150 * chartHeight);
        graphCtx.fillStyle = "#facc15";
        graphCtx.textAlign = "left";
        graphCtx.fillText(v, w - 22, y);
    });
}

function drawGraphs() {
    const w = graphCanvas.width;
    const h = graphCanvas.height;
    const paddingBottom = 30;

    graphCtx.clearRect(0, 0, w, h);
    drawGrid(w, h, paddingBottom);

    if (state.graphMode === 'spatial') {
        drawSpatialGraph(w, h, paddingBottom);
        document.getElementById('xlabel-spatial').classList.remove('hidden');
        document.getElementById('xlabel-time').classList.add('hidden');
    } else {
        drawTimeGraph(w, h, state.graphMode, paddingBottom);
        document.getElementById('xlabel-spatial').classList.add('hidden');
        document.getElementById('xlabel-time').classList.remove('hidden');
    }
}

// === STATIC SPATIAL GRAPH ===
function drawSpatialGraph(w, h, paddingBottom) {
    const artEnd = config.zones.arteryEnd;
    const capEnd = config.zones.capillaryEnd;
    const chartHeight = h - paddingBottom;

    const pGrad = graphCtx.createLinearGradient(0, chartHeight, 0, 0);
    pGrad.addColorStop(0, "rgba(239, 68, 68, 0.1)");
    pGrad.addColorStop(1, "rgba(239, 68, 68, 0.4)");

    graphCtx.fillStyle = pGrad;
    graphCtx.strokeStyle = "#ef4444";
    graphCtx.lineWidth = 3;
    graphCtx.beginPath();
    graphCtx.moveTo(0, chartHeight);

    const step = 2;
    for (let x = 0; x <= w; x += step) {
        const normX = x / w;
        let p = 0;

        if (normX < artEnd) {
            p = state.calculatedSys - (normX * 15);
            if (state.plaqueLevel > 0) {
                const pc = artEnd * 0.6;
                const dist = Math.abs(normX - pc);
                if (dist < 0.15) {
                    const dip = (state.plaqueLevel / 3) * Math.exp(-(dist * dist) / 0.002);
                    p -= dip;
                }
            }
        } else if (normX < capEnd) {
            const pStart = state.calculatedSys - (artEnd * 15);
            const pEnd = 15;
            const t = (normX - artEnd) / (capEnd - artEnd);
            const ease = t * t * (3 - 2 * t);
            p = pStart * (1 - ease) + pEnd * ease;
        } else {
            p = 15 - ((normX - capEnd) * 5);
        }

        if (p < 0) p = 0;
        const y = chartHeight - (p / 200 * chartHeight);
        graphCtx.lineTo(x, y);
    }
    graphCtx.lineTo(w, chartHeight);
    graphCtx.fill();
    graphCtx.stroke();

    graphCtx.strokeStyle = "#facc15";
    graphCtx.lineWidth = 2;
    graphCtx.beginPath();

    for (let x = 0; x <= w; x += step) {
        const normX = x / w;
        let v = 0;

        if (normX < artEnd) {
            v = 40;
            if (state.plaqueLevel > 0) {
                const pc = artEnd * 0.6;
                const dist = Math.abs(normX - pc);
                const spike = (state.plaqueLevel / 6) * Math.exp(-(dist * dist) / 0.002);
                v += spike * 10;
            }
        } else if (normX < capEnd) {
            const vStart = 40;
            const vMid = 2;
            const t = (normX - artEnd) / (capEnd - artEnd);
            const distFromCenter = Math.abs(t - 0.5) * 2;
            v = vMid + (vStart - vMid) * Math.pow(distFromCenter, 2.5);
        } else {
            v = 15;
            if (state.hasValves) {
                const veinLen = 1 - capEnd;
                const relX = normX - capEnd;
                const v1 = veinLen * 0.3;
                const v2 = veinLen * 0.6;
                const v3 = veinLen * 0.9;
                const bump = (center) => Math.exp(-Math.pow(relX - center, 2) / 0.001) * 10;
                v += bump(v1) + bump(v2) + bump(v3);
            }
        }

        const y = chartHeight - (v / 150 * chartHeight);
        if (x === 0) graphCtx.moveTo(x, y);
        else graphCtx.lineTo(x, y);
    }
    graphCtx.stroke();

    graphCtx.fillStyle = "#ef4444"; graphCtx.fillText("Tekanan (mmHg)", 40, 20);
    graphCtx.fillStyle = "#facc15"; graphCtx.fillText("Kecepatan (cm/s)", 150, 20);
}

function drawTimeGraph(w, h, mode, paddingBottom) {
    const data = state.history;
    if (data.length < 2) return;

    const chartHeight = h - paddingBottom;

    graphCtx.strokeStyle = mode === 'artery' ? "#ef4444" : "#3b82f6";
    graphCtx.lineWidth = 3;
    graphCtx.beginPath();

    const step = w / 300;
    for (let i = 0; i < data.length; i++) {
        const val = mode === 'artery' ? data[i].pArt : data[i].pVein;
        const scale = 200;

        const y = chartHeight - (val / scale * chartHeight);
        if (i === 0) graphCtx.moveTo(0, y); else graphCtx.lineTo(i * step, y);
    }
    graphCtx.stroke();

    graphCtx.strokeStyle = "#facc15";
    graphCtx.lineWidth = 1;
    graphCtx.setLineDash([5, 5]);
    graphCtx.beginPath();
    for (let i = 0; i < data.length; i++) {
        const val = mode === 'artery' ? data[i].vArt : data[i].vVein;
        const scale = 150;
        const y = chartHeight - (val / scale * chartHeight);
        if (i === 0) graphCtx.moveTo(0, y); else graphCtx.lineTo(i * step, y);
    }
    graphCtx.stroke();
    graphCtx.setLineDash([]);

    graphCtx.fillStyle = mode === 'artery' ? "#ef4444" : "#3b82f6";
    graphCtx.textAlign = "left";
    graphCtx.fillText(`Tekanan ${mode === 'artery' ? 'Arteri' : 'Vena'}`, 40, 20);
    graphCtx.fillStyle = "#facc15";
    graphCtx.fillText("Kecepatan", 150, 20);
}

function setGraphMode(mode) {
    state.graphMode = mode;
    document.querySelectorAll('.graph-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
}

// --- CONTROLS ---
document.getElementById('slider-bpm').addEventListener('input', (e) => {
    state.bpm = parseInt(e.target.value);
    document.getElementById('bpm-display').innerText = state.bpm + " BPM";
});
document.getElementById('slider-plaque').addEventListener('input', (e) => {
    state.plaqueLevel = parseInt(e.target.value);
    document.getElementById('plaque-display').innerText = state.plaqueLevel + "%";
});
document.getElementById('toggle-stiffness').addEventListener('change', (e) => state.isStiff = e.target.checked);
document.getElementById('toggle-valves').addEventListener('change', (e) => state.hasValves = e.target.checked);
document.getElementById('toggle-zoom').addEventListener('change', (e) => state.isZoomed = e.target.checked);

// --- MAIN LOOP ---
function init() {
    resize();
    requestAnimationFrame(animate);
}

function resize() {
    const p = simCanvas.parentElement;
    simCanvas.width = p.offsetWidth;
    simCanvas.height = p.offsetHeight;

    const gp = graphCanvas.parentElement;
    graphCanvas.width = gp.offsetWidth;
    graphCanvas.height = gp.offsetHeight;

    zoomCanvas.width = 300;
    zoomCanvas.height = 300;
}

function animate() {
    const freq = state.bpm / 60;
    state.time += 0.016 * freq;
    state.cyclePhase = state.time % 1;

    // Bersihkan Canvas
    simCtx.clearRect(0, 0, simCanvas.width, simCanvas.height);

    const dims = drawVessels(simCtx, simCanvas.width, simCanvas.height);
    particles.forEach(p => {
        p.update(dims, simCanvas.width);
        p.draw(simCtx, dims.tubeY, dims.tubeH);
    });

    updateGraphData();
    drawGraphs();

    // Zoom Logic
    if (state.isZoomed) {
        zoomCanvas.classList.remove('hidden');
        document.getElementById('zoom-label').classList.remove('hidden');
        zoomCtx.fillStyle = "#0f172a";
        zoomCtx.fillRect(0, 0, 300, 300);

        // Menggambar ulang bagian Vena dengan skala lebih besar
        const tx = simCanvas.width * config.zones.capillaryEnd + 50;
        zoomCtx.drawImage(simCanvas, tx - 75, dims.tubeY - 75, 150, 150, 0, 0, 300, 300);

        // Crosshair
        zoomCtx.strokeStyle = "rgba(59, 130, 246, 0.5)";
        zoomCtx.beginPath();
        zoomCtx.moveTo(150, 0); zoomCtx.lineTo(150, 300);
        zoomCtx.moveTo(0, 150); zoomCtx.lineTo(300, 150);
        zoomCtx.stroke();
    } else {
        zoomCanvas.classList.add('hidden');
        document.getElementById('zoom-label').classList.add('hidden');
    }

    // UI Updates (Throttled untuk performa)
    if (Math.floor(state.time * 20) % 10 === 0) {
        document.getElementById('stat-bp').innerText = `${Math.round(state.calculatedSys)}/${state.diastolicP}`;
        document.getElementById('stat-vp').innerText = `${Math.round(state.history[state.history.length - 1].pVein)}`;

        const resLabel = document.getElementById('stat-res');
        if (state.plaqueLevel > 60) {
            resLabel.innerText = "BAHAYA (Sangat Tinggi)";
            resLabel.className = "font-bold text-red-500";
        } else if (state.plaqueLevel > 30) {
            resLabel.innerText = "TINGGI";
            resLabel.className = "font-bold text-orange-400";
        } else {
            resLabel.innerText = "NORMAL";
            resLabel.className = "font-bold text-emerald-400";
        }

        // Peringatan
        document.getElementById('warning-artery').style.display = (state.isStiff || state.calculatedSys > 150) ? 'block' : 'none';
        document.getElementById('warning-plaque').style.display = (state.plaqueLevel > 50) ? 'block' : 'none';
    }

    requestAnimationFrame(animate);
}

// Handle resize event untuk responsivitas iframe
window.addEventListener('resize', resize);
init();
