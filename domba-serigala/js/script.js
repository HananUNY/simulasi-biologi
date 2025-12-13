// --- KONSTANTA ---
const GRID_SIZE = 50;
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 600;
const PATCH_SIZE = CANVAS_WIDTH / GRID_SIZE;

const SHEEP_WIN_LIMIT = 4000;
const MAX_WOLVES_CAP = 1000; // Hard cap untuk mencegah crash
const PERFORMANCE_THRESHOLD = 300; // Ambang batas untuk mode render sederhana
const BROWSER_SAFETY_LIMIT = 6000; // Batas total agen

const SHAUN_MEME_URL = "https://media.tenor.com/DfIusDegWpAAAAAj/funny-laughing.gif";

const COLORS = {
    background: '#0f172a', // Slate 900
    grass: '#10b981',      // Emerald 500 (Green)
    grassLow: '#064e3b',   // Emerald 900 (Brown/Dirt equivalent)
    sheep: '#38bdf8',      // Sky 400
    wolf: '#f43f5e',       // Rose 500
    grid: '#1e293b'
};

// --- STATE ---
let params = {
    initialSheep: 150,
    initialWolves: 20,
    sheepReprodRate: 4.0,
    wolfReprodRate: 1.5,
    wolfMetabolism: 1.0,
    grassRegrowthTime: 30,
    sheepGainFromFood: 4,
    wolfGainFromFood: 20,
    enableGrass: true,
};

let stats = { sheep: 0, wolves: 0, grass: 0 };
let history = []; // Array of {s: count, w: count}
let gameState = {
    active: false,
    message: '',
    subMessage: '',
    showMeme: false
};

let isPlaying = false;
let tick = 0;
let animationFrameId;

// Agents storage
let agents = {
    sheep: [],
    wolves: [],
    grass: []
};

// --- UTILS ---
const random = (min, max) => Math.random() * (max - min) + min;
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// --- DOM ELEMENTS ---
let canvas, ctx;
let btnToggle, btnReset, overlayEl, chartSvg;
const uiRefs = {}; // Store references to UI value displays

// --- LOGIKA SIMULASI ---

function initSimulation() {
    gameState = { active: false, message: '', subMessage: '', showMeme: false };
    hideOverlay();

    // Setup Rumput
    const totalPatches = GRID_SIZE * GRID_SIZE;
    agents.grass = new Array(totalPatches).fill(0).map(() => {
        let initialState = 1;
        if (params.enableGrass) {
            initialState = Math.random() > 0.5 ? 1 : 0;
        } else {
            initialState = 1;
        }
        return {
            state: initialState,
            timer: randomInt(0, params.grassRegrowthTime),
        };
    });

    // Setup Domba
    agents.sheep = [];
    for (let i = 0; i < params.initialSheep; i++) {
        agents.sheep.push({
            x: random(0, CANVAS_WIDTH),
            y: random(0, CANVAS_HEIGHT),
            energy: randomInt(0, 2 * params.sheepGainFromFood),
            angle: random(0, Math.PI * 2),
        });
    }

    // Setup Serigala
    agents.wolves = [];
    for (let i = 0; i < params.initialWolves; i++) {
        agents.wolves.push({
            x: random(0, CANVAS_WIDTH),
            y: random(0, CANVAS_HEIGHT),
            energy: randomInt(0, 2 * params.wolfGainFromFood),
            angle: random(0, Math.PI * 2),
        });
    }

    tick = 0;
    history = [];
    updateStats();
    draw(true);
    updateChart();
}

function update() {
    if (!agents.grass || agents.grass.length === 0) return;

    const { sheep, wolves, grass } = agents;

    // 1. CEK KONDISI MENANG/KALAH
    if (wolves.length === 0) {
        if (sheep.length >= SHEEP_WIN_LIMIT) {
            triggerGameOver("DOMBA MENGUASAI BUMI!", `Populasi tembus ${SHEEP_WIN_LIMIT} & predator punah.`, true);
        } else {
            triggerGameOver("SERIGALA PUNAH!", "Tidak ada predator tersisa.", true);
        }
        return;
    }

    if (sheep.length >= SHEEP_WIN_LIMIT) {
        triggerGameOver("DOMBA MENGUASAI BUMI!", `Populasi mencapai ${SHEEP_WIN_LIMIT} ekor.`, true);
        return;
    }

    if (sheep.length + wolves.length > BROWSER_SAFETY_LIMIT) {
        triggerGameOver("Simulasi Dihentikan", "Batas kinerja browser tercapai.", false);
        return;
    }

    // 2. LOGIKA RUMPUT
    if (params.enableGrass) {
        for (let i = 0; i < grass.length; i++) {
            if (grass[i].state === 0) {
                grass[i].timer--;
                if (grass[i].timer <= 0) {
                    grass[i].state = 1;
                    grass[i].timer = params.grassRegrowthTime;
                }
            }
        }
    }

    // 3. LOGIKA DOMBA
    for (let i = sheep.length - 1; i >= 0; i--) {
        const s = sheep[i];
        s.angle += random(-0.5, 0.5);
        s.x += Math.cos(s.angle) * 1.5;
        s.y += Math.sin(s.angle) * 1.5;

        // Wrap around
        if (s.x < 0) s.x += CANVAS_WIDTH;
        else if (s.x > CANVAS_WIDTH) s.x -= CANVAS_WIDTH;
        if (s.y < 0) s.y += CANVAS_HEIGHT;
        else if (s.y > CANVAS_HEIGHT) s.y -= CANVAS_HEIGHT;

        if (params.enableGrass) {
            s.energy -= 0.2;
            const patchIdx = Math.floor(s.y / PATCH_SIZE) * GRID_SIZE + Math.floor(s.x / PATCH_SIZE);
            if (patchIdx >= 0 && patchIdx < grass.length && grass[patchIdx].state === 1) {
                grass[patchIdx].state = 0;
                s.energy += params.sheepGainFromFood;
            }
            if (s.energy < 0) {
                sheep.splice(i, 1);
                continue;
            }
        }

        if (sheep.length < SHEEP_WIN_LIMIT) {
            if (random(0, 100) < params.sheepReprodRate) {
                s.energy /= 2;
                sheep.push({ ...s, energy: s.energy });
            }
        }
    }

    // 4. LOGIKA SERIGALA
    for (let i = wolves.length - 1; i >= 0; i--) {
        const w = wolves[i];
        w.angle += random(-0.5, 0.5);
        w.x += Math.cos(w.angle) * 2;
        w.y += Math.sin(w.angle) * 2;

        // Wrap around
        if (w.x < 0) w.x += CANVAS_WIDTH;
        else if (w.x > CANVAS_WIDTH) w.x -= CANVAS_WIDTH;
        if (w.y < 0) w.y += CANVAS_HEIGHT;
        else if (w.y > CANVAS_HEIGHT) w.y -= CANVAS_HEIGHT;

        w.energy -= params.wolfMetabolism;

        // Hunt
        for (let j = sheep.length - 1; j >= 0; j--) {
            const s = sheep[j];
            const dx = w.x - s.x;
            const dy = w.y - s.y;
            if (dx * dx + dy * dy < 100) { // Distance squared < 100 (dist < 10)
                sheep.splice(j, 1);
                w.energy += params.wolfGainFromFood;
                break;
            }
        }

        if (w.energy < 0) {
            wolves.splice(i, 1);
            continue;
        }

        if (wolves.length < MAX_WOLVES_CAP) {
            if (random(0, 100) < params.wolfReprodRate) {
                w.energy /= 2;
                wolves.push({ ...w, energy: w.energy });
            }
        }
    }

    tick++;
    updateStats();

    if (tick % 5 === 0) {
        history.push({ s: sheep.length, w: wolves.length });
        if (history.length > 500) history.shift();
        updateChart(); // Update chart every 5 ticks
    }
}

function updateStats() {
    const { sheep, wolves, grass } = agents;
    const currentGrass = params.enableGrass
        ? grass.filter(g => g.state === 1).length
        : (GRID_SIZE * GRID_SIZE);

    // Update DOM
    if (uiRefs.statSheep) uiRefs.statSheep.textContent = sheep.length;
    if (uiRefs.statWolves) uiRefs.statWolves.textContent = wolves.length;
    if (uiRefs.statGrass) uiRefs.statGrass.textContent = params.enableGrass
        ? Math.round((currentGrass / (GRID_SIZE * GRID_SIZE)) * 100) + '%'
        : '∞';
}

function draw(force = false) {
    if (!ctx) return;
    const { sheep, wolves, grass } = agents;
    if (!grass || grass.length === 0) return;

    const simpleMode = (sheep.length + wolves.length) > PERFORMANCE_THRESHOLD;

    // Background
    if (params.enableGrass) {
        ctx.fillStyle = COLORS.grassLow;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        ctx.fillStyle = COLORS.grass;
        for (let i = 0; i < grass.length; i++) {
            if (grass[i].state === 1) {
                const x = (i % GRID_SIZE) * PATCH_SIZE;
                const y = Math.floor(i / GRID_SIZE) * PATCH_SIZE;
                ctx.fillRect(x, y, PATCH_SIZE, PATCH_SIZE);
            }
        }
    } else {
        ctx.fillStyle = COLORS.grass;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Sheep
    ctx.fillStyle = COLORS.sheep;
    if (simpleMode) {
        for (let s of sheep) ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    } else {
        for (let s of sheep) {
            ctx.beginPath();
            ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Wolves
    ctx.fillStyle = COLORS.wolf;
    if (simpleMode) {
        for (let w of wolves) ctx.fillRect(w.x - 2, w.y - 2, 5, 5);
    } else {
        for (let w of wolves) {
            ctx.beginPath();
            ctx.arc(w.x, w.y, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function loop() {
    if (!gameState.active) {
        update();
        draw();
    }
    if (isPlaying && !gameState.active) {
        animationFrameId = requestAnimationFrame(loop);
    }
}

function toggleSim() {
    if (gameState.active) {
        initSimulation(); // Restart if game over
        return;
    }

    isPlaying = !isPlaying;
    updatePlayButton();

    if (isPlaying) {
        loop();
    } else {
        cancelAnimationFrame(animationFrameId);
        draw(true); // Ensure one draw
    }
}

function updatePlayButton() {
    if (btnToggle) {
        btnToggle.innerHTML = isPlaying
            ? `<i data-lucide="pause" width="18"></i> STOP`
            : `<i data-lucide="play" width="18"></i> MULAI`;

        btnToggle.className = `p-2 rounded-lg font-bold flex items-center gap-2 transition-all ${isPlaying
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
            }`;
        lucide.createIcons();
    }
}

function triggerGameOver(title, subtitle, showMeme) {
    gameState = { active: true, message: title, subMessage: subtitle, showMeme: showMeme };
    isPlaying = false;
    updatePlayButton();
    showOverlay();
}

function showOverlay() {
    if (!overlayEl) return;
    overlayEl.classList.remove('hidden');

    const titleEl = document.getElementById('overlayTitle');
    const subEl = document.getElementById('overlaySub');
    const memeEl = document.getElementById('overlayMeme');
    const iconEl = document.getElementById('overlayIcon');

    if (titleEl) titleEl.innerText = gameState.message;
    if (subEl) subEl.innerText = gameState.subMessage;

    if (gameState.showMeme) {
        if (memeEl) memeEl.classList.remove('hidden');
        if (iconEl) iconEl.classList.add('hidden');
    } else {
        if (memeEl) memeEl.classList.add('hidden');
        if (iconEl) iconEl.classList.remove('hidden');
    }
}

function hideOverlay() {
    if (!overlayEl) return;
    overlayEl.classList.add('hidden');
}

// --- CHART LOGIC (Simple SVG) ---
function updateChart() {
    const chartLineS = document.getElementById('chartLineS');
    const chartLineW = document.getElementById('chartLineW');
    const maxS_El = document.getElementById('chartMaxS');
    const maxW_El = document.getElementById('chartMaxW');

    if (!chartLineS || !chartLineW || history.length < 2) return;

    const width = 100;
    const height = 100;
    const maxSheep = Math.max(...history.map(d => d.s), 10);
    const maxWolves = Math.max(...history.map(d => d.w), 10);

    if (maxS_El) maxS_El.innerText = `Max: ${maxSheep}`;
    if (maxW_El) maxW_El.innerText = `Max: ${maxWolves}`;

    const getPoints = (type) => {
        return history.map((d, i) => {
            const x = (i / (history.length - 1)) * width;
            const val = type === 's' ? d.s : d.w;
            const maxVal = type === 's' ? maxSheep : maxWolves;
            const normalizedY = height - (val / maxVal) * height * 0.9;
            return `${x},${normalizedY}`;
        }).join(' ');
    };

    chartLineS.setAttribute('points', getPoints('s'));
    chartLineW.setAttribute('points', getPoints('w'));
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('simCanvas');
    if (canvas) ctx = canvas.getContext('2d');

    btnToggle = document.getElementById('btnToggle');
    btnReset = document.getElementById('btnReset');
    overlayEl = document.getElementById('overlay');

    uiRefs.statSheep = document.getElementById('statSheep');
    uiRefs.statWolves = document.getElementById('statWolves');
    uiRefs.statGrass = document.getElementById('statGrass');

    if (btnToggle) btnToggle.addEventListener('click', toggleSim);
    if (btnReset) btnReset.addEventListener('click', initSimulation);

    // Overlay Reset Button
    const btnOverlayReset = document.getElementById('btnOverlayReset');
    if (btnOverlayReset) btnOverlayReset.addEventListener('click', () => initSimulation());

    // Sliders
    const bindSlider = (id, paramKey) => {
        const el = document.getElementById(id);
        const valEl = document.getElementById(id + 'Val');
        if (el) {
            el.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                params[paramKey] = val;
                if (valEl) valEl.innerText = val;
            });
        }
    };

    bindSlider('inputInitialSheep', 'initialSheep');
    bindSlider('inputInitialWolves', 'initialWolves');
    bindSlider('inputSheepReprod', 'sheepReprodRate');
    bindSlider('inputWolfReprod', 'wolfReprodRate');
    bindSlider('inputWolfMeta', 'wolfMetabolism');
    bindSlider('inputGrassTime', 'grassRegrowthTime');
    bindSlider('inputSheepGain', 'sheepGainFromFood');
    bindSlider('inputWolfGain', 'wolfGainFromFood');

    // Toggle Grass Mode
    const btnToggleGrass = document.getElementById('btnToggleGrass');
    if (btnToggleGrass) {
        btnToggleGrass.addEventListener('click', () => {
            params.enableGrass = !params.enableGrass;
            const modeLabel = document.getElementById('textMode');
            const toggleThumb = document.getElementById('toggleThumb');

            if (modeLabel) modeLabel.innerText = params.enableGrass ? "Terbatas (Rumput)" : "Tak Terbatas (Unlimited)";
            if (toggleThumb) {
                if (params.enableGrass) {
                    btnToggleGrass.classList.remove('bg-slate-600');
                    btnToggleGrass.classList.add('bg-emerald-500');
                    toggleThumb.classList.remove('left-1');
                    toggleThumb.classList.add('left-7');
                } else {
                    btnToggleGrass.classList.add('bg-slate-600');
                    btnToggleGrass.classList.remove('bg-emerald-500');
                    toggleThumb.classList.add('left-1');
                    toggleThumb.classList.remove('left-7');
                }
            }
            initSimulation();
        });
    }

    initSimulation();
    lucide.createIcons();
});
