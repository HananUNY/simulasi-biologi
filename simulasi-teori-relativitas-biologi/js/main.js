// --- Data Presets (Spesies) ---
const speciesPresets = {
    endo: [
        {
            id: 'human',
            name: 'Manusia (Human)',
            rate: 0.8,
            color: '#f97316',
            cbColor: '#0072b2', // Vermilion/Blue safe
            bgColor: '#fff7ed',
            borderColor: '#ffedd5',
            desc: 'Suhu tubuh konstan (~37°C). Metabolisme stabil di berbagai suhu lingkungan.'
        },
        {
            id: 'polar_bear',
            name: 'Beruang Kutub',
            rate: 0.75,
            color: '#64748b',
            cbColor: '#cc79a7', // Reddish Purple
            bgColor: '#f8fafc',
            borderColor: '#e2e8f0',
            desc: 'Sangat terinsulasi. Stabil di dingin, tapi mungkin stres di panas ekstrem.'
        },
        {
            id: 'mouse',
            name: 'Tikus (Mouse)',
            rate: 1.3,
            color: '#ef4444',
            cbColor: '#d55e00', // Vermilion
            bgColor: '#fef2f2',
            borderColor: '#fee2e2',
            desc: 'Metabolisme sangat cepat. Hidup singkat ("live fast, die young").'
        }
    ],
    ecto: [
        {
            id: 'salmon',
            name: 'Ikan Salmon',
            optTemp: 15,
            maxTemp: 24,
            rateScale: 1.1,
            color: '#3b82f6',
            cbColor: '#56b4e9', // Sky Blue
            bgColor: '#eff6ff',
            borderColor: '#dbeafe',
            desc: 'Adaptasi dingin. Optimum 15°C. Sangat rentan terhadap pemanasan global.'
        },
        {
            id: 'lizard',
            name: 'Kadal Gurun',
            optTemp: 35,
            maxTemp: 45,
            rateScale: 1.4,
            color: '#eab308',
            cbColor: '#f0e442', // Yellow
            bgColor: '#fefce8',
            borderColor: '#fef9c3',
            desc: 'Adaptasi panas. Optimum 35°C. Lamban di suhu ruangan, aktif di gurun.'
        },
        {
            id: 'frog',
            name: 'Katak Sawah',
            optTemp: 25,
            maxTemp: 35,
            rateScale: 1.0,
            color: '#22c55e',
            cbColor: '#009e73', // Bluish Green
            bgColor: '#f0fdf4',
            borderColor: '#dcfce7',
            desc: 'Moderat. Optimum 25°C. Umum ditemukan di iklim tropis/sub-tropis.'
        }
    ]
};

// --- Configuration & State ---
const config = {
    calendarSpeed: 0.5,
};

let state = {
    calendarTime: 0,
    envTemp: 20,
    isSeasonMode: false,
    isColorBlindMode: false, // New State
    seasonPhase: 0,

    // Current Selected Species Data
    currentEndo: speciesPresets.endo[0],
    currentEcto: speciesPresets.ecto[0],

    // Simulation Progress
    endo: { bioTime: 0, growth: 0, rate: 0 },
    ecto: { bioTime: 0, growth: 0, rate: 0 },

    history: {
        calendar: [],
        endoBio: [],
        ectoBio: []
    }
};

// --- DOM Elements ---
const tempSlider = document.getElementById('tempSlider');
const tempValue = document.getElementById('tempValue');
const seasonBtn = document.getElementById('seasonBtn');
const cbToggle = document.getElementById('cbToggle'); // New Element
const resetBtn = document.getElementById('resetBtn');
const endoSelect = document.getElementById('endoSelect');
const ectoSelect = document.getElementById('ectoSelect');

// Info Box Elements
const endoInfoBox = document.getElementById('endoInfoBox');
const endoNameDisplay = document.getElementById('endoNameDisplay');
const endoDescDisplay = document.getElementById('endoDescDisplay');
const endoColorDot = document.getElementById('endoColorDot');

const ectoInfoBox = document.getElementById('ectoInfoBox');
const ectoNameDisplay = document.getElementById('ectoNameDisplay');
const ectoDescDisplay = document.getElementById('ectoDescDisplay');
const ectoColorDot = document.getElementById('ectoColorDot');

// Canvases
const raceCanvas = document.getElementById('raceCanvas');
const tpcCanvas = document.getElementById('tpcCanvas');
const timeCanvas = document.getElementById('timeCanvas');
const ctxRace = raceCanvas.getContext('2d');
const ctxTpc = tpcCanvas.getContext('2d');
const ctxTime = timeCanvas.getContext('2d');

// --- Initialization Helper ---
function initSelectors() {
    // Populate Endotherms
    speciesPresets.endo.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.innerText = s.name;
        endoSelect.appendChild(opt);
    });

    // Populate Ectotherms
    speciesPresets.ecto.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.innerText = s.name;
        ectoSelect.appendChild(opt);
    });

    // Set Initial Values
    endoSelect.value = state.currentEndo.id;
    ectoSelect.value = state.currentEcto.id;
    if (cbToggle) cbToggle.checked = state.isColorBlindMode;

    updateInfoPanel();
}

function getSpeciesColor(species) {
    return state.isColorBlindMode && species.cbColor ? species.cbColor : species.color;
}

function updateInfoPanel() {
    const isDark = document.documentElement.classList.contains('dark');

    const endoColor = getSpeciesColor(state.currentEndo);
    const ectoColor = getSpeciesColor(state.currentEcto);

    // Update Endotherm Info
    endoNameDisplay.innerText = state.currentEndo.name + (state.isColorBlindMode ? " (CB)" : "");
    endoDescDisplay.innerText = state.currentEndo.desc;
    endoColorDot.style.backgroundColor = endoColor;

    // Smart Color Adaptation for Dark Mode
    if (isDark) {
        endoInfoBox.style.backgroundColor = 'rgba(255,255,255,0.05)';
        endoInfoBox.style.borderColor = endoColor;
        endoNameDisplay.classList.remove('text-orange-900');
        endoNameDisplay.classList.add('text-orange-300');
        endoDescDisplay.classList.remove('text-orange-800');
        endoDescDisplay.classList.add('text-slate-300');
        // Override color for CB mode in dark
        if (state.isColorBlindMode) endoNameDisplay.style.color = endoColor;
        else endoNameDisplay.style.color = '';
    } else {
        endoInfoBox.style.backgroundColor = state.currentEndo.bgColor;
        endoInfoBox.style.borderColor = state.currentEndo.borderColor;
        endoNameDisplay.classList.add('text-orange-900');
        endoNameDisplay.classList.remove('text-orange-300');
        endoDescDisplay.classList.add('text-orange-800');
        endoDescDisplay.classList.remove('text-slate-300');
        if (state.isColorBlindMode) endoNameDisplay.style.color = endoColor;
        else endoNameDisplay.style.color = '';
    }

    // Update Ectotherm Info
    ectoNameDisplay.innerText = state.currentEcto.name + (state.isColorBlindMode ? " (CB)" : "");
    ectoDescDisplay.innerText = state.currentEcto.desc;
    ectoColorDot.style.backgroundColor = ectoColor;

    if (isDark) {
        ectoInfoBox.style.backgroundColor = 'rgba(255,255,255,0.05)';
        ectoInfoBox.style.borderColor = ectoColor;
        ectoNameDisplay.classList.remove('text-teal-900');
        ectoNameDisplay.classList.add('text-teal-300');
        ectoDescDisplay.classList.remove('text-teal-800');
        ectoDescDisplay.classList.add('text-slate-300');
        if (state.isColorBlindMode) ectoNameDisplay.style.color = ectoColor;
        else ectoNameDisplay.style.color = '';
    } else {
        ectoInfoBox.style.backgroundColor = state.currentEcto.bgColor;
        ectoInfoBox.style.borderColor = state.currentEcto.borderColor;
        ectoNameDisplay.classList.add('text-teal-900');
        ectoNameDisplay.classList.remove('text-teal-300');
        ectoDescDisplay.classList.add('text-teal-800');
        ectoDescDisplay.classList.remove('text-slate-300');
        if (state.isColorBlindMode) ectoNameDisplay.style.color = ectoColor;
        else ectoNameDisplay.style.color = '';
    }
}

// --- Physics & Biology Functions ---

// Dynamic Ecto Rate based on species parameters
function getEctoRate(temp, species) {
    if (temp <= 0 || temp >= species.maxTemp) return 0;
    // Spread depends on how tolerant they are. 
    // Narrow spread for specialized animals (like salmon), wider for generalists.
    // Simplified: constant spread logic adjusted by rateScale
    const spread = temp < species.optTemp ? 12 : 5; // Asymmetric curve
    const val = Math.exp(-Math.pow(temp - species.optTemp, 2) / (2 * Math.pow(spread, 2)));
    return val * species.rateScale * 1.5;
}

function getEndoRate(envTemp, species) {
    // Simplified: Endotherms are constant
    return species.rate;
}

// --- Simulation Loop ---

function update() {
    // Update Environment
    if (state.isSeasonMode) {
        state.seasonPhase += 0.02;
        const seasonalTemp = 22.5 + 17.5 * Math.sin(state.seasonPhase); // Swing 5 to 40
        state.envTemp = Math.max(0, Math.min(45, seasonalTemp));
        tempSlider.value = state.envTemp;
    } else {
        state.envTemp = parseFloat(tempSlider.value);
    }

    // Update UI Text
    tempValue.innerText = state.envTemp.toFixed(1) + "°C";
    seasonBtn.innerText = state.isSeasonMode ? "Hidup (Musim)" : "Mati (Manual)";
    seasonBtn.className = state.isSeasonMode
        ? "bg-blue-600 text-white font-semibold py-1.5 px-4 rounded-full transition-colors text-xs shadow-md"
        : "bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 font-semibold py-1.5 px-4 rounded-full transition-colors text-xs";

    // Calculate Rates based on CURRENT SPECIES
    state.endo.rate = getEndoRate(state.envTemp, state.currentEndo);
    state.ecto.rate = getEctoRate(state.envTemp, state.currentEcto);

    // Accumulate
    state.endo.bioTime += state.endo.rate * config.calendarSpeed;
    state.ecto.bioTime += state.ecto.rate * config.calendarSpeed;
    state.calendarTime += 1 * config.calendarSpeed;

    // History
    if (state.calendarTime % 5 < 1) {
        state.history.calendar.push(state.calendarTime);
        state.history.endoBio.push(state.endo.bioTime);
        state.history.ectoBio.push(state.ecto.bioTime);

        if (state.history.calendar.length > 200) {
            state.history.calendar.shift();
            state.history.endoBio.shift();
            state.history.ectoBio.shift();
        }
    }

    draw();
    requestAnimationFrame(update);
}

// --- Drawing Functions ---

function resizeCanvases() {
    [raceCanvas, tpcCanvas, timeCanvas].forEach(c => {
        const rect = c.getBoundingClientRect();
        c.width = rect.width * 2;
        c.height = rect.height * 2;
        const ctx = c.getContext('2d');
        ctx.scale(2, 2);
    });
}

function drawRace() {
    const w = raceCanvas.getBoundingClientRect().width;
    const h = raceCanvas.getBoundingClientRect().height;

    // Detect dark mode
    const isDark = document.documentElement.classList.contains('dark');

    ctxRace.clearRect(0, 0, w, h);

    // Grid
    ctxRace.strokeStyle = isDark ? '#334155' : '#f1f5f9';
    ctxRace.beginPath();
    for (let i = 0; i < w; i += 50) { ctxRace.moveTo(i, 0); ctxRace.lineTo(i, h); }
    ctxRace.stroke();

    // Finish Line
    const finishLine = w * 0.9;
    ctxRace.strokeStyle = '#94a3b8';
    ctxRace.setLineDash([5, 5]);
    ctxRace.beginPath();
    ctxRace.moveTo(finishLine, 0);
    ctxRace.lineTo(finishLine, h);
    ctxRace.stroke();
    ctxRace.setLineDash([]);

    ctxRace.fillStyle = '#94a3b8';
    ctxRace.font = '10px Inter';
    ctxRace.fillText("Kedewasaan (Konstanta Termal)", finishLine - 160, h - 10);

    // Max scale
    const maxVal = 1000;
    const endoX = Math.min((state.endo.bioTime / maxVal) * finishLine, finishLine);
    const ectoX = Math.min((state.ecto.bioTime / maxVal) * finishLine, finishLine);

    // Lane 1: Endotherm
    const y1 = h * 0.35;
    drawCreature(ctxRace, endoX, y1, getSpeciesColor(state.currentEndo), state.currentEndo.name, state.endo.rate, isDark);

    // Lane 2: Ectotherm
    const y2 = h * 0.75;
    drawCreature(ctxRace, ectoX, y2, getSpeciesColor(state.currentEcto), state.currentEcto.name, state.ecto.rate, isDark);

    // Loop logic
    if (state.endo.bioTime > maxVal + 100 || state.ecto.bioTime > maxVal + 100) {
        if (state.calendarTime > 2000) resetSim();
    }
}

function drawCreature(ctx, x, y, color, label, rate, isDark) {
    // Body with pulse
    ctx.fillStyle = color;
    ctx.beginPath();
    const pulse = Math.sin(Date.now() / 200) * (rate * 2.5);
    ctx.arc(x, y, 14 + pulse, 0, Math.PI * 2);
    ctx.fill();

    // Name Label
    ctx.fillStyle = isDark ? '#cbd5e1' : '#334155';
    ctx.font = 'bold 11px Inter';
    ctx.fillText(label, 10, y + 4);

    // Speed Bar
    ctx.fillStyle = isDark ? '#475569' : '#e2e8f0';
    ctx.fillRect(100, y - 4, Math.max(0, x - 120), 8); // Track behind

    // Rate Text
    ctx.fillStyle = color;
    ctx.font = '10px Inter';
    ctx.textAlign = 'left';
    const rateText = rate === 0 ? "Stres/Mati" : `Laju: ${(rate * 100).toFixed(0)}%`;
    ctx.fillText(rateText, x + 25, y + 4);
}

function drawTPC() {
    const w = tpcCanvas.getBoundingClientRect().width;
    const h = tpcCanvas.getBoundingClientRect().height;

    const isDark = document.documentElement.classList.contains('dark');

    ctxTpc.clearRect(0, 0, w, h);

    // Axes
    ctxTpc.strokeStyle = isDark ? '#475569' : '#cbd5e1';
    ctxTpc.lineWidth = 1;
    ctxTpc.beginPath();
    ctxTpc.moveTo(30, h - 20); ctxTpc.lineTo(w, h - 20);
    ctxTpc.moveTo(30, h - 20); ctxTpc.lineTo(30, 0);
    ctxTpc.stroke();

    // Draw CURRENT Ecto Curve
    ctxTpc.strokeStyle = getSpeciesColor(state.currentEcto);
    ctxTpc.lineWidth = 2;
    ctxTpc.beginPath();
    for (let t = 0; t <= 45; t += 0.5) {
        const x = 30 + (t / 45) * (w - 30);
        const r = getEctoRate(t, state.currentEcto);
        const y = (h - 20) - (r * (h - 40) / 2); // Divide by 2 to fit higher rates
        if (t === 0) ctxTpc.moveTo(x, y);
        else ctxTpc.lineTo(x, y);
    }
    ctxTpc.stroke();

    // Draw CURRENT Endo Line
    ctxTpc.strokeStyle = getSpeciesColor(state.currentEndo);
    ctxTpc.beginPath();
    const rEndo = getEndoRate(20, state.currentEndo);
    const yEndo = (h - 20) - (rEndo * (h - 40) / 2);
    ctxTpc.moveTo(30, yEndo);
    ctxTpc.lineTo(w, yEndo);
    ctxTpc.stroke();

    // Current Temp Indicator
    const currentX = 30 + (state.envTemp / 45) * (w - 30);
    ctxTpc.strokeStyle = '#ef4444'; // Red for temp
    ctxTpc.lineWidth = 1;
    ctxTpc.setLineDash([4, 4]);
    ctxTpc.beginPath();
    ctxTpc.moveTo(currentX, 0);
    ctxTpc.lineTo(currentX, h - 20);
    ctxTpc.stroke();
    ctxTpc.setLineDash([]);

    // Labels
    ctxTpc.fillStyle = '#94a3b8';
    ctxTpc.font = '9px Inter';
    ctxTpc.fillText("Suhu (°C)", w / 2, h - 5);
}

function drawTimeGraph() {
    const w = timeCanvas.getBoundingClientRect().width;
    const h = timeCanvas.getBoundingClientRect().height;

    const isDark = document.documentElement.classList.contains('dark');

    ctxTime.clearRect(0, 0, w, h);

    if (state.history.calendar.length < 2) return;

    const maxBio = Math.max(...state.history.ectoBio, ...state.history.endoBio, 100);

    function plotLine(data, color) {
        ctxTime.strokeStyle = color;
        ctxTime.lineWidth = 2;
        ctxTime.beginPath();
        data.forEach((val, i) => {
            const x = (i / (data.length - 1)) * w;
            const y = h - (val / maxBio) * h;
            if (i === 0) ctxTime.moveTo(x, y);
            else ctxTime.lineTo(x, y);
        });
        ctxTime.stroke();
    }

    // Reference Line
    ctxTime.strokeStyle = isDark ? '#475569' : '#e2e8f0';
    ctxTime.setLineDash([2, 4]);
    ctxTime.beginPath();
    ctxTime.moveTo(0, h);
    ctxTime.lineTo(w, 0);
    ctxTime.stroke();
    ctxTime.setLineDash([]);

    plotLine(state.history.endoBio, getSpeciesColor(state.currentEndo));
    plotLine(state.history.ectoBio, getSpeciesColor(state.currentEcto));
}

function draw() {
    drawRace();
    drawTPC();
    drawTimeGraph();
}

function resetSim() {
    state.calendarTime = 0;
    state.endo.bioTime = 0;
    state.ecto.bioTime = 0;
    state.history.calendar = [];
    state.history.endoBio = [];
    state.history.ectoBio = [];
    state.seasonPhase = 0;
    if (state.isSeasonMode) state.envTemp = 20;
}

// --- Event Listeners ---
tempSlider.addEventListener('input', (e) => {
    state.isSeasonMode = false;
    state.envTemp = parseFloat(e.target.value);
});

seasonBtn.addEventListener('click', () => {
    state.isSeasonMode = !state.isSeasonMode;
});

if (cbToggle) {
    cbToggle.addEventListener('change', (e) => {
        state.isColorBlindMode = e.target.checked;
        if (state.isColorBlindMode) document.documentElement.classList.add('color-blind');
        else document.documentElement.classList.remove('color-blind');
        updateInfoPanel();
    });
}

resetBtn.addEventListener('click', resetSim);

// Species Change Listeners
endoSelect.addEventListener('change', (e) => {
    const selectedId = e.target.value;
    state.currentEndo = speciesPresets.endo.find(s => s.id === selectedId);
    updateInfoPanel();
    resetSim();
});

ectoSelect.addEventListener('change', (e) => {
    const selectedId = e.target.value;
    state.currentEcto = speciesPresets.ecto.find(s => s.id === selectedId);
    updateInfoPanel();
    resetSim();
});

window.addEventListener('resize', resizeCanvases);

// --- Theme Listener (handled by toggle in index.html, but we need to redraw) ---
// We can listen to class changes on HTML or just rely on Update loop.
// Since we use requestAnimationFrame, the drawing will pick up the new colors automatically on next frame.
// However, updateInfoPanel needs to be called when theme changes.
const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
        if (mutation.attributeName === "class") {
            updateInfoPanel();
        }
    });
});
observer.observe(document.documentElement, { attributes: true });


// --- Init ---
initSelectors();
resizeCanvases();
requestAnimationFrame(update);
