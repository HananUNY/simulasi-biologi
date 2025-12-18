// --- Global Variables & State ---
let width, height;
let skyTop, earthTop;
let temperature = 12;

// Agents Lists
let rays = [];
let heats = [];
let irs = [];
let co2s = [];
let clouds = [];

// Parameters from UI
const params = {
    sunBrightness: 1.0,
    albedo: 0.6,
    co2Amount: 25,
    cloudClusters: 1,
    simSpeed: 1
};

// --- Classes / Agents ---

class Ray {
    constructor() {
        this.x = Math.random() * width;
        this.y = 0; // Start at top
        this.speed = 3;
        this.heading = Math.PI / 2 + (Math.random() * 0.2 - 0.1); // Downwards roughly
        this.dead = false;

        // Auto-track if waiting
        if (typeof isFollowing !== 'undefined' && isFollowing && !trackedParticle) {
            trackedParticle = this;
            trackedState = "Incoming Sunlight";
            if (typeof updateTrackingUI === 'function') updateTrackingUI();
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
                    if (typeof updateTrackingUI === 'function') updateTrackingUI();
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
                    if (typeof updateTrackingUI === 'function') updateTrackingUI();
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
                    if (typeof updateTrackingUI === 'function') updateTrackingUI();
                }
            }
        }

        // Out of bounds (Side or Top)
        if (this.x < 0 || this.x > width || this.y < -10) {
            this.dead = true;
            if (trackedParticle === this) {
                trackedParticle = null;
                trackedState = "Reflected to Space";
                if (typeof isFollowing !== 'undefined') isFollowing = false; // Stop
                if (typeof updateTrackingUI === 'function') updateTrackingUI();
            }
        }
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
                    if (typeof updateTrackingUI === 'function') updateTrackingUI();
                }
            } else {
                this.y = earthTop + 1; // Bounce back down
            }
        }
        if (this.y > height) this.y = height;
        if (this.x < 0) this.x = 0;
        if (this.x > width) this.x = width;
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
                if (typeof updateTrackingUI === 'function') updateTrackingUI();
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
                    if (typeof updateTrackingUI === 'function') updateTrackingUI();
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
                if (typeof isFollowing !== 'undefined') isFollowing = false;
                if (typeof updateTrackingUI === 'function') updateTrackingUI();
            }
        }
        if (this.x < 0 || this.x > width) this.dead = true;
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
}

// --- Population Management ---

function updateCO2Count() {
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

// --- Simulation Step ---

function updateModel() {
    // 1. Spawn Rays
    if (Math.random() * 50 < 5 * params.sunBrightness) {
        rays.push(new Ray());
    }

    // 2. Update Agents
    co2s.forEach(c => c.move());
    clouds.forEach(c => c.move());

    for (let i = rays.length - 1; i >= 0; i--) {
        rays[i].move();
        if (rays[i].dead) rays.splice(i, 1);
    }

    for (let i = heats.length - 1; i >= 0; i--) {
        heats[i].move();
        if (heats[i].dead) heats.splice(i, 1);
    }

    for (let i = irs.length - 1; i >= 0; i--) {
        irs[i].move();
        if (irs[i].dead) irs.splice(i, 1);
    }

    // 3. Calculate Temperature
    let targetTemp = 12 + (0.1 * heats.length);
    temperature = 0.99 * temperature + 0.01 * targetTemp;

    // 4. Graph History Push
    if (Math.random() < 0.1 && typeof tempHistory !== 'undefined') {
        tempHistory.push(temperature);
    }
}
