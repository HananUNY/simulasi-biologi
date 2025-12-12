// --- CONFIGURATION ---
const CONFIG = {
    particleRadius: 3,
    sugarRadius: 10,
    baseSpeed: 1.5,
    waterColor: '#5dade2',
    sugarColor: '#f1c40f',
    soluteColor: '#e74c3c', // for Diffusion ink
    waterCount: 200, // Reduced for single canvas density feels
    gravity: 0.1
};

// --- GLOBAL STATE ---
const LAB_STATE = {
    activeTab: 'diffusion', // 'diffusion' | 'osmosis'
    temp: 25, // 0 - 80
    molSize: 'small', // 'small' | 'large' (Diffusion)
    permeability: 0, // 0 - 100% (Osmosis)
    sugarCount: 0 // (Osmosis)
};

// --- PARTICLE SYSTEMS ---
class Particle {
    constructor(x, y, type, canvasWidth, canvasHeight) {
        this.x = x;
        this.y = y;
        this.type = type; // 'water', 'sugar', 'solute'
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;

        const v = (Math.random() - 0.5) * CONFIG.baseSpeed;
        this.vx = v;
        this.vy = v;

        this.updateProperties();
    }

    updateProperties() {
        if (this.type === 'sugar') {
            this.radius = CONFIG.sugarRadius;
            this.color = CONFIG.sugarColor;
        } else if (this.type === 'solute') {
            // Diffusion Ink
            this.radius = LAB_STATE.molSize === 'large' ? 8 : 4;
            this.color = CONFIG.soluteColor;
        } else {
            // Water
            this.radius = CONFIG.particleRadius;
            this.color = CONFIG.waterColor;
        }
    }

    update(membraneX = null, osmoticForce = 0, hydrostaticForce = 0) {
        // Temperature Multiplier (Kinetic Energy)
        const tempMultiplier = 0.2 + (LAB_STATE.temp / 40);

        // Mass/Size Multiplier (Inertia)
        let sizeMultiplier = 1;
        if (this.type === 'solute' && LAB_STATE.molSize === 'large') {
            sizeMultiplier = 0.4;
        }

        // --- BROWNIAN MOTION (Base Movement) ---
        if (this.type !== 'sugar') {
            // REDUCE JITTER FOR WATER to make flow clearer
            const jitter = this.type === 'water' ? 0.2 : 0.5;

            this.vx += (Math.random() - 0.5) * jitter;
            this.vy += (Math.random() - 0.5) * jitter;

            // GLOBAL OSMOTIC DRIFT (To satisfy "moves to lower concentration")
            // If Osmosis is active and this is water, gently drift RIGHT if sugar is present
            if (LAB_STATE.activeTab === 'osmosis' && this.type === 'water') {
                if (LAB_STATE.sugarCount > 0) {
                    // Drift towards sugar (Right)
                    this.vx += 0.05 * (LAB_STATE.sugarCount / 20);
                }
            }

            // Speed Normalization
            const currentSpeed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
            let targetSpeed = CONFIG.baseSpeed * tempMultiplier * sizeMultiplier;

            if (currentSpeed > 0) {
                this.vx = (this.vx / currentSpeed) * targetSpeed;
                this.vy = (this.vy / currentSpeed) * targetSpeed;
            }
        } else {
            // Sugars move simpler
            this.x += this.vx * tempMultiplier;
            this.y += this.vy * tempMultiplier;
        }

        // --- MEMBRANE INTERACTION ---
        if (LAB_STATE.activeTab === 'osmosis' && membraneX !== null) {

            // 1. Water Logic (The Osmosis "Pump")
            if (this.type === 'water') {
                const dist = this.x - membraneX;

                // INTERACTION ZONE
                if (Math.abs(dist) < 20) {
                    // Stronger kick to cross membrane if sugar is pulling
                    if (osmoticForce > 0) {
                        this.vx += (osmoticForce * 0.5);
                    }

                    // Hydrostatic resistance
                    if (hydrostaticForce > 0) {
                        this.vx -= (hydrostaticForce * 5.0);
                    }
                }
            }

            // 2. Sugar Logic (Permeability Barrier)
            if (this.type === 'sugar') {
                // Collision Logic
                if (Math.abs(this.x - membraneX) < this.radius + 2) {
                    const chanceToPass = LAB_STATE.permeability / 100;

                    // Bounce Check
                    let shouldBounce = true;
                    if (Math.random() < chanceToPass) shouldBounce = false;

                    if (shouldBounce) {
                        this.vx *= -1;
                        // Teleport out
                        if (this.x < membraneX) this.x = membraneX - (this.radius + 3);
                        else this.x = membraneX + (this.radius + 3);
                    }
                }
            }
        }

        // --- MOVEMENT INTEGRATION ---
        if (this.type !== 'sugar') {
            this.x += this.vx;
            this.y += this.vy;
        }

        // --- WALL COLLISIONS (Canvas Boundaries) ---
        if (this.x - this.radius < 0) { this.x = this.radius; this.vx *= -1; }
        if (this.x + this.radius > this.canvasWidth) { this.x = this.canvasWidth - this.radius; this.vx *= -1; }
        if (this.y - this.radius < 0) { this.y = this.radius; this.vy *= -1; }
        if (this.y + this.radius > this.canvasHeight) { this.y = this.canvasHeight - this.radius; this.vy *= -1; }
    }

    draw(ctx, colors) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

        // Use Dynamic Color if provided, else fallback to static
        if (colors) {
            if (this.type === 'water') ctx.fillStyle = colors.water;
            else if (this.type === 'sugar') ctx.fillStyle = colors.sugar;
            else ctx.fillStyle = colors.solute;
        } else {
            ctx.fillStyle = this.color;
        }

        ctx.fill();
        ctx.closePath();
    }
}

// --- MAIN ENGINE ---
class SimulationEngine {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.particles = [];
        this.running = true;

        // Dynamic Theme Colors
        this.currentColors = {
            water: '#5dade2',
            solute: '#e74c3c',
            sugar: '#f1c40f'
        };
        this.frameCounter = 0; // To throttle color updates

        // Resize Canvas to fit container
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Initial Setup
        this.membraneX = this.canvas.width / 2;
        this.switchTab('diffusion'); // Start with Diffusion

        this.animate();
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        this.membraneX = this.canvas.width / 2;
    }

    switchTab(tabName) {
        LAB_STATE.activeTab = tabName;
        this.resetInternal();

        if (tabName === 'diffusion') {
            // Ensure no sugar
            // We wait for user to click "Drop Ink"
            // Start empty or with just air? Let's start with just water (air analogy)
            this.initWaterOnly();
        } else {
            // Osmosis
            this.initOsmosis();
        }
    }

    resetInternal() {
        this.particles = [];
    }

    // -- SCENARIO INIT --

    initWaterOnly() {
        // Just fill with "Air/Water" solvent
        for (let i = 0; i < CONFIG.waterCount; i++) {
            this.particles.push(new Particle(
                Math.random() * this.canvas.width,
                Math.random() * this.canvas.height,
                'water',
                this.canvas.width,
                this.canvas.height
            ));
        }
    }

    initOsmosis() {
        // Water everywhere
        this.initWaterOnly();
        // Add existing sugar if any saved in state
        this.addSugar(LAB_STATE.sugarCount);
    }

    // -- ACTIONS --

    dropInk() {
        // Diffusion specific
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        for (let i = 0; i < 60; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 20;
            this.particles.push(new Particle(
                centerX + Math.cos(angle) * dist,
                centerY + Math.sin(angle) * dist,
                'solute',
                this.canvas.width,
                this.canvas.height
            ));
        }
    }

    updateSugarCount(count) {
        LAB_STATE.sugarCount = count;
        // Rebuild sugar particles
        // Filter out old sugar
        this.particles = this.particles.filter(p => p.type !== 'sugar');
        this.addSugar(count);
    }

    addSugar(count) {
        // Add to Right Side
        for (let i = 0; i < count; i++) {
            const x = this.membraneX + Math.random() * (this.canvas.width - this.membraneX);
            const y = Math.random() * this.canvas.height;
            this.particles.push(new Particle(x, y, 'sugar', this.canvas.width, this.canvas.height));
        }
    }

    // -- PHYSICS LOOP --

    updateThemeColors() {
        const style = getComputedStyle(document.body);
        this.currentColors.water = style.getPropertyValue('--water-color').trim() || '#5dade2';
        this.currentColors.solute = style.getPropertyValue('--solute-color').trim() || '#e74c3c';
        this.currentColors.sugar = style.getPropertyValue('--sugar-color').trim() || '#f1c40f';
    }

    animate() {
        // Update Colors occasionally (every 30 frames ~ 0.5s) to stay responsive to theme changes without LAG
        this.frameCounter++;
        if (this.frameCounter % 30 === 0) {
            this.updateThemeColors();
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update Membrane Position (Responsive)
        this.membraneX = this.canvas.width / 2;

        // -- CALCULATE FORCES (OSMOSIS ONLY) --
        let osmoticForce = 0;
        let hydrostaticForce = 0;
        let leftWater = 0, rightWater = 0;

        if (LAB_STATE.activeTab === 'osmosis') {
            // Analysis
            const sugarCount = this.particles.filter(p => p.type === 'sugar').length;
            this.particles.forEach(p => {
                if (p.type === 'water') {
                    if (p.x < this.membraneX) leftWater++; else rightWater++;
                }
            });

            // Forces
            // 1. Osmotic Pull (Solute attracts water)
            // Constant pull per sugar molecule
            osmoticForce = sugarCount * 0.05;

            // 2. Hydrostatic Pressure (Water level tries to equalize)
            // We want this to grow fast enough to stop the flow before L becomes 0
            const diff = Math.max(0, rightWater - leftWater);

            // Tuned: Lower resistance allows more flow -> larger concentration change visible on graph
            // Was 0.025 (Stopped too early)
            hydrostaticForce = diff * 0.005;
        }

        // -- DRAWING BACKGROUND ELEMENTS --
        if (LAB_STATE.activeTab === 'osmosis') {
            this.drawOsmosisBackground(leftWater, rightWater);
        }

        // -- UPDATE PARTICLES --
        this.particles.forEach(p => {
            p.updateProperties(); // React to slider changes
            p.update(this.membraneX, osmoticForce, hydrostaticForce);
            p.draw(this.ctx, this.currentColors);
        });

        // -- COLLISIONS --
        this.checkCollisions();

        // -- GRAPH UPDATE --
        if (window.graphInstance) {
            let dataPacket = {};

            if (LAB_STATE.activeTab === 'diffusion') {
                // LINE CHART: Diffusion by Concentration Gradient
                // Compare Solute Concentration at Center vs Outer
                const cx = this.canvas.width / 2;
                const cy = this.canvas.height / 2;
                const centerRadius = 80;

                let countCenter = 0;
                let countOuter = 0;
                let soluteTotal = 0;

                this.particles.forEach(p => {
                    if (p.type === 'solute' || p.type === 'ink') {
                        soluteTotal++;
                        const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
                        if (dist < centerRadius) countCenter++;
                        else countOuter++;
                    }
                });

                // Concentration = n / Area (approx Volume)
                // Area Center = PI * r^2
                // Area Outer = (W*H) - Area Center
                // To normalize graph to 0-100 scale, we just plot Raw Counts or Relative Density
                // Better: Relative Density (Count / Area_Factor)

                // Area Factor (Arbitrary for visual scaling to %-like values)
                const areaCenter = Math.PI * centerRadius * centerRadius;
                const areaTotal = this.canvas.width * this.canvas.height;
                const areaOuter = areaTotal - areaCenter;

                // Density
                let densCenter = soluteTotal > 0 ? (countCenter / areaCenter) : 0;
                let densOuter = soluteTotal > 0 ? (countOuter / areaOuter) : 0;

                // Normalized for display (Scale so max initial density is ~100)
                // Initial: 60 particles in Center. 
                const scale = 50000;

                dataPacket = {
                    type: 'line',
                    val1: Math.min(100, densCenter * scale),
                    label1: 'Konsentrasi Pusat',
                    color1: this.currentColors.solute,
                    val2: Math.min(100, densOuter * scale),
                    label2: 'Konsentrasi Pinggir',
                    color2: this.currentColors.water
                };

            } else {
                // BAR CHART: Dual Concentration (Water & Solute)
                const leftSugar = this.particles.filter(p => p.type === 'sugar' && p.x < this.membraneX).length;
                const leftWaterCount = leftWater;
                const leftVol = leftWaterCount + leftSugar || 1;

                const leftConcWater = (leftWaterCount / leftVol) * 100;
                const leftConcSugar = (leftSugar / leftVol) * 100;

                const rightSugar = this.particles.filter(p => p.type === 'sugar' && p.x >= this.membraneX).length;
                const rightWaterCount = rightWater;
                const rightVol = rightWaterCount + rightSugar || 1;

                const rightConcWater = (rightWaterCount / rightVol) * 100;
                const rightConcSugar = (rightSugar / rightVol) * 100;

                dataPacket = {
                    type: 'bar',
                    labels: ['Air (Kr)', 'Air (Kn)', 'Gula (Kr)', 'Gula (Kn)'],
                    values: [leftConcWater, rightConcWater, leftConcSugar, rightConcSugar],
                    // We use the same theme color for pair comparison
                    // L/R Water = Water Color
                    // L/R Sugar = Sugar Color
                    colors: [this.currentColors.water, this.currentColors.water, this.currentColors.sugar, this.currentColors.sugar],
                    maxVal: 100,
                    unit: '%'
                };
            }

            window.graphInstance.render(dataPacket);
        }

        requestAnimationFrame(() => this.animate());
    }

    drawOsmosisBackground(leftW, rightW) {
        this.ctx.beginPath();
        this.ctx.setLineDash([5, 5]);
        this.ctx.moveTo(this.membraneX, 0);
        this.ctx.lineTo(this.membraneX, this.canvas.height);
        this.ctx.strokeStyle = '#888';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    checkCollisions() {
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const p1 = this.particles[i];
                const p2 = this.particles[j];
                if (p1.type === 'water' && p2.type === 'water') continue;

                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = p1.radius + p2.radius;

                if (dist < minDist) {
                    const angle = Math.atan2(dy, dx);
                    const overlap = minDist - dist;
                    p1.x -= Math.cos(angle) * overlap * 0.5;
                    p1.y -= Math.sin(angle) * overlap * 0.5;
                    p2.x += Math.cos(angle) * overlap * 0.5;
                    p2.y += Math.sin(angle) * overlap * 0.5;

                    const tempVx = p1.vx; const tempVy = p1.vy;
                    p1.vx = p2.vx; p1.vy = p2.vy;
                    p2.vx = tempVx; p2.vy = tempVy;
                }
            }
        }
    }
}

// --- GRAPH SYSTEM (Dual Mode: Line & Bar) ---
class GraphSystem {
    constructor() {
        this.canvas = document.getElementById('graphCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.history = [];
        this.maxPoints = 150;
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = 120;
    }

    // Generic render router
    render(packet) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        if (packet.type === 'bar') {
            this.drawBarChart(packet, w, h);
            this.history = []; // Clear line history when in bar mode
        } else {
            // Line Chart Mode
            this.history.push(packet);
            if (this.history.length > this.maxPoints) this.history.shift();
            this.drawLineChart(w, h);
        }
    }

    drawBarChart(packet, w, h) {
        const { labels, values, colors, maxVal } = packet;
        const count = values.length;

        // Dynamic sizing
        // Total usable width = w - padding
        // Bar width depends on how many bars we have
        const padding = 40;
        const usableW = w - padding;
        const gap = 15;
        // usableW = (count * barW) + ((count-1) * gap)
        // barW = (usableW - ((count-1)*gap)) / count
        const barWidth = (usableW - ((count - 1) * gap)) / count;

        const startX = padding / 2;
        const groundY = h - 20;

        values.forEach((val, i) => {
            const x = startX + i * (barWidth + gap);
            const barHeight = (val / maxVal) * (h - 40);
            const y = groundY - barHeight;

            // Bar
            this.ctx.fillStyle = colors[i];
            this.ctx.fillRect(x, y, barWidth, barHeight);

            // Value
            this.ctx.fillStyle = '#333';
            this.ctx.font = 'bold 10px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(Math.round(val) + '%', x + barWidth / 2, y - 5);

            // Label (bottom)
            this.ctx.fillStyle = '#666';
            this.ctx.font = '9px sans-serif';
            this.ctx.fillText(labels[i], x + barWidth / 2, groundY + 12);
        });

        // Main Label
        this.ctx.textAlign = 'right';
        this.ctx.fillStyle = '#999';
        this.ctx.fillText("Konsentrasi", w - 5, 10);
        this.ctx.textAlign = 'left';
    }

    drawLineChart(w, h) {
        if (this.history.length < 2) return;

        // Grid
        this.ctx.strokeStyle = '#f0f0f0';
        this.ctx.beginPath();
        this.ctx.moveTo(0, h * 0.25); this.ctx.lineTo(w, h * 0.25);
        this.ctx.moveTo(0, h * 0.5); this.ctx.lineTo(w, h * 0.5);
        this.ctx.moveTo(0, h * 0.75); this.ctx.lineTo(w, h * 0.75);
        this.ctx.stroke();

        const xStep = w / (this.maxPoints - 1);
        const latest = this.history[this.history.length - 1];

        // Helper to draw a line
        const drawLine = (key, color) => {
            if (latest[key] === undefined) return;
            this.ctx.beginPath();
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 2;
            this.history.forEach((pkt, i) => {
                const val = pkt[key];
                const x = i * xStep;
                const y = h - (val / 100 * h);
                if (i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            });
            this.ctx.stroke();
        };

        // Draw Line 1
        drawLine('val1', latest.color1 || '#2ecc71');

        // Draw Line 2
        if (latest.val2 !== undefined) {
            drawLine('val2', latest.color2 || '#3498db');
        }

        // Legend
        this.ctx.font = '10px sans-serif';
        this.ctx.textAlign = 'right';

        // Legend 1
        this.ctx.fillStyle = latest.color1 || '#2ecc71';
        this.ctx.fillText(latest.label1 || '', w - 10, 15);

        // Legend 2
        if (latest.val2 !== undefined) {
            this.ctx.fillStyle = latest.color2 || '#3498db';
            this.ctx.fillText(latest.label2 || '', w - 10, 28);
        }
        this.ctx.textAlign = 'left';
    }


}

// --- UI CONTROLLER ---
document.addEventListener('DOMContentLoaded', () => {
    const engine = new SimulationEngine();
    window.graphInstance = new GraphSystem();

    // ... (rest of listeners unchanged)

    // -- TAB SWITCHING --
    const tabs = document.querySelectorAll('.nav-tab');
    const sections = {
        'diffusion': document.getElementById('diffusion-controls'),
        'osmosis': document.getElementById('osmosis-controls')
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const target = tab.dataset.tab;
            Object.values(sections).forEach(el => el.classList.add('hidden'));
            sections[target].classList.remove('hidden');

            engine.switchTab(target);
            // Reset Graph
            window.graphInstance.data = [];
        });
    });

    // -- CONTROLS --

    // Reset
    document.getElementById('btnReset').addEventListener('click', () => {
        engine.resetInternal();
        engine.switchTab(LAB_STATE.activeTab);
        document.getElementById('sugarSlider').value = 0;
        document.getElementById('sugarValue').innerText = '0 Partikel';
        engine.updateSugarCount(0);
    });


    // Theme System (Modal)
    const allThemes = [
        { id: 'default', name: 'PhET Classic' },
        { id: 'protanopia', name: 'Protanopia Safe' },
        { id: 'deuteranopia', name: 'Deuteranopia Safe' },
        { id: 'tritanopia', name: 'Tritanopia Safe' },
        { id: 'dark', name: 'Night Mode' },
        { id: 'nature', name: 'Nature Green' },
        { id: 'ocean', name: 'Ocean Blue' },
        { id: 'sunset', name: 'Sunset Orange' },
        { id: 'berry', name: 'Berry Purple' },
        { id: 'mono', name: 'Monochrome' },
        { id: 'royal', name: 'Royal Gold' },
        { id: 'mint', name: 'Fresh Mint' },
        { id: 'cyber', name: 'Cyber Neon' }
    ];

    const modal = document.getElementById('settingsModal');
    const themeGrid = document.getElementById('themeGrid');

    // Generate Theme Buttons
    allThemes.forEach(t => {
        const btn = document.createElement('div');
        btn.className = 'theme-btn';
        if (t.id === 'default') btn.classList.add('active');
        btn.innerText = t.name;
        btn.onclick = () => {
            // Apply Theme
            if (t.id === 'default') document.body.removeAttribute('data-theme');
            else document.body.setAttribute('data-theme', t.id);

            // UI Update
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
        themeGrid.appendChild(btn);
    });

    // Open Modal
    document.getElementById('btnSettings').addEventListener('click', () => {
        modal.classList.add('active');
    });

    // Close Modal
    document.getElementById('closeSettings').addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });


    // Temp
    const tempSlider = document.getElementById('tempSlider');
    const tempValue = document.getElementById('tempValue');
    tempSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        LAB_STATE.temp = val;
        tempValue.innerText = `${val}°C`;
    });
    // Ink Drop
    document.getElementById('inkDropBtn').addEventListener('click', () => {
        engine.dropInk();
    });

    document.querySelectorAll('input[name="molSize"]').forEach(r => {
        r.addEventListener('change', (e) => {
            LAB_STATE.molSize = e.target.value;
        });
    });

    const sugarSlider = document.getElementById('sugarSlider');
    const sugarValue = document.getElementById('sugarValue');
    sugarSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        sugarValue.innerText = `${val} Partikel`;
        engine.updateSugarCount(val);
    });

    const permSlider = document.getElementById('permeabilitySlider');
    const permValue = document.getElementById('permValue');
    permSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        LAB_STATE.permeability = val;
        permValue.innerText = `${val}%`;
    });
});
