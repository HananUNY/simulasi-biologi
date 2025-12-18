/**
 * Logika Simulasi Climate Change
 * Adapted for Modern UI with "Follow Ray" and "Dynamic Graph"
 */

const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const graphCanvas = document.getElementById('graphCanvas');
const gCtx = graphCanvas.getContext('2d');

// --- Global Variables & State ---
let width, height;
let skyTop, earthTop;
let temperature = 12;
// Graph History
const tempHistory = [];

// Agents Lists
let rays = [];
let heats = [];
let irs = [];
let co2s = [];
let clouds = [];

// Tracking State
let trackedParticle = null;
let trackedState = ""; // Description text
let isFollowing = false;

// Parameters from UI
const params = {
    sunBrightness: 1.0,
    albedo: 0.6,
    co2Amount: 25,
    cloudClusters: 1,
    simSpeed: 1
};

// --- Setup & Resize ---

function resize() {
    // Resize Main Canvas
    const container = canvas.parentElement;
    width = container.clientWidth;
    height = container.clientHeight;

    canvas.width = width;
    canvas.height = height;

    // Resize Graph Canvas
    const graphContainer = graphCanvas.parentElement;
    graphCanvas.width = graphContainer.clientWidth;
    graphCanvas.height = graphContainer.clientHeight;

    // Define Zones based on height
    skyTop = height * 0.1;      // Space is top 10%
    earthTop = height * 0.85;   // Earth surface at 85%
}

function init() {
    temperature = 12;
    rays = [];
    heats = [];
    irs = [];
    co2s = [];
    clouds = [];
    tempHistory.length = 0;

    // Reset tracking
    trackedParticle = null;
    trackedState = "";
    updateTrackingUI();

    // Initial Population
    updateCO2Count();
    updateCloudCount();
}

function toggleFollow() {
    if (trackedParticle) {
        // Cancel following
        trackedParticle = null;
        trackedState = "";
        isFollowing = false;
    } else {
        // Start following - wait for next ray spawn or pick existing
        isFollowing = true;
        trackedState = "Waiting for sunlight...";
    }
    updateTrackingUI();
}

function updateTrackingUI() {
    const btn = document.getElementById('btn-follow');
    const statusLabel = document.getElementById('track-status');

    if (!btn || !statusLabel) return; // Safety check

    if (trackedParticle || isFollowing) {
        btn.classList.remove('bg-slate-700', 'text-slate-300');
        btn.classList.add('bg-amber-600', 'text-white', 'animate-pulse');
        btn.innerHTML = `
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            Stop Following
        `;
        statusLabel.innerText = trackedState || "Tracking...";
        statusLabel.classList.remove('opacity-0');
    } else {
        btn.classList.add('bg-slate-700', 'text-slate-300');
        btn.classList.remove('bg-amber-600', 'text-white', 'animate-pulse');
        btn.innerHTML = `
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            Follow Energy
        `;
        statusLabel.innerText = "";
        statusLabel.classList.add('opacity-0');
    }
}

// --- Classes / Agents ---

class Ray {
    constructor() {
        this.x = Math.random() * width;
        this.y = 0; // Start at top
        this.speed = 3;
        this.heading = Math.PI / 2 + (Math.random() * 0.2 - 0.1); // Downwards roughly
        this.dead = false;

        // Auto-track if waiting
        if (isFollowing && !trackedParticle) {
            trackedParticle = this;
            trackedState = "Incoming Sunlight";
            updateTrackingUI();
        }
    }

    move() {
        this.x += Math.cos(this.heading) * this.speed;
        this.y += Math.sin(this.heading) * this.speed;

        // Hit Cloud?
        for (let c of clouds) {
            if (this.x > c.x && this.x < c.x + c.w && Math.abs(this.y - c.y) < 10) {
                this.heading = -this.heading; // Reflect back up
                if (trackedParticle === this) {
                    trackedState = "Reflected by Cloud";
                    updateTrackingUI();
                }
                return;
            }
        }

        // Hit Earth?
        if (this.y >= earthTop) {
            // Check Albedo
            if (Math.random() < params.albedo) {
                // Reflected
                this.heading = -this.heading;
                this.y = earthTop - 1;
                if (trackedParticle === this) {
                    trackedState = "Reflected by Surface";
                    updateTrackingUI();
                }
            } else {
                // Absorbed -> Become Heat
                this.dead = true;
                let h = new Heat(this.x, earthTop + Math.random() * 10);
                heats.push(h);

                // Handoff Tracking
                if (trackedParticle === this) {
                    trackedParticle = h;
                    trackedState = "Absorbed as Heat";
                    updateTrackingUI();
                }
            }
        }

        // Out of bounds (Side or Top)
        if (this.x < 0 || this.x > width || this.y < -10) {
            this.dead = true;
            if (trackedParticle === this) {
                trackedParticle = null;
                trackedState = "Reflected to Space";
                isFollowing = false; // Stop
                updateTrackingUI();
            }
        }
    }

    draw() {
        // Highlight tracked ray
        const isTracked = (trackedParticle === this);
        ctx.strokeStyle = isTracked ? '#f97316' : '#facc15'; // Orange-500 for tracked
        ctx.lineWidth = isTracked ? 5 : 2;
        ctx.shadowBlur = isTracked ? 15 : 5;
        ctx.shadowColor = isTracked ? '#f97316' : '#facc15';

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - Math.cos(this.heading) * 12, this.y - Math.sin(this.heading) * 12);
        ctx.stroke();

        ctx.shadowBlur = 0;
    }
}

class Heat {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.dead = false;
    }

    move() {
        // Random walk inside earth
        this.x += (Math.random() - 0.5) * 4;
        this.y += (Math.random() - 0.5) * 4;

        // Keep inside earth bounds roughly
        if (this.y < earthTop) {
            // Trying to escape to sky
            // Logic: Higher temp = higher chance to escape as IR
            let escapeChance = (temperature - 10) / 100;
            if (escapeChance > Math.random()) {
                this.dead = true;
                let r = new IR(this.x, earthTop - 1);
                irs.push(r);

                // Handoff Tracking
                if (trackedParticle === this) {
                    trackedParticle = r;
                    trackedState = "Radiated as IR";
                    updateTrackingUI();
                }
            } else {
                this.y = earthTop + 1; // Bounce back down
            }
        }
        if (this.y > height) this.y = height;
        if (this.x < 0) this.x = 0;
        if (this.x > width) this.x = width;
    }

    draw() {
        const isTracked = (trackedParticle === this);
        // Vary red based on location
        ctx.fillStyle = isTracked ? '#f97316' : `rgba(${200 + Math.random() * 55}, 50, 50, 0.8)`;

        ctx.beginPath();
        ctx.arc(this.x, this.y, isTracked ? 6 : 3, 0, Math.PI * 2);
        ctx.fill();

        if (isTracked) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#f97316';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }
}

class IR {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.heading = -Math.PI / 2 + (Math.random() * 0.5 - 0.25); // Upwards
        this.speed = 2;
        this.dead = false;
    }

    move() {
        this.x += Math.cos(this.heading) * this.speed;
        this.y += Math.sin(this.heading) * this.speed;

        // Hit Earth again? (if reflected down)
        if (this.y >= earthTop) {
            this.dead = true;
            let h = new Heat(this.x, earthTop + 2);
            heats.push(h);

            if (trackedParticle === this) {
                trackedParticle = h;
                trackedState = "Re-absorbed as Heat";
                updateTrackingUI();
            }
            return;
        }

        // Hit CO2?
        for (let co2 of co2s) {
            // Simple proximity check
            let dx = this.x - co2.x;
            let dy = this.y - co2.y;
            if (dx * dx + dy * dy < 144) { // radius ~12
                this.heading = -this.heading; // Reflect (Greenhouse effect)
                this.heading += (Math.random() - 0.5); // Add flutter
                this.y += Math.sin(this.heading) * 5; // Bump away

                if (trackedParticle === this) {
                    trackedState = "Trapped by CO₂";
                    updateTrackingUI();
                }

                break; // Only hit one
            }
        }

        // Out of bounds (Space)
        if (this.y < 0) {
            this.dead = true;
            if (trackedParticle === this) {
                trackedParticle = null;
                trackedState = "Escaped to Space";
                isFollowing = false;
                updateTrackingUI();
            }
        }
        if (this.x < 0 || this.x > width) this.dead = true;
    }

    draw() {
        const isTracked = (trackedParticle === this);
        ctx.strokeStyle = isTracked ? '#f97316' : '#d946ef'; // Fuchsia-500
        ctx.lineWidth = isTracked ? 5 : 2;
        if (isTracked) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#f97316';
        }

        ctx.beginPath();
        // Draw zigzag line to look like a wave
        let lx = this.x;
        let ly = this.y;
        let len = 12;
        ctx.moveTo(lx, ly);
        // ZigZag visual
        let angle = this.heading;
        let cx = lx - Math.cos(angle) * len;
        let cy = ly - Math.sin(angle) * len;

        let midX = (lx + cx) / 2 + Math.sin(angle + Math.PI / 2) * 4;
        let midY = (ly + cy) / 2 - Math.cos(angle + Math.PI / 2) * 4;

        ctx.quadraticCurveTo(midX, midY, cx, cy);
        ctx.stroke();

        ctx.shadowBlur = 0;
    }
}

class CO2 {
    constructor() {
        this.x = Math.random() * width;
        this.y = skyTop + Math.random() * (earthTop - skyTop);
        this.blinkOffset = Math.random() * 100;
    }

    move() {
        // Slight jitter
        this.x += (Math.random() - 0.5) * 0.5;
        this.y += (Math.random() - 0.5) * 0.5;

        // Keep in atmosphere
        if (this.y < skyTop) this.y = skyTop;
        if (this.y > earthTop) this.y = earthTop;
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
    }

    draw() {
        // Pulse effect
        let pulse = Math.sin((Date.now() / 200) + this.blinkOffset);
        let alpha = 0.4 + (pulse * 0.2); // 0.2 to 0.6

        ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`; // Green-500
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(this.x - 1, this.y - 1, 1, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Cloud {
    constructor() {
        this.w = 100 + Math.random() * 100;
        this.h = 30;
        this.x = Math.random() * (width - this.w);
        this.y = earthTop - (Math.random() * (earthTop - skyTop) * 0.6) - 50;
        this.speed = (Math.random() * 0.5) + 0.1;
        this.opacity = 0.7 + Math.random() * 0.2;
    }

    move() {
        this.x += this.speed;
        if (this.x > width) {
            this.x = -this.w;
            this.y = earthTop - (Math.random() * (earthTop - skyTop) * 0.6) - 50;
        }
    }

    draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        // Simple puff drawing
        ctx.beginPath();
        ctx.arc(this.x + this.w * 0.2, this.y, 25, 0, Math.PI * 2);
        ctx.arc(this.x + this.w * 0.5, this.y - 10, 35, 0, Math.PI * 2);
        ctx.arc(this.x + this.w * 0.8, this.y, 25, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- Main Loop Functions ---

function updateCO2Count() {
    // Re-check width boundaries for new CO2 if resized
    const diff = params.co2Amount - co2s.length;
    if (diff > 0) {
        for (let i = 0; i < diff; i++) co2s.push(new CO2());
    } else if (diff < 0) {
        co2s.splice(0, Math.abs(diff));
    }
}

function updateCloudCount() {
    const diff = params.cloudClusters - clouds.length;
    if (diff > 0) {
        for (let i = 0; i < diff; i++) clouds.push(new Cloud());
    } else if (diff < 0) {
        clouds.splice(0, Math.abs(diff));
    }
}

function drawBackground() {
    // Space (Top 10%)
    // Dark Void
    ctx.fillStyle = '#020617'; // Slate-950
    ctx.fillRect(0, 0, width, skyTop);

    // Stars in space
    if (Math.random() < 0.2) {
        // Sparkle effect could be here, but let's keep it static for perf or just simple
    }

    // Atmosphere (Gradient)
    // Beautiful Sky Gradient
    let grd = ctx.createLinearGradient(0, skyTop, 0, earthTop);
    grd.addColorStop(0, '#0ea5e9'); // Sky-500
    grd.addColorStop(0.4, '#7dd3fc'); // Sky-300
    grd.addColorStop(1, '#e0f2fe'); // Sky-100
    ctx.fillStyle = grd;
    ctx.fillRect(0, skyTop, width, earthTop - skyTop);

    // Earth
    // Gradient Ground
    let earthGrd = ctx.createLinearGradient(0, earthTop, 0, height);
    earthGrd.addColorStop(0, '#57534e'); // Stone-600
    earthGrd.addColorStop(1, '#292524'); // Stone-800
    ctx.fillStyle = earthGrd;
    ctx.fillRect(0, earthTop, width, height - earthTop);

    // Earth Surface (Albedo visualization)
    // The lighter the green/white, the higher the albedo
    let albedoVal = Math.floor(params.albedo * 255);
    // Mix White (Ice) and Green/Brown (Land)
    // Low Albedo = Dark Land, High Albedo = White Ice
    // Let's make it look nicer:
    // 0.0 -> Dark Green/Brown
    // 1.0 -> White

    // Interpolate color
    let r = 34 + (255 - 34) * params.albedo;
    let g = 139 + (255 - 139) * params.albedo;
    let b = 34 + (255 - 34) * params.albedo;

    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, earthTop, width, 8); // Thicker surface line

    // Add aesthetic border line
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(0, earthTop);
    ctx.lineTo(width, earthTop);
    ctx.stroke();
}

function updateGraph() {
    // Clear
    gCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);

    const w = graphCanvas.width;
    const h = graphCanvas.height;

    // Background grid lines
    gCtx.strokeStyle = 'rgba(255,255,255,0.1)';
    gCtx.lineWidth = 1;
    gCtx.beginPath();
    // Horizontal lines (0, 25%, 50%, 75%, 100%)
    for (let i = 0; i <= 4; i++) {
        let y = h * (i / 4);
        gCtx.moveTo(0, y);
        gCtx.lineTo(w, y);
    }
    gCtx.stroke();

    if (tempHistory.length < 2) return;

    // Scale
    const minT = 0;
    const maxT = 40;
    const range = maxT - minT;

    // Draw Area under curve
    gCtx.fillStyle = 'rgba(239, 68, 68, 0.2)'; // Red-500 transparent
    gCtx.beginPath();
    gCtx.moveTo(0, h); // Start bottom left

    // Dynamic Scaling X-Axis
    // The entire history is mapped to width w
    // i=0 is left, i=length-1 is right

    for (let i = 0; i < tempHistory.length; i++) {
        let x = (i / (tempHistory.length - 1)) * w;
        let val = tempHistory[i];
        // Clamp
        if (val > maxT) val = maxT;
        if (val < minT) val = minT;
        let y = h - ((val - minT) / range) * h;
        gCtx.lineTo(x, y);
    }
    gCtx.lineTo(w, h); // Close shape
    gCtx.fill();

    // Draw Line
    gCtx.strokeStyle = '#ef4444'; // Red-500
    gCtx.lineWidth = 2;
    gCtx.beginPath();
    for (let i = 0; i < tempHistory.length; i++) {
        let x = (i / (tempHistory.length - 1)) * w;
        let val = tempHistory[i];
        if (val > maxT) val = maxT;
        if (val < minT) val = minT;
        let y = h - ((val - minT) / range) * h;
        if (i === 0) gCtx.moveTo(x, y);
        else gCtx.lineTo(x, y);
    }
    gCtx.stroke();

    // Draw Labels (Min, Max, Current)
    gCtx.fillStyle = '#94a3b8'; // Slate-400
    gCtx.font = '10px monospace';
    gCtx.fillText(`Max: ${maxT}°C`, 5, 12);
    gCtx.fillText(`Min: ${minT}°C`, 5, h - 5);

    // Current Temp Label on the line
    if (tempHistory.length > 0) {
        let current = tempHistory[tempHistory.length - 1];
        let cx = w; // Right edge
        let cy = h - ((current - minT) / range) * h;

        gCtx.fillStyle = '#fff';
        gCtx.fillText(`${current.toFixed(1)}°C`, cx - 40, cy - 5);

        // Dot at end
        gCtx.fillStyle = '#ef4444';
        gCtx.beginPath();
        gCtx.arc(cx, cy, 3, 0, Math.PI * 2);
        gCtx.fill();
    }
}

function exportData() {
    if (tempHistory.length === 0) {
        alert("No data to export!");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "TimeStep,Temperature(C)\n";

    tempHistory.forEach((temp, index) => {
        csvContent += `${index},${temp.toFixed(2)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "climate_change_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Logic & Draw Separation for Speed Control ---

function updateModel() {
    // 1. Spawn Rays
    // Logic: 10 * brightness > random 50 (approx 20% chance per frame at 1.0)
    if (Math.random() * 50 < 5 * params.sunBrightness) {
        rays.push(new Ray());
    }

    // 2. Update CO2
    co2s.forEach(c => c.move());

    // 3. Update Clouds
    clouds.forEach(c => c.move());

    // 4. Update Rays
    for (let i = rays.length - 1; i >= 0; i--) {
        rays[i].move();
        if (rays[i].dead) rays.splice(i, 1);
    }

    // 5. Update Heat
    for (let i = heats.length - 1; i >= 0; i--) {
        heats[i].move();
        if (heats[i].dead) heats.splice(i, 1);
    }

    // 6. Update IR
    for (let i = irs.length - 1; i >= 0; i--) {
        irs[i].move();
        if (irs[i].dead) irs.splice(i, 1);
    }

    // 7. Calculate Temperature
    // NetLogo: set temperature 0.99 * temperature + 0.01 * (12 + 0.1 * count heats)
    let targetTemp = 12 + (0.1 * heats.length);
    temperature = 0.99 * temperature + 0.01 * targetTemp;

    // 8. Graph History
    if (Math.random() < 0.1) {
        tempHistory.push(temperature);
        // Keep history growing for "full history" effect
    }
}

function drawModel() {
    drawBackground();

    co2s.forEach(c => c.draw());
    clouds.forEach(c => c.draw());
    rays.forEach(r => r.draw());
    heats.forEach(h => h.draw());
    irs.forEach(i => i.draw());

    // Draw Target Reticle if following
    if (trackedParticle) {
        // Animated Reticle
        const time = Date.now() / 200;
        const pulse = (Math.sin(time) + 1) * 3 + 20; // 20 to 26 radius

        ctx.strokeStyle = '#f97316'; // Orange
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]); // Dashed

        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f97316';

        ctx.beginPath();
        ctx.arc(trackedParticle.x, trackedParticle.y, pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
    }

    document.getElementById('current-temp').innerText = temperature.toFixed(1);
    updateGraph();
}

function loop() {
    // Run physics/logic multiple times per frame based on slider
    for (let i = 0; i < params.simSpeed; i++) {
        updateModel();
    }

    // Draw once per frame
    drawModel();

    requestAnimationFrame(loop);
}

// --- Event Listeners ---

document.getElementById('sun-brightness').addEventListener('input', (e) => {
    params.sunBrightness = parseFloat(e.target.value);
    document.getElementById('val-sun').innerText = params.sunBrightness;
});

document.getElementById('albedo').addEventListener('input', (e) => {
    params.albedo = parseFloat(e.target.value);
    document.getElementById('val-albedo').innerText = params.albedo;
});

document.getElementById('co2-amount').addEventListener('input', (e) => {
    params.co2Amount = parseInt(e.target.value);
    document.getElementById('val-co2').innerText = params.co2Amount;
    updateCO2Count();
});

document.getElementById('clouds-amount').addEventListener('input', (e) => {
    params.cloudClusters = parseInt(e.target.value);
    document.getElementById('val-clouds').innerText = params.cloudClusters;
    updateCloudCount();
});

document.getElementById('sim-speed').addEventListener('input', (e) => {
    params.simSpeed = parseInt(e.target.value);
    document.getElementById('val-speed').innerText = params.simSpeed + "x";
});

function resetSim() {
    // Reset values to default
    document.getElementById('sun-brightness').value = 1.0; params.sunBrightness = 1.0;
    document.getElementById('albedo').value = 0.6; params.albedo = 0.6;
    document.getElementById('co2-amount').value = 25; params.co2Amount = 25;
    document.getElementById('clouds-amount').value = 1; params.cloudClusters = 1;
    document.getElementById('sim-speed').value = 1; params.simSpeed = 1;

    // Update labels
    document.getElementById('val-sun').innerText = "1.0";
    document.getElementById('val-albedo').innerText = "0.6";
    document.getElementById('val-co2').innerText = "25";
    document.getElementById('val-clouds').innerText = "1";
    document.getElementById('val-speed').innerText = "1x";

    init();
}

// Handle Resizing Correctly
window.addEventListener('resize', () => {
    resize();
    updateCO2Count(); // Ensure elements stay in bounds if shrunk
    updateCloudCount();
});

// Initialize
resize();
init();
loop();
