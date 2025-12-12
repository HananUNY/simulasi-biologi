// Konfigurasi Umum
const CONFIG = {
    particleRadius: 3, // Smaller water
    sugarRadius: 12, // Much larger sugar
    baseSpeed: 1.5,
    osmosisSpeed: 1,
    waterColor: '#3b82f6',
    sugarColor: '#fbbf24', // Warmer yellow
    inkColor: '#ef4444',
    waterCount: 150, // Slight adjust
    gravity: 0.1
};

// Global Lab State
const LAB_STATE = {
    temp: 25, // 0 - 80
    molSize: 'small', // 'small' | 'large'
    permeability: 0 // 0 - 100%
};

// --- KELAS PARTIKEL ---
class Particle {
    constructor(x, y, type, canvasWidth, canvasHeight) {
        this.x = x;
        this.y = y;
        this.type = type; // 'water', 'sugar', 'ink'
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;

        // Initial Velocity (Random)
        const v = (Math.random() - 0.5) * CONFIG.baseSpeed;
        this.vx = v;
        this.vy = v;

        this.updateProperties();
    }

    // Update physical properties based on LAB_STATE
    updateProperties() {
        // Radius based on type
        this.radius = this.type === 'sugar' ? CONFIG.sugarRadius : CONFIG.particleRadius;

        // Ink specific size logic
        if (this.type === 'ink') {
            // Jika 'large', radius visual mungkin tetap, tapi mass/inertia berubah (simulasi speed)
            // Di sini kita ubah radius sedikit biar user 'melihat' bedanya
            this.radius = LAB_STATE.molSize === 'large' ? 8 : 4;
        }

        this.color = this.getColor(this.type);
    }

    getColor(type) {
        if (type === 'water') return CONFIG.waterColor;
        if (type === 'sugar') return CONFIG.sugarColor;
        if (type === 'ink') return CONFIG.inkColor;
        return '#000';
    }

    update(membraneX = null, osmoticForce = 0, hydrostaticForce = 0, surfaceY = null) {
        // 1. Hitung Speed Multiplier berdasarkan SUHU
        // Rumus sederhana: V ~ sqrt(T). Kita linear saja biar gampang terasa bedanya.
        // Base temp 25°C -> multiplier 1.
        // 0°C -> 0.2, 80°C -> 2.5
        let tempMultiplier = 0.2 + (LAB_STATE.temp / 40);

        // 2. Hitung Inertia Multiplier berdasarkan UKURAN MOLEKUL (Hanya ink)
        let sizeMultiplier = 1;
        if (this.type === 'ink' && LAB_STATE.molSize === 'large') {
            sizeMultiplier = 0.4; // Lebih lambat/berat
        }

        // 3. TRUE BROWNIAN MOTION (Random Jitter)
        // Agar tidak terlihat "rapi" balistik, kita ubah arah sedikit setiap frame
        if (this.type === 'ink' || this.type === 'water') {
            const jitter = 0.5; // Kekuatan getaran acak
            this.vx += (Math.random() - 0.5) * jitter;
            this.vy += (Math.random() - 0.5) * jitter;

            // Damping velocities to prevent explosion but allow wandering
            // Normalisasi speed agar tidak terus bertambah
            const currentSpeed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
            const targetSpeed = CONFIG.baseSpeed * tempMultiplier * sizeMultiplier;

            if (currentSpeed > 0) {
                this.vx = (this.vx / currentSpeed) * targetSpeed;
                this.vy = (this.vy / currentSpeed) * targetSpeed;
            }
        } else {
            // Sugar behaves more Newtonian/Ballistic for now, or apply same
            // Let's apply simple motion for sugar too
            this.x += this.vx * tempMultiplier;
            this.y += this.vy * tempMultiplier;
            // Sugar collision logic mostly handled below
        }

        // 4. APPLY FORCES (Osmosis / Pressure) - EFFECTIVE FLOW LOGIC
        if (this.type === 'water' && membraneX !== null) {
            // Calculate distance to membrane for zone-based logic
            const dist = this.x - membraneX;

            if (this.x < membraneX) {
                // Left Side (Hypotonic):
                // Apply Osmotic Pull
                this.vx += osmoticForce;

                // CRITICAL FIX: Prevent "Gathering" / Stagnation
                // If particle is near membrane and should move right, FORCE positive velocity.
                // This overcomes random Brownian motion pointing left.
                if (this.x > membraneX - 50 && osmoticForce > 0) {
                    if (this.vx < 0.5) this.vx = 0.5 + Math.random(); // Minimum forward speed
                }
            } else {
                // Right Side (Hypertonic):
                // Apply Hydrostatic Back-Pressure
                this.vx -= hydrostaticForce;
            }
        }

        // Apply movement (velocity integration)
        // Note: For Brownian particles, we already normalized v to targetSpeed
        if (this.type !== 'sugar') {
            this.x += this.vx;
            this.y += this.vy;
        }

        // Pantulan Dinding Luar
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx *= -1;
        }
        if (this.x + this.radius > this.canvasWidth) {
            this.x = this.canvasWidth - this.radius;
            this.vx *= -1;
        }
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.vy *= -1;
        }
        if (this.y + this.radius > this.canvasHeight) {
            this.y = this.canvasHeight - this.radius;
            this.vy *= -1;
        }

        // Logika Membran (Khusus Osmosis)
        if (membraneX !== null) {
            if (this.type === 'sugar') {
                // Logika Permeabilitas
                // Default: Bounce if < membraneX (Assuming coming from right)
                // Permeability 0% -> Always bounce
                // Permeability 100% -> Never bounce (Treat as water)

                // Cek collision membran
                // Asumsi gula start di kanan.
                // Jika mau ke kiri:
                if (this.x - this.radius < membraneX && this.vx < 0) {
                    // Cek probability tembus
                    const chanceToPass = LAB_STATE.permeability / 100;

                    if (Math.random() > chanceToPass) {
                        // MENTAL (Bounce)
                        this.x = membraneX + this.radius;
                        this.vx *= -1;
                    }
                    // Else: Tembus (Nothing happens, just pass x)
                }

                // Jika sudah di kiri, mau balik ke kanan (optional, biasanya permeable 2 arah)
                if (this.x + this.radius > membraneX && this.vx > 0 && this.x < membraneX) {
                    const chanceToPass = LAB_STATE.permeability / 100;
                    if (Math.random() > chanceToPass) {
                        this.x = membraneX - this.radius;
                        this.vx *= -1;
                    }
                }
            }
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

// --- CLASS GRAPH ---
class RealTimeGraph {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width = this.canvas.parentElement.clientWidth;
        this.height = this.canvas.height = 200;

        this.dataPoints = [];
        this.maxPoints = 200; // X axis length
        // Mock data update loop
        setInterval(() => this.updateGraph(), 100);
    }

    // Kita akan panggil ini dari simulasi utama untuk push data nyata
    // Data = Indeks Kesetimbangan (0 - 100%)
    pushData(value) {
        this.dataPoints.push(value);
        if (this.dataPoints.length > this.maxPoints) {
            this.dataPoints.shift();
        }
    }

    updateGraph() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        if (this.dataPoints.length < 2) return;

        this.ctx.beginPath();
        this.ctx.moveTo(0, this.height - (this.dataPoints[0] / 100 * this.height));

        for (let i = 1; i < this.dataPoints.length; i++) {
            const x = (i / (this.maxPoints - 1)) * this.width;
            const y = this.height - (this.dataPoints[i] / 100 * this.height);
            this.ctx.lineTo(x, y);
        }

        this.ctx.strokeStyle = '#2563eb';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }
}

// --- DIFUSI SIMULASI ---
class DiffusionSimulation {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.running = false;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        document.getElementById('inkDropBtn').addEventListener('click', () => this.dropInk());

        this.animate();
    }

    resize() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
    }

    dropInk() {
        this.particles = [];
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Initial cluster is slightly less perfect
        for (let i = 0; i < 100; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 15; // Random radius cluster
            const x = centerX + Math.cos(angle) * dist;
            const y = centerY + Math.sin(angle) * dist;
            const p = new Particle(x, y, 'ink', this.canvas.width, this.canvas.height);
            this.particles.push(p);
        }

        document.getElementById('diffusionStatus').innerText = "Tinta menetes... Mengamati Gerak Brown Acak.";
        this.running = true;
    }

    // Hitung sebaran partikel (Standard Deviation dari pusat)
    calculateSpread() {
        if (this.particles.length === 0) return 0;

        // 1. Cari centroid
        let sumX = 0, sumY = 0;
        this.particles.forEach(p => { sumX += p.x; sumY += p.y; });
        const avgX = sumX / this.particles.length;
        const avgY = sumY / this.particles.length;

        // 2. Hitung rata-rata jarak dari centroid
        let totalDist = 0;
        this.particles.forEach(p => {
            const dx = p.x - avgX;
            const dy = p.y - avgY;
            totalDist += Math.sqrt(dx * dx + dy * dy);
        });

        // Normalize 0-100 (Max distance approx half canvas diagonal)
        const meanDist = totalDist / this.particles.length;
        const maxDist = Math.sqrt(this.canvas.width ** 2 + this.canvas.height ** 2) / 4;

        return Math.min(100, (meanDist / maxDist) * 100);
    }

    animate() {
        // Visual Background Color based on Temp
        // Cold (0) -> Blueish, Hot (80) -> Reddish
        // 0 -> hue 210, 80 -> hue 0
        // Simple interpolation
        const hue = 210 - (LAB_STATE.temp / 80 * 210);
        this.ctx.fillStyle = `hsl(${hue}, 80%, 95%)`; // very light bg
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach(p => {
            p.updateProperties(); // Cek jika user ubah size/temp
            p.update();
            p.draw(this.ctx);
        });

        // Push data ke global graph (Kita pakai difusi sebagai sumber data utama "Kesetimbangan")
        if (window.graphInstance && this.running) {
            const spread = this.calculateSpread();
            // Spread makin besar = makin setimbang (equilibrium)
            // spread ~ 0 (kumpul) -> 100 (rata)
            // Tapi spread 100 purely rata susah dicapai, kita scaling dikit
            window.graphInstance.pushData(spread * 1.5);
        }

        requestAnimationFrame(() => this.animate());
    }
}

// --- OSMOSIS SIMULASI ---
class OsmosisSimulation {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.slider = document.getElementById('sugarSlider');
        this.slider.addEventListener('input', (e) => this.updateSugar(e.target.value));

        this.initWater();
        // this.animate(); // Dipanggil di initWater agar tidak double loop jika logic berubah
        this.animate();
    }

    resize() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
        this.membraneX = this.canvas.width / 2;
    }

    initWater() {
        // Clear sugar only or reset all? Reset all safer for temp changes
        // Keep existing sugar count logic
        const currentSugar = this.particles.filter(p => p.type === 'sugar').length;

        this.particles = [];
        for (let i = 0; i < CONFIG.waterCount; i++) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            this.particles.push(new Particle(x, y, 'water', this.canvas.width, this.canvas.height));
        }

        // Restore sugar if any
        if (currentSugar > 0) {
            this.addSugarParticles(currentSugar);
        }
    }

    addSugarParticles(count) {
        for (let i = 0; i < count; i++) {
            const x = this.membraneX + Math.random() * (this.canvas.width - this.membraneX);
            const y = Math.random() * this.canvas.height;
            this.particles.push(new Particle(x, y, 'sugar', this.canvas.width, this.canvas.height));
        }
    }

    updateSugar(val) {
        const count = parseInt(val);
        document.getElementById('sugarValue').innerText = count;

        // Remove old sugar
        this.particles = this.particles.filter(p => p.type !== 'sugar');

        // Add new sugar
        this.addSugarParticles(count);

        if (count > 0) {
            document.getElementById('osmosisStatus').innerText = "Air bergerak menyeimbangkan konsentrasi.";
        }
    }

    checkCollisions() {
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const p1 = this.particles[i];
                const p2 = this.particles[j];

                // OPTIMIZATION FOR FLOW:
                // Ignore interactions between Water and Sugar to prevents "Clogging" at the membrane.
                // This allows Water to flow "around/through" the large sugar molecules freely,
                // ensuring the Osmotic Force is the dominant driver of movement.
                if ((p1.type === 'water' && p2.type === 'sugar') ||
                    (p1.type === 'sugar' && p1.type === 'water')) {
                    continue;
                }
                // Also ignore Ink-Sugar if needed, but mainly Water-Sugar is the blocker.
                if (p1.type !== p2.type && (p1.type === 'sugar' || p2.type === 'sugar')) continue;


                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDist = p1.radius + p2.radius;

                if (distance < minDist) {
                    const angle = Math.atan2(dy, dx);
                    const overlap = minDist - distance;
                    const moveX = Math.cos(angle) * overlap * 0.5;
                    const moveY = Math.sin(angle) * overlap * 0.5;

                    p1.x -= moveX;
                    p1.y -= moveY;
                    p2.x += moveX;
                    p2.y += moveY;

                    const tempVx = p1.vx;
                    const tempVy = p1.vy;
                    p1.vx = p2.vx;
                    p1.vy = p2.vy;
                    p2.vx = tempVx;
                    p2.vy = tempVy;
                }
            }
        }
    }

    animate() {
        // Clear Background (White) representing empty space/glass
        this.ctx.fillStyle = "#ffffff";
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const sugarCount = this.particles.filter(p => p.type === 'sugar').length;
        const totalWater = this.particles.filter(p => p.type === 'water').length;

        // Count Water on Left vs Right
        let leftWater = 0;
        let rightWater = 0;
        this.particles.forEach(p => {
            if (p.type === 'water') {
                if (p.x < this.membraneX) leftWater++;
                else rightWater++;
            }
        });

        // --- PHYSICS CALCULATION ---
        // 1. Osmotic Force (Solute Potential)
        // Proportional to solute concentration difference (here just solute count on R)
        // Tune this constant to control "Strength" of osmosis
        const kOsmosis = 0.15; // Very Strong pull to overcome any resistance
        const osmoticForce = sugarCount * kOsmosis;

        // 2. Hydrostatic Pressure (Pressure Potential)
        // Proportional to water level difference (Right - Left)
        // Resists the flow. Kept low to prevent "wall" feeling.
        const levelDiff = Math.max(0, rightWater - leftWater);
        const kPressure = 0.005;
        const hydrostaticForce = levelDiff * kPressure;

        // CALCULATE VOLUME-BASED LEVELS
        // Base height for 50% particles
        const baseHeight = this.canvas.height * 0.6; // 60% filled typically
        // Scale factor: Total water should fill roughly baseHeight * 2 (divided by 2 sides)
        // Height = (Count / Total) * MaxPossibleHeight

        // Let's say max fill is 90% of canvas height if ALL water is on one side.
        const maxFillPixels = this.canvas.height * 0.9;

        // Safety check for divide by zero
        const safeTotal = totalWater > 0 ? totalWater : 1;
        const leftFillH = (leftWater / safeTotal) * maxFillPixels * 1.5;
        const rightFillH = (rightWater / safeTotal) * maxFillPixels * 1.5;

        // Ensure reasonable minimums/maximums visually
        const leftMinY = this.canvas.height - Math.max(50, leftFillH);
        const rightMinY = this.canvas.height - Math.max(50, rightFillH);

        // Draw Membrane
        this.ctx.beginPath();
        this.ctx.setLineDash([5, 5]);
        this.ctx.moveTo(this.membraneX, 0);
        this.ctx.lineTo(this.membraneX, this.canvas.height);
        this.ctx.strokeStyle = '#94a3b8';
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Background Labels "A" and "B" (Watermarks) - DRAW FIRST (behind particles)
        this.ctx.font = "bold 80px Inter";
        this.ctx.fillStyle = "rgba(148, 163, 184, 0.2)"; // Faint gray
        this.ctx.textAlign = "center";
        this.ctx.fillText("A", this.membraneX / 2, this.canvas.height / 2 + 30);
        this.ctx.fillText("B", this.membraneX + (this.membraneX / 2), this.canvas.height / 2 + 30);


        // Visual Liquid FILLS (Draw behind particles)
        // Left Fill (Pure Water)
        this.ctx.fillStyle = "#dbeafe";
        this.ctx.fillRect(0, leftMinY, this.membraneX, this.canvas.height - leftMinY);

        // Right Fill
        this.ctx.fillStyle = "#dbeafe"; // Changed to be same blue as left side
        this.ctx.fillRect(this.membraneX, rightMinY, this.canvas.width - this.membraneX, this.canvas.height - rightMinY);

        // Water Level Lines & Arrows
        this.ctx.beginPath();
        this.ctx.moveTo(0, leftMinY);
        this.ctx.lineTo(this.membraneX, leftMinY);
        this.ctx.strokeStyle = '#2563eb';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(this.membraneX, rightMinY);
        this.ctx.lineTo(this.canvas.width, rightMinY);
        this.ctx.strokeStyle = '#2563eb'; // Ensure blue line to match liquid
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        // Draw BIG ARROW for Net Movement if Sugar is present
        if (sugarCount > 0 && LAB_STATE.permeability < 50) {
            const arrowY = this.canvas.height / 2;
            const arrowStart = this.membraneX - 40;
            const arrowEnd = this.membraneX + 40;

            this.ctx.beginPath();
            this.ctx.moveTo(arrowStart, arrowY);
            this.ctx.lineTo(arrowEnd, arrowY);
            this.ctx.lineTo(arrowEnd - 10, arrowY - 10);
            this.ctx.moveTo(arrowEnd, arrowY);
            this.ctx.lineTo(arrowEnd - 10, arrowY + 10);
            this.ctx.strokeStyle = "rgba(37, 99, 235, 0.7)";
            this.ctx.lineWidth = 6;
            this.ctx.lineCap = "round";
            this.ctx.stroke();

            // Text Label for Arrow
            this.ctx.fillStyle = "#1e40af";
            this.ctx.font = "bold 12px Inter";
            this.ctx.fillText("Osmosis", this.membraneX, arrowY - 15);
            this.ctx.font = "10px Inter";
            this.ctx.fillText("(Air Pindah)", this.membraneX, arrowY + 25);
        }

        // UPDATE PARTICLE and Enforce Surface
        this.particles.forEach(p => {
            p.updateProperties();

            // Determine surface Y for this particle
            let limitY = null;
            if (p.x < this.membraneX) limitY = leftMinY;
            else limitY = rightMinY;

            p.update(this.membraneX, osmoticForce, hydrostaticForce, limitY);
            p.draw(this.ctx);
        });

        this.checkCollisions();

        // --- DRAW LABELS & LEGEND LAST (ON TOP) ---

        // Potensial Air text labels removed as per instruction.

        // CUSTOM LEGEND (Top Right)
        const legendX = this.canvas.width - 160;
        const legendY = 10;

        // Semi-transparent background for legend so it pops over particles
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        this.ctx.fillRect(legendX, legendY, 150, 70);
        this.ctx.strokeStyle = "#cbd5e1";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(legendX, legendY, 150, 70);

        this.ctx.textAlign = "right";
        this.ctx.font = "11px Inter";
        this.ctx.fillStyle = "#475569";

        // Legend Text
        this.ctx.fillText("Garis Putus: Membran", this.canvas.width - 20, legendY + 20);
        this.ctx.fillText("Kuning: Gula (Besar)", this.canvas.width - 20, legendY + 40);
        this.ctx.fillText("Biru: Air (Kecil)", this.canvas.width - 20, legendY + 60);

        this.ctx.textAlign = "center"; // Cleanup

        requestAnimationFrame(() => this.animate());
    }
}

// --- SETUP CONTROLS & INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Init Sims
    new DiffusionSimulation('diffusionCanvas');
    new OsmosisSimulation('osmosisCanvas');

    // 2. Init Graph
    window.graphInstance = new RealTimeGraph('graphCanvas');

    // 3. Init Controls Listeners

    // Suhu
    const tempSlider = document.getElementById('tempSlider');
    const tempValue = document.getElementById('tempValue');
    tempSlider.addEventListener('input', (e) => {
        LAB_STATE.temp = parseInt(e.target.value);
        tempValue.innerText = `${LAB_STATE.temp}°C`;
    });

    // Molekul Size
    const molToggle = document.querySelectorAll('input[name="molSize"]');
    molToggle.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) LAB_STATE.molSize = e.target.value;
        });
    });

    // Permeabilitas
    const permSlider = document.getElementById('permeabilitySlider');
    const permValue = document.getElementById('permValue');
    permSlider.addEventListener('input', (e) => {
        LAB_STATE.permeability = parseInt(e.target.value);
        permValue.innerText = `${LAB_STATE.permeability}%`;
    });
});
