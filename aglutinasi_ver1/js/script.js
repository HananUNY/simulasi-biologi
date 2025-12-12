const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const statusLabel = document.getElementById('statusLabel');
const logBox = document.getElementById('logBox');
const plasmaToggle = document.getElementById('plasmaToggle');

let width, height;
let cells = [];
let antibodies = [];

// Configuration
const CELL_RADIUS = 15;
const ANTIBODY_SIZE = 12;
const SPRING_STRENGTH = 0.08;
const REPULSION_STRENGTH = 0.6;

function resize() {
    // Mengambil ukuran dari parent container agar responsif terhadap flexbox
    const container = canvas.parentElement;
    width = container.clientWidth;
    height = container.clientHeight;

    // Set canvas size secara eksplisit agar tidak blur di retina display
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    // Normalize coordinate system
    ctx.scale(dpr, dpr);

    // Adjust width/height logic variables to match css pixels
    // (Variabel global width/height tetap menggunakan CSS pixels untuk logika fisika)
}

window.addEventListener('resize', () => {
    resize();
    // Reset boundaries check slightly to push particles inside if screen shrank
    cells.forEach(c => {
        if (c.x > width) c.x = width - 10;
        if (c.y > height) c.y = height - 10;
    });
});

// Panggil resize di awal
setTimeout(resize, 100); // Delay sedikit untuk memastikan layout flexbox sudah render

// --- LOG BOX UTILS ---
function log(msg, type = "neutral") {
    const div = document.createElement('div');
    div.textContent = `> ${msg}`;
    div.className = "mb-1 border-b border-slate-800 pb-1 shrink-0 leading-tight";
    if (type === "danger") div.className += " text-red-400 font-bold";
    if (type === "success") div.className += " text-green-400";
    if (type === "info") div.className += " text-blue-300";
    if (type === "warning") div.className += " text-yellow-300";

    if (logBox.children.length > 20) {
        logBox.removeChild(logBox.lastChild);
    }
    logBox.prepend(div);
}

function updateToggleLabel() {
    if (plasmaToggle.checked) {
        log("Mode: Darah Utuh (Sel + Plasma)", "info");
    } else {
        log("Mode: Packed Cells (Sel Saja)", "info");
    }
}

// --- CLASSES ---

class RedBloodCell {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        // KECEPATAN AWAL
        this.vx = (Math.random() - 0.5) * 1.5;
        this.vy = (Math.random() - 0.5) * 1.5;
        this.type = type;
        this.radius = CELL_RADIUS;
        this.id = Math.random().toString(36).substr(2, 9);
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Body
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = (this.type === 'AB') ? '#8e24aa' : '#d32f2f';
        ctx.fill();

        // 3D visual
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.stroke();

        // Dimple
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fill();

        // Antigens
        if (this.type === 'A' || this.type === 'AB') {
            ctx.fillStyle = '#fdd835';
            for (let i = 0; i < 6; i++) {
                ctx.save();
                ctx.rotate((Math.PI / 3) * i);
                ctx.beginPath();
                ctx.moveTo(this.radius - 2, -4);
                ctx.lineTo(this.radius + 6, 0);
                ctx.lineTo(this.radius - 2, 4);
                ctx.fill();
                ctx.restore();
            }
        }

        if (this.type === 'B' || this.type === 'AB') {
            ctx.fillStyle = '#42a5f5';
            const offset = (this.type === 'AB') ? Math.PI / 6 : 0;
            for (let i = 0; i < 6; i++) {
                ctx.save();
                ctx.rotate((Math.PI / 3) * i + offset);
                ctx.beginPath();
                ctx.arc(this.radius + 3, 0, 3.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.type, 0, 0);

        ctx.restore();
    }

    update() {
        // Boundary check using global width/height
        if (this.x < this.radius) { this.x = this.radius; this.vx *= -1; }
        if (this.x > width - this.radius) { this.x = width - this.radius; this.vx *= -1; }
        if (this.y < this.radius) { this.y = this.radius; this.vy *= -1; }
        if (this.y > height - this.radius) { this.y = height - this.radius; this.vy *= -1; }

        this.x += this.vx;
        this.y += this.vy;

        this.vx *= 0.98;
        this.vy *= 0.98;

        // Brownian Motion
        this.vx += (Math.random() - 0.5) * 0.15;
        this.vy += (Math.random() - 0.5) * 0.15;
    }
}

class Antibody {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.vx = (Math.random() - 0.5) * 2.0;
        this.vy = (Math.random() - 0.5) * 2.0;
        this.angle = Math.random() * Math.PI * 2;

        this.cell1 = null;
        this.cell2 = null;
        this.angleOnCell1 = 0;
    }

    draw() {
        ctx.save();

        if (this.cell1 && !this.cell2) {
            this.x = this.cell1.x + Math.cos(this.angleOnCell1) * (this.cell1.radius + 5);
            this.y = this.cell1.y + Math.sin(this.angleOnCell1) * (this.cell1.radius + 5);
            this.angle = this.angleOnCell1 + Math.PI / 2;
        } else if (this.cell1 && this.cell2) {
            this.x = (this.cell1.x + this.cell2.x) / 2;
            this.y = (this.cell1.y + this.cell2.y) / 2;
            const dx = this.cell2.x - this.cell1.x;
            const dy = this.cell2.y - this.cell1.y;
            this.angle = Math.atan2(dy, dx) + Math.PI / 2;
        }

        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        const color = (this.type === 'Anti-A') ? '#fbc02d' : '#1e88e5';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.lineTo(0, -2);
        ctx.lineTo(-5, -8);
        ctx.moveTo(0, -2);
        ctx.lineTo(5, -8);
        ctx.stroke();

        if (this.type === 'Anti-A') {
            ctx.fillRect(-6, -9, 2, 2); ctx.fillRect(4, -9, 2, 2);
        } else {
            ctx.beginPath(); ctx.arc(-5, -8, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(5, -8, 1.5, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    }

    update() {
        if (!this.cell1 && !this.cell2) {
            this.x += this.vx;
            this.y += this.vy;
            this.angle += 0.02;

            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;

            this.vx *= 0.98;
            this.vy *= 0.98;

            // Brownian Motion
            this.vx += (Math.random() - 0.5) * 0.2;
            this.vy += (Math.random() - 0.5) * 0.2;
        }
    }
}

// --- LOGIC UTAMA ---

function addBloodSample(type) {
    const includePlasma = plasmaToggle.checked;
    const centerX = width / 2 + (Math.random() - 0.5) * (width * 0.4); // Adaptive spawn range
    const centerY = height / 2 + (Math.random() - 0.5) * (height * 0.4);

    for (let i = 0; i < 6; i++) {
        cells.push(new RedBloodCell(
            centerX + (Math.random() - 0.5) * 60,
            centerY + (Math.random() - 0.5) * 60,
            type
        ));
    }

    let msg = `+ SDM ${type}`;

    if (includePlasma) {
        let antibodiesToAdd = [];
        if (type === 'A') antibodiesToAdd.push('Anti-B');
        if (type === 'B') antibodiesToAdd.push('Anti-A');
        if (type === 'O') { antibodiesToAdd.push('Anti-A'); antibodiesToAdd.push('Anti-B'); }

        let count = 0;
        antibodiesToAdd.forEach(abType => {
            for (let i = 0; i < 6; i++) {
                antibodies.push(new Antibody(
                    centerX + (Math.random() - 0.5) * 100,
                    centerY + (Math.random() - 0.5) * 100,
                    abType
                ));
            }
            count++;
        });

        if (count > 0) {
            msg += ` & Plasma`;
            log(msg, "warning");
        } else {
            msg += ` (Plasma AB Bersih)`;
            log(msg, "neutral");
        }
    } else {
        msg += ` (Sel Saja)`;
        log(msg, "success");
    }
}

function addReagent(type) {
    for (let i = 0; i < 15; i++) {
        antibodies.push(new Antibody(
            Math.random() * width,
            Math.random() * height,
            type
        ));
    }
    log(`+ Reagen: ${type}`, "info");
}

function resetSimulation() {
    cells = [];
    antibodies = [];
    statusLabel.style.opacity = '0';
    log("=== BERSIH ===", "neutral");
}

// --- PHYSICS ---

function checkCompatibility(antibody, cell) {
    if (antibody.type === 'Anti-A') return (cell.type === 'A' || cell.type === 'AB');
    if (antibody.type === 'Anti-B') return (cell.type === 'B' || cell.type === 'AB');
    return false;
}

function resolvePhysics() {
    let reactionCount = 0;

    for (let ab of antibodies) {
        if (ab.cell1 && ab.cell2) {
            reactionCount++;
            continue;
        }

        for (let cell of cells) {
            if (ab.cell1 === cell) continue;
            if (!checkCompatibility(ab, cell)) continue;

            let dist;
            if (!ab.cell1) {
                const dx = ab.x - cell.x;
                const dy = ab.y - cell.y;
                dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < cell.radius + ANTIBODY_SIZE) {
                    ab.cell1 = cell;
                    ab.angleOnCell1 = Math.atan2(ab.y - cell.y, ab.x - cell.x);
                }
            } else {
                const abX = ab.cell1.x + Math.cos(ab.angleOnCell1) * (ab.cell1.radius + 5);
                const abY = ab.cell1.y + Math.sin(ab.angleOnCell1) * (ab.cell1.radius + 5);
                const dx = abX - cell.x;
                const dy = abY - cell.y;
                dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < cell.radius + 8) {
                    ab.cell2 = cell;
                }
            }
        }
    }

    for (let ab of antibodies) {
        if (ab.cell1 && ab.cell2) {
            const c1 = ab.cell1;
            const c2 = ab.cell2;
            const dx = c2.x - c1.x;
            const dy = c2.y - c1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const target = c1.radius + c2.radius + 10;

            if (dist > 0) {
                const force = (dist - target) * SPRING_STRENGTH;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                c1.vx += fx; c1.vy += fy;
                c2.vx -= fx; c2.vy -= fy;
            }
        }
    }

    for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
            const c1 = cells[i];
            const c2 = cells[j];
            const dx = c2.x - c1.x;
            const dy = c2.y - c1.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = c1.radius + c2.radius;

            if (dist < minDist && dist > 0) {
                const overlap = minDist - dist;
                const force = overlap * REPULSION_STRENGTH;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                c1.vx -= fx; c1.vy -= fy;
                c2.vx += fx; c2.vy += fy;
            }
        }
    }

    if (reactionCount > 2) {
        statusLabel.style.opacity = '1';
    } else {
        statusLabel.style.opacity = '0';
    }
}

function animate() {
    ctx.clearRect(0, 0, width, height);
    resolvePhysics();

    antibodies.forEach(ab => {
        if (ab.cell1 && ab.cell2) {
            const midX = (ab.cell1.x + ab.cell2.x) / 2;
            const midY = (ab.cell1.y + ab.cell2.y) / 2;

            const gradient = ctx.createRadialGradient(midX, midY, 0, midX, midY, 45);
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
            gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(midX, midY, 45, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(253, 224, 71, 0.8)';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(ab.cell1.x, ab.cell1.y);
            ctx.lineTo(ab.cell2.x, ab.cell2.y);
            ctx.stroke();
        }
    });

    cells.forEach(c => { c.update(); c.draw(); });
    antibodies.forEach(a => { a.update(); a.draw(); });

    requestAnimationFrame(animate);
}

animate();
