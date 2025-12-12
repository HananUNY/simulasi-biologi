const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

// Grid Config
const COLS = 40; const ROWS = 40; const CELL_SIZE = 15;
const WIDTH = COLS * CELL_SIZE; const HEIGHT = ROWS * CELL_SIZE;
canvas.width = WIDTH; canvas.height = HEIGHT;

// Types
const TYPE_FOREST = 0;
const TYPE_DEFOREST = 1; // Gundul Baru
const TYPE_NATURAL = 2; // Batu/Sungai Alami
const TYPE_VILLAGE = 3;
const TYPE_PALM = 4; // Kelapa Sawit (Ungu)

// Colors
const COLOR_FOREST = '#15803d';
const COLOR_DEFOREST = '#a16207'; // Cokelat/Orange
const COLOR_NATURAL = '#64748b';
const COLOR_VILLAGE = '#334155';
const COLOR_WATER = '#60a5fa';
const COLOR_PALM = '#9333ea'; // UNGU

// State
let grid = []; let particles = []; let isRunning = false; let animationId;
let floodLevel = 0; let frameCount = 0;
let simTimeMinutes = 360; let dayCount = 1; let isDaytime = true;
let simSpeedMultiplier = 1;
let stats = { forest: 0, deforest: 0, palm: 0, natural: 0, total: 0 };
let avgSaturation = 0;

// Parameters
let loggingProb = 0.002;
let governmentLimit = 0.5; // 50% default
let palmConversionProb = 0.0; // NEW: Controlled via slider
let restoreProb = 0.001;
let reboisasiProb = 0.0;
let naturalProb = 0.0;
let rainIntensity = 15;
let initialDeforestPercent = 0.0;
let soilType = 'loam';
let useSoilVar = true;
let deforestPattern = 'random';

// DOM
const sliderLogging = document.getElementById('loggingSlider');
const labelLogging = document.getElementById('loggingVal');
const sliderLimit = document.getElementById('limitSlider');
const labelLimit = document.getElementById('limitVal');
const moratoriumStatus = document.getElementById('moratoriumStatus');
const sliderRain = document.getElementById('rainSlider');
const labelRain = document.getElementById('rainVal');
const sliderPalm = document.getElementById('palmSlider'); // NEW
const labelPalm = document.getElementById('palmVal');     // NEW

const sliderRestore = document.getElementById('restoreSlider');
const labelRestore = document.getElementById('restoreVal');
const sliderReboisasi = document.getElementById('reboisasiSlider');
const labelReboisasi = document.getElementById('reboisasiVal');
const sliderNatural = document.getElementById('naturalSlider');
const labelNatural = document.getElementById('naturalVal');
const selectPattern = document.getElementById('deforestPattern');
const soilSelect = document.getElementById('soilTypeSelect');
const soilToggle = document.getElementById('soilToggle');

const btnStart = document.getElementById('btnStart');
const btnReset = document.getElementById('btnReset');
const textFlood = document.getElementById('floodLevelText');
const textForest = document.getElementById('forestCoverText');
const textPalm = document.getElementById('palmCoverText');

const timeDisplay = document.getElementById('timeDisplay');
const dayDisplay = document.getElementById('dayDisplay');
const weatherIcon = document.getElementById('weatherIcon');
const evapoStatus = document.getElementById('evapoStatus');
const floodOverlay = document.getElementById('floodWarningOverlay');
const floodBanner = document.getElementById('floodWarningBanner');
const ecoStatus = document.getElementById('ecoStatus');
const saturationBar = document.getElementById('saturationBar');

// Modal Logic
document.getElementById('btnUnderstand').onclick = () => document.getElementById('introModal').style.display = 'none';
document.getElementById('btnShowRealData').onclick = () => document.getElementById('dataModal').style.display = 'flex';
window.closeDataModal = () => document.getElementById('dataModal').style.display = 'none';

window.switchTab = function (island) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    if (island === 'sumatra') {
        document.querySelector("button[onclick=\"switchTab('sumatra')\"]").classList.add('active');
        document.getElementById('tab-sumatra').classList.add('active');
    } else {
        document.querySelector("button[onclick=\"switchTab('kalimantan')\"]").classList.add('active');
        document.getElementById('tab-kalimantan').classList.add('active');
    }
}

// Preset Logic
window.applyPreset = function (year) {
    isRunning = false; cancelAnimationFrame(animationId);
    btnStart.innerText = "Mulai"; btnStart.classList.replace('btn-danger', 'btn-primary');

    if (year === '1990') {
        // 1990: Izin Ketat (45%), Logging Lambat, Sawit Minim
        initialDeforestPercent = 0.05;
        sliderLimit.value = 45; governmentLimit = 0.45; labelLimit.innerText = "45% (Ketat)";

        sliderLogging.value = 5; loggingProb = 5 / 1000; labelLogging.innerText = "Sangat Lambat";
        sliderPalm.value = 5; palmConversionProb = 5 / 2000; labelPalm.innerText = "Sangat Lambat";

        sliderRain.value = 15; rainIntensity = 15; labelRain.innerText = "Gerimis";

    } else if (year === '2024') {
        // 2024: Izin Longgar (90%), Logging Ekstrem, Sawit Pesat
        initialDeforestPercent = 0.40;
        sliderLimit.value = 90; governmentLimit = 0.90; labelLimit.innerText = "90% (Longgar)";

        sliderLogging.value = 60; loggingProb = 60 / 1000; labelLogging.innerText = "Cepat";
        sliderPalm.value = 50; palmConversionProb = 50 / 1000; labelPalm.innerText = "Cepat";

        sliderRain.value = 40; rainIntensity = 40; labelRain.innerText = "Normal";
    }
    initGrid();
}

// --- CHART ---
const floodCanvas = document.getElementById('floodChart'); const floodCtx = floodCanvas.getContext('2d');
const landCanvas = document.getElementById('landChart'); const landCtx = landCanvas.getContext('2d');
let floodHistory = new Array(80).fill(0);
let landHistory = new Array(80).fill({ forest: 1, palm: 0, deforest: 0 });

function updateCharts() {
    if (frameCount % 5 !== 0) return;
    floodCanvas.width = floodCanvas.offsetWidth; floodCanvas.height = floodCanvas.offsetHeight;
    landCanvas.width = landCanvas.offsetWidth; landCanvas.height = landCanvas.offsetHeight;

    // Flood
    floodHistory.push(floodLevel); floodHistory.shift();
    floodCtx.clearRect(0, 0, floodCanvas.width, floodCanvas.height);
    floodCtx.strokeStyle = '#3b82f6'; floodCtx.lineWidth = 2; floodCtx.beginPath();
    const maxFlood = 2000;
    for (let i = 0; i < floodHistory.length; i++) {
        const x = (i / 80) * floodCanvas.width;
        const y = floodCanvas.height - (Math.min(floodHistory[i] / maxFlood, 1) * floodCanvas.height);
        if (i == 0) floodCtx.moveTo(x, y); else floodCtx.lineTo(x, y);
    }
    floodCtx.stroke();

    // Land
    const total = stats.total || 1;
    const fR = stats.forest / total; const pR = stats.palm / total; const dR = stats.deforest / total;
    landHistory.push({ forest: fR, palm: pR, deforest: dR }); landHistory.shift();

    landCtx.clearRect(0, 0, landCanvas.width, landCanvas.height);
    const w = landCanvas.width; const h = landCanvas.height;

    // Forest (Green)
    landCtx.fillStyle = '#15803d'; landCtx.beginPath(); landCtx.moveTo(0, h);
    for (let i = 0; i < 80; i++) landCtx.lineTo((i / 79) * w, h - (landHistory[i].forest * h));
    landCtx.lineTo(w, h); landCtx.fill();

    // Palm (Purple) - Stacked on Forest
    landCtx.fillStyle = '#9333ea'; landCtx.beginPath();
    for (let i = 0; i < 80; i++) landCtx.lineTo((i / 79) * w, h - (landHistory[i].forest * h));
    for (let i = 79; i >= 0; i--) landCtx.lineTo((i / 79) * w, h - ((landHistory[i].forest + landHistory[i].palm) * h));
    landCtx.fill();

    // Deforest (Brown) - Stacked on Palm
    landCtx.fillStyle = '#a16207'; landCtx.beginPath();
    for (let i = 0; i < 80; i++) landCtx.lineTo((i / 79) * w, h - ((landHistory[i].forest + landHistory[i].palm) * h));
    for (let i = 79; i >= 0; i--) landCtx.lineTo((i / 79) * w, h - ((landHistory[i].forest + landHistory[i].palm + landHistory[i].deforest) * h));
    landCtx.fill();
}

// --- LOGIC ---
class Cell {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.saturation = 0.0;
    }
    draw() {
        let c;
        if (this.type === TYPE_VILLAGE) c = (floodLevel > 1000) ? '#1d4ed8' : COLOR_VILLAGE;
        else if (this.type === TYPE_FOREST) c = COLOR_FOREST;
        else if (this.type === TYPE_PALM) c = COLOR_PALM;
        else if (this.type === TYPE_DEFOREST) c = COLOR_DEFOREST;
        else c = COLOR_NATURAL;

        ctx.fillStyle = c;
        ctx.fillRect(this.x * CELL_SIZE, this.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

        if (this.saturation > 0.1 && this.type !== TYPE_VILLAGE) {
            ctx.fillStyle = `rgba(0,0,50,${this.saturation * 0.6})`;
            ctx.fillRect(this.x * CELL_SIZE, this.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
    }
}

class Particle {
    constructor() {
        this.x = Math.floor(Math.random() * COLS); this.y = 0;
        this.px = Math.random() * CELL_SIZE; this.py = Math.random() * CELL_SIZE;
        this.speed = 0.8; this.active = true;
    }
    update() {
        this.y += this.speed;
        if (this.y >= ROWS - 5) { this.active = false; floodLevel += 10; return; }

        const gy = Math.floor(this.y); const gx = Math.floor(this.x);
        if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
            const cell = grid[gy][gx];
            let absorb = 0.01; let spd = 1.0;

            // Physics per type
            if (cell.type === TYPE_FOREST) { absorb = 0.15; spd = 0.4; }
            // UPDATE HERE: Sawit dikurangi drastis kemampuannya
            else if (cell.type === TYPE_PALM) { absorb = 0.025; spd = 1.1; } // Absorb 0.08->0.025, Speed 0.7->1.1
            else if (cell.type === TYPE_DEFOREST) { absorb = 0.002; spd = 1.5; }
            else if (cell.type === TYPE_NATURAL) { absorb = 0.02; spd = 0.8; }

            // Saturation logic
            absorb *= (1.0 - cell.saturation);

            if (Math.random() < absorb) {
                this.active = false;
                let satGain = 0.05;
                if (cell.type === TYPE_DEFOREST) satGain = 0.2;
                // UPDATE HERE: Sawit lebih cepat jenuh
                else if (cell.type === TYPE_PALM) satGain = 0.15; // 0.1->0.15

                cell.saturation += satGain;
                if (cell.saturation > 1) cell.saturation = 1;
            }
            this.speed = spd;
        }
    }
    draw() {
        ctx.fillStyle = COLOR_WATER;
        ctx.beginPath(); ctx.arc((this.x * CELL_SIZE) + this.px, (this.y * CELL_SIZE) + this.py, 2, 0, Math.PI * 2); ctx.fill();
    }
}

function initGrid() {
    grid = [];
    for (let y = 0; y < ROWS; y++) {
        let row = [];
        for (let x = 0; x < COLS; x++) {
            let t;
            if (y >= ROWS - 5) t = TYPE_VILLAGE;
            else {
                let r = Math.random();
                if (r < 0.15) t = TYPE_NATURAL;
                else if (r < 0.15 + initialDeforestPercent) t = TYPE_DEFOREST;
                else t = TYPE_FOREST;
            }
            row.push(new Cell(x, y, t));
        }
        grid.push(row);
    }
    particles = []; floodLevel = 0;
    simTimeMinutes = 360; dayCount = 1;
    draw(); updateUI();
}

function updateEcosystem() {
    let f = 0, d = 0, p = 0, n = 0, t = 0;
    let totalSat = 0; let soilCount = 0;

    for (let y = 0; y < ROWS - 5; y++) {
        for (let x = 0; x < COLS; x++) {
            let cell = grid[y][x];
            if (cell.type === TYPE_FOREST) f++;
            else if (cell.type === TYPE_DEFOREST) d++;
            else if (cell.type === TYPE_PALM) p++;
            else if (cell.type === TYPE_NATURAL) n++;
            t++;
            totalSat += cell.saturation; soilCount++;

            let dry = 0.0005;
            let evap = isDaytime ? 2.5 : 0.5;
            if (cell.type === TYPE_FOREST) dry = 0.003 * evap;
            // UPDATE HERE: Sawit mengering lebih lambat (transpirasi kurang dibanding hutan)
            else if (cell.type === TYPE_PALM) dry = 0.001 * evap; // 0.0015 -> 0.001

            dry *= simSpeedMultiplier;
            cell.saturation -= dry; if (cell.saturation < 0) cell.saturation = 0;
        }
    }
    stats = { forest: f, deforest: d, palm: p, natural: n, total: t };
    avgSaturation = (totalSat / soilCount) * 100;

    // Policy Check
    const openLandRatio = (d + p) / t;
    const isLimitReached = openLandRatio >= governmentLimit;

    if (isLimitReached) {
        moratoriumStatus.style.display = 'block';
    } else {
        moratoriumStatus.style.display = 'none';
    }

    const checks = 40 * simSpeedMultiplier;
    for (let i = 0; i < checks; i++) {
        const rx = Math.floor(Math.random() * COLS);
        const ry = Math.floor(Math.random() * (ROWS - 5));
        const cell = grid[ry][rx];

        // 1. LOGGING
        if (!isLimitReached && cell.type === TYPE_FOREST) {
            if (Math.random() < loggingProb) cell.type = TYPE_DEFOREST;
        }

        // 2. PALM CONVERSION (New Variable)
        if (cell.type === TYPE_DEFOREST) {
            if (Math.random() < palmConversionProb) cell.type = TYPE_PALM;
        }

        // 3. RESTORATION
        if (cell.type === TYPE_DEFOREST || cell.type === TYPE_PALM) {
            if (Math.random() < restoreProb) cell.type = TYPE_FOREST;
            else if (Math.random() < reboisasiProb) cell.type = TYPE_FOREST;
        }

        // 4. NATURAL
        if (Math.random() < naturalProb && cell.type === TYPE_FOREST) {
            cell.type = TYPE_DEFOREST;
            cell.saturation = 0.5;
        }
    }
}

function loop() {
    if (!isRunning) return;
    frameCount++;

    simTimeMinutes += 5 * simSpeedMultiplier;
    if (simTimeMinutes >= 1440) { simTimeMinutes = 0; dayCount++; }
    let h = Math.floor(simTimeMinutes / 60); isDaytime = (h >= 6 && h < 18);

    updateEcosystem();
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    if (particles.length < 1000) {
        let density = rainIntensity / 80;
        for (let i = 0; i < COLS; i++) if (Math.random() < density) particles.push(new Particle());
    }

    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) grid[y][x].draw();

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.update();
        if (!p.active) particles.splice(i, 1); else p.draw();
    }

    if (!isDaytime) { ctx.fillStyle = 'rgba(2,6,23,0.5)'; ctx.fillRect(0, 0, WIDTH, HEIGHT); }

    if (floodLevel > 0) {
        let drain = 2.0 + (floodLevel * 0.01);
        floodLevel -= drain; if (floodLevel < 0) floodLevel = 0;
    }
    if (floodLevel > 50) {
        let h = Math.min((floodLevel / 2000) * 5 * CELL_SIZE, 5 * CELL_SIZE);
        ctx.fillStyle = 'rgba(59,130,246,0.5)'; ctx.fillRect(0, HEIGHT - h, WIDTH, h);
    }

    updateUI(); updateCharts();
    animationId = requestAnimationFrame(loop);
}

function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) grid[y][x].draw();
}

function updateUI() {
    if (frameCount % 5 !== 0) return;
    let h = Math.floor(simTimeMinutes / 60); let m = simTimeMinutes % 60;
    timeDisplay.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    dayDisplay.innerText = `Hari Ke-${dayCount}`;
    evapoStatus.innerText = isDaytime ? "Evapotranspirasi: Tinggi" : "Evapotranspirasi: Rendah";
    evapoStatus.style.color = isDaytime ? "#4ade80" : "#94a3b8";
    weatherIcon.innerText = isDaytime ? "☀️" : "🌙";

    let val = Math.floor(floodLevel);
    textFlood.innerText = val + " m³";
    if (val > 1000) {
        textFlood.style.color = '#ef4444';
        floodOverlay.classList.add('active'); floodBanner.style.display = 'block';
    } else {
        textFlood.style.color = '#3b82f6';
        floodOverlay.classList.remove('active'); floodBanner.style.display = 'none';
    }

    let total = stats.total || 1;
    textForest.innerText = Math.round((stats.forest / total) * 100) + "%";
    textPalm.innerText = Math.round((stats.palm / total) * 100) + "%";

    saturationBar.style.width = avgSaturation + "%";
    if (avgSaturation > 80) saturationBar.style.background = "#ef4444";
    else if (avgSaturation > 50) saturationBar.style.background = "#f59e0b";
    else saturationBar.style.background = "#60a5fa";

    const fRatio = (stats.forest / total) * 100;
    if (fRatio < 30) {
        ecoStatus.className = "status-badge status-danger"; ecoStatus.innerText = "KRITIS (<30%)";
    } else if (fRatio < 50) {
        ecoStatus.className = "status-badge status-warning"; ecoStatus.innerText = "WASPADA";
    } else {
        ecoStatus.className = "status-badge status-safe"; ecoStatus.innerText = "STABIL";
    }
}

// Events
sliderLogging.addEventListener('input', (e) => {
    loggingProb = e.target.value / 1000;
    document.getElementById('loggingVal').innerText = getLabel(e.target.value);
});
sliderLimit.addEventListener('input', (e) => {
    governmentLimit = e.target.value / 100;
    document.getElementById('limitVal').innerText = e.target.value + "%";
});
sliderRain.addEventListener('input', (e) => {
    rainIntensity = parseInt(e.target.value);
    let l = "Gerimis"; if (rainIntensity > 20) l = "Normal"; if (rainIntensity > 50) l = "Deras"; if (rainIntensity > 80) l = "Badai";
    document.getElementById('rainVal').innerText = l;
});

sliderNatural.addEventListener('input', (e) => {
    naturalProb = e.target.value / 100000;
    document.getElementById('naturalVal').innerText = getLabel(e.target.value);
});
sliderRestore.addEventListener('input', (e) => {
    restoreProb = e.target.value / 2000;
    document.getElementById('restoreVal').innerText = getLabel(e.target.value);
});
sliderReboisasi.addEventListener('input', (e) => {
    reboisasiProb = e.target.value / 1000;
    document.getElementById('reboisasiVal').innerText = getLabel(e.target.value);
});
sliderPalm.addEventListener('input', (e) => { // NEW Event Listener
    palmConversionProb = e.target.value / 1000;
    document.getElementById('palmVal').innerText = getLabel(e.target.value);
});

selectPattern.addEventListener('change', (e) => { deforestPattern = e.target.value; });
soilSelect.addEventListener('change', (e) => { soilType = e.target.value; });
soilToggle.addEventListener('change', (e) => {
    useSoilVar = e.target.checked;
    soilSelect.disabled = !useSoilVar;
});

function getLabel(v) { if (v == 0) return "Nihil"; if (v < 20) return "Lambat"; if (v < 50) return "Sedang"; return "Cepat"; }
function setSimSpeed(s, b) {
    simSpeedMultiplier = s;
    document.querySelectorAll('.btn-speed').forEach(btn => btn.classList.remove('active'));
    if (b) b.classList.add('active');
}

btnStart.onclick = () => {
    isRunning = !isRunning;
    if (isRunning) { btnStart.innerText = "Stop"; btnStart.classList.replace('btn-primary', 'btn-danger'); loop(); }
    else { btnStart.innerText = "Lanjut"; btnStart.classList.replace('btn-danger', 'btn-primary'); cancelAnimationFrame(animationId); }
};
btnReset.onclick = () => { isRunning = false; cancelAnimationFrame(animationId); btnStart.innerText = "Mulai"; btnStart.classList.replace('btn-danger', 'btn-primary'); initGrid(); };

initGrid();
