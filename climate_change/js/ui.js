// --- UI & Rendering ---

const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const graphCanvas = document.getElementById('graphCanvas');
// Expose to window for features.js access
window.graphCanvas = graphCanvas;
window.gCtx = graphCanvas.getContext('2d');
const gCtx = window.gCtx; // Local alias for this file

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

    // Define Zones based on height (update global logic vars)
    skyTop = height * 0.1;
    earthTop = height * 0.85;
}

function drawBackground() {
    // Space (Top 10%)
    ctx.fillStyle = '#020617'; // Slate-950
    ctx.fillRect(0, 0, width, skyTop);

    // Atmosphere (Gradient)
    let grd = ctx.createLinearGradient(0, skyTop, 0, earthTop);
    grd.addColorStop(0, '#0ea5e9'); // Sky-500
    grd.addColorStop(0.4, '#7dd3fc'); // Sky-300
    grd.addColorStop(1, '#e0f2fe'); // Sky-100
    ctx.fillStyle = grd;
    ctx.fillRect(0, skyTop, width, earthTop - skyTop);

    // Earth (Gradient Ground)
    let earthGrd = ctx.createLinearGradient(0, earthTop, 0, height);
    earthGrd.addColorStop(0, '#57534e'); // Stone-600
    earthGrd.addColorStop(1, '#292524'); // Stone-800
    ctx.fillStyle = earthGrd;
    ctx.fillRect(0, earthTop, width, height - earthTop);

    // Albedo Visualization
    // Interpolate color: 0.0 -> Dark Green/Brown, 1.0 -> White
    let r = 34 + (255 - 34) * params.albedo;
    let g = 139 + (255 - 139) * params.albedo;
    let b = 34 + (255 - 34) * params.albedo;

    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, earthTop, width, 8);

    // Border line
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(0, earthTop);
    ctx.lineTo(width, earthTop);
    ctx.stroke();
}

function drawModel() {
    drawBackground();

    // Draw Agents (Logic classes must have draw() methods defined in ui.js? 
    // NO, the Original code had draw inside classes. 
    // Refactoring plan says "Migrate Rendering/DOM to ui.js". 
    // Ideally, Logic classes shouldn't have draw(). 
    // But tearing that apart is complex. 
    // For now, I will add the draw functions to the prototypes here in UI.js OR 
    // accept that Logic classes *have* draw methods.
    // The previous logic.js extracted classes WITHOUT draw methods? 
    // Wait, let me check logic.js content I wrote.)

    // I Checked: I DID copy the classes into logic.js. 
    // Did I include draw()? 
    // I need to check my step 273. 
    // It seems I only included move(). 
    // Let me check artifacts.

    co2s.forEach(c => c.draw());
    clouds.forEach(c => c.draw());
    rays.forEach(r => r.draw());
    heats.forEach(h => h.draw());
    irs.forEach(i => i.draw());

    // Draw Tracking Reticle
    if (typeof trackedParticle !== 'undefined' && trackedParticle) {
        const time = Date.now() / 200;
        const pulse = (Math.sin(time) + 1) * 3 + 20;

        ctx.strokeStyle = '#f97316'; // Orange
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);

        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f97316';

        ctx.beginPath();
        ctx.arc(trackedParticle.x, trackedParticle.y, pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
    }

    // Update DOM
    document.getElementById('current-temp').innerText = temperature.toFixed(1);
    updateGraph();
}

// --- Attach Draw Methods to Classes (Separation of Concerns) ---
// Since we defined classes in logic.js without draw, we attach them here.

// Ray Draw
if (typeof Ray !== 'undefined') {
    Ray.prototype.draw = function () {
        const isTracked = (trackedParticle === this);
        ctx.strokeStyle = isTracked ? '#f97316' : '#facc15';
        ctx.lineWidth = isTracked ? 5 : 2;
        ctx.shadowBlur = isTracked ? 15 : 5;
        ctx.shadowColor = isTracked ? '#f97316' : '#facc15';

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - Math.cos(this.heading) * 12, this.y - Math.sin(this.heading) * 12);
        ctx.stroke();

        ctx.shadowBlur = 0;
    };
}

// Heat Draw
if (typeof Heat !== 'undefined') {
    Heat.prototype.draw = function () {
        const isTracked = (trackedParticle === this);
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
    };
}

// IR Draw
if (typeof IR !== 'undefined') {
    IR.prototype.draw = function () {
        const isTracked = (trackedParticle === this);
        ctx.strokeStyle = isTracked ? '#f97316' : '#d946ef';
        ctx.lineWidth = isTracked ? 5 : 2;
        if (isTracked) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#f97316';
        }

        ctx.beginPath();
        let lx = this.x;
        let ly = this.y;
        let len = 12;
        ctx.moveTo(lx, ly);
        let angle = this.heading;
        let cx = lx - Math.cos(angle) * len;
        let cy = ly - Math.sin(angle) * len;

        let midX = (lx + cx) / 2 + Math.sin(angle + Math.PI / 2) * 4;
        let midY = (ly + cy) / 2 - Math.cos(angle + Math.PI / 2) * 4;

        ctx.quadraticCurveTo(midX, midY, cx, cy);
        ctx.stroke();

        ctx.shadowBlur = 0;
    };
}

// CO2 Draw
if (typeof CO2 !== 'undefined') {
    CO2.prototype.draw = function () {
        let pulse = Math.sin((Date.now() / 200) + this.blinkOffset);
        let alpha = 0.4 + (pulse * 0.2);

        ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(this.x - 1, this.y - 1, 1, 0, Math.PI * 2);
        ctx.fill();
    };
}

// Cloud Draw
if (typeof Cloud !== 'undefined') {
    Cloud.prototype.draw = function () {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x + this.w * 0.2, this.y, 25, 0, Math.PI * 2);
        ctx.arc(this.x + this.w * 0.5, this.y - 10, 35, 0, Math.PI * 2);
        ctx.arc(this.x + this.w * 0.8, this.y, 25, 0, Math.PI * 2);
        ctx.fill();
    };
}

// Event Listeners
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

// Resizing
window.addEventListener('resize', () => {
    resize();
    updateCO2Count();
    updateCloudCount();
});
