/**
 * Membrane Transport Simulation
 * Handles Simple Diffusion, Facilitated Diffusion, Active Transport, and Bulk Transport.
 */

class SimulationEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.particles = [];
        this.proteins = []; // Array of protein objects
        this.mode = 'simple'; // simple, facilitated, active, bulk
        this.isRunning = true;
        this.atp = 0;
        this.animationId = null;

        // Configuration
        this.config = {
            moleculeCount: 50,
            temp: 25,
            membraneThickness: 40,
            membraneY: 0
        };

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.config.membraneY = this.height / 2;
        this.init();
    }

    init() {
        this.particles = [];
        this.proteins = [];

        if (this.mode === 'simple') {
            this.initSimpleDiffusion();
        } else if (this.mode === 'facilitated') {
            this.initFacilitatedDiffusion();
        } else if (this.mode === 'active') {
            this.initActiveTransport();
        } else if (this.mode === 'bulk') {
            this.initBulkTransport();
        }
    }

    initSimpleDiffusion() {
        // High concentration outside (top), low inside (bottom) initially
        for (let i = 0; i < this.config.moleculeCount; i++) {
            this.addParticle('oxygen', 'top'); // Oxygen is blue, small, permeable
        }
    }

    initFacilitatedDiffusion() {
        // Add Channel Proteins
        const channelCount = 3;
        const spacing = this.width / (channelCount + 1);
        for (let i = 1; i <= channelCount; i++) {
            this.proteins.push({
                x: spacing * i,
                type: 'channel', // Passive
                width: 40,
                isOpen: true
            });
        }

        // Add Glucose (needs channel)
        for (let i = 0; i < 30; i++) {
            this.addParticle('glucose', 'top'); // Glucose is yellow, large
        }
    }

    initActiveTransport() {
        this.atp = 0;
        this.updateATPDisplay();

        // Add Sodium-Potassium Pump
        this.proteins.push({
            x: this.width / 2,
            type: 'pump', // Active
            width: 50,
            state: 'waiting' // waiting, pumping
        });

        // Add Na+ (Green) and K+ (Purple)
        // Usually Na+ is high outside (top), K+ high inside (bottom)
        // Active transport moves them AGAINST gradient using ATP.
        // Let's visualize pumping Na+ OUT (to top) and K+ IN (to bottom)

        // Setup initial low concentration on target sides to show pumping against gradient?
        // Actually, let's start with equilibrium or mixed to show sorting.
        for (let i = 0; i < 15; i++) this.addParticle('sodium', 'bottom'); // Start Na inside
        for (let i = 0; i < 10; i++) this.addParticle('potassium', 'top'); // Start K outside
    }

    initBulkTransport() {
        // Clear particles
        this.particles = [];
        this.proteins = [];

        // Visual indicator
        this.ctx.font = "20px Outfit";
        this.ctx.fillStyle = "white";
        this.ctx.fillText("Select Endocytosis or Exocytosis", this.width / 2 - 100, 50);
    }

    triggerBulk(type) {
        if (this.mode !== 'bulk') return;

        if (type === 'exocytosis') {
            // Create a vesicle inside (bottom) moving up
            const vesicle = {
                x: this.width / 2,
                y: this.height - 100,
                radius: 30,
                vy: -2,
                type: 'vesicle',
                contents: []
            };
            // Add particles inside vesicle
            for (let i = 0; i < 5; i++) {
                vesicle.contents.push({
                    x: vesicle.x + (Math.random() - 0.5) * 20,
                    y: vesicle.y + (Math.random() - 0.5) * 20,
                    color: '#f72585',
                    radius: 4
                });
            }
            this.particles.push(vesicle);

        } else if (type === 'endocytosis') {
            // Create particle cluster outside (top)
            const clusterX = this.width / 2 + (Math.random() - 0.5) * 100;
            const clusterY = 50;

            // We represent the "proto-vesicle" as a particle just to reuse update logic, 
            // but we'll draw it differently
            const vesicle = {
                x: clusterX,
                y: clusterY,
                radius: 30,
                vy: 2,
                type: 'proto-vesicle', // forming vesicle
                contents: []
            };
            for (let i = 0; i < 5; i++) {
                vesicle.contents.push({
                    x: vesicle.x + (Math.random() - 0.5) * 20,
                    y: vesicle.y + (Math.random() - 0.5) * 20,
                    color: '#4cc9f0',
                    radius: 4
                });
            }
            this.particles.push(vesicle);
        }
    }

    addParticle(type, startSide) {
        let r, color;
        // Properties
        if (type === 'oxygen') { r = 4; color = '#4cc9f0'; }
        else if (type === 'glucose') { r = 8; color = '#ffbd2e'; } // Square-ish usually, but circle for now
        else if (type === 'sodium') { r = 5; color = '#70e000'; } // Na+
        else if (type === 'potassium') { r = 5; color = '#7209b7'; } // K+
        else if (type === 'nutrient') { r = 12; color = '#f72585'; }

        let y;
        if (startSide === 'top') {
            y = Math.random() * (this.config.membraneY - this.config.membraneThickness / 2 - 20);
        } else {
            y = Math.random() * (this.height - (this.config.membraneY + this.config.membraneThickness / 2 + 20)) + (this.config.membraneY + this.config.membraneThickness / 2 + 20);
        }

        this.particles.push({
            x: Math.random() * this.width,
            y: y,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            radius: r,
            color: color,
            type: type
        });
    }

    update() {
        if (!this.isRunning) return;
        const speedMulti = (this.config.temp + 100) / 125;

        // Filter out particles that were destroyed (fused)
        this.particles = this.particles.filter(p => !p.destroyed);

        this.particles.forEach(p => {
            if (p.type === 'vesicle' || p.type === 'proto-vesicle') {
                // Bulk movement
                p.y += p.vy * speedMulti;
                // Move contents
                p.contents.forEach(c => c.y += p.vy * speedMulti);

                // Detection
                const memY = this.config.membraneY;

                // Exocytosis Fusion
                if (p.type === 'vesicle' && p.y - p.radius < memY + 10) {
                    // Fuse!
                    p.destroyed = true;
                    // Release particles
                    p.contents.forEach(c => {
                        this.particles.push({
                            x: c.x, y: c.y, vx: (Math.random() - 0.5) * 4, vy: -Math.abs((Math.random()) * 4),
                            radius: c.radius, color: c.color, type: 'nutrient'
                        });
                    });
                }

                // Endocytosis Pinching
                if (p.type === 'proto-vesicle' && p.y + p.radius > memY - 10) {
                    // Pass membrane and become vesicle
                    p.type = 'vesicle'; // now inside
                    // Visual change handled in draw
                }

            } else {
                // Normal Particle
                p.x += p.vx * speedMulti;
                p.y += p.vy * speedMulti;

                // Wall collisions
                if (p.x < p.radius || p.x > this.width - p.radius) p.vx *= -1;
                if (p.y < p.radius || p.y > this.height - p.radius) p.vy *= -1;

                // Membrane Interaction
                this.handleMembraneCollision(p);
            }
        });

        // Pump Logic updates
        if (this.mode === 'active') {
            this.handlePumpLogic();
        }
    }

    handleMembraneCollision(p) {
        const memTop = this.config.membraneY - this.config.membraneThickness / 2;
        const memBottom = this.config.membraneY + this.config.membraneThickness / 2;

        // Check if within membrane vertical zone
        if (p.y + p.radius > memTop && p.y - p.radius < memBottom) {

            // 1. Proteins Check (Channels/Pumps)
            let passedThroughProtein = false;

            for (let protein of this.proteins) {
                // Check horizontal overlap with protein
                if (Math.abs(p.x - protein.x) < protein.width / 2) {
                    if (protein.type === 'channel') {
                        // Specificity: Gluecose Channel lets Glucose pass
                        if (this.mode === 'facilitated' && p.type === 'glucose') {
                            passedThroughProtein = true;
                        }
                    } else if (protein.type === 'pump') {
                        // Pump handles its own logic in update, usually blocks passive flow
                    }
                }
            }

            // 2. Simple Diffusion Permeability
            if (this.mode === 'simple' && p.type === 'oxygen') {
                passedThroughProtein = true; // Permeable
            }


            // 3. Bounce if not allowed
            if (!passedThroughProtein) {
                // Determine which side is closer to bounce correctly
                const distToTop = Math.abs(p.y - memTop);
                const distToBottom = Math.abs(p.y - memBottom);

                if (distToTop < distToBottom) {
                    p.y = memTop - p.radius; // Push out to top
                    p.vy = -Math.abs(p.vy); // Ensure moving up
                } else {
                    p.y = memBottom + p.radius; // Push out to bottom
                    p.vy = Math.abs(p.vy); // Ensure moving down
                }
            }
        }
    }

    handlePumpLogic() {
        // Find a pump
        const pump = this.proteins.find(pr => pr.type === 'pump');
        if (!pump) return;

        // Simple Visual Logic:
        // If ATP > 0, grab particles near the pump and move them across
        if (this.atp > 0) {
            // Pump Na+ OUT (Bottom -> Top)
            const sodiumToPump = this.particles.find(p => p.type === 'sodium' && p.y > this.config.membraneY && Math.abs(p.x - pump.x) < 30);
            if (sodiumToPump) {
                // Animate transport
                sodiumToPump.y -= 5; // Move up fast
                if (sodiumToPump.y < this.config.membraneY - 50) {
                    this.useATP(); // Consumed once moved
                    // Push it away
                    sodiumToPump.vy = -2;
                }
            }

            // Or Pump K+ IN (Top -> Bottom) ... simple logic handled by above or separate
        }
    }

    useATP() {
        if (this.atp > 0) {
            this.atp--;
            this.updateATPDisplay();
        }
    }

    addATP() {
        this.atp += 5;
        this.updateATPDisplay();
    }

    updateATPDisplay() {
        const el = document.getElementById('atp-count');
        if (el) el.innerText = `ATP: ${this.atp}`;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw Membrane Background (Lipid Bilayer)
        const memY = this.config.membraneY;
        const thickness = this.config.membraneThickness;

        // Lipids - Top Layer
        this.ctx.fillStyle = '#ff9f1c'; // Head color
        const headSize = 8;
        const lipidCount = Math.ceil(this.width / (headSize * 1.5));

        for (let i = 0; i < lipidCount; i++) {
            let x = i * headSize * 1.5;
            // Don't draw if protein is there
            let blocked = false;
            for (let p of this.proteins) {
                if (Math.abs(x - p.x) < p.width / 2) blocked = true;
            }
            if (!blocked) {
                // Top Lipid
                this.ctx.beginPath();
                this.ctx.arc(x, memY - thickness / 2, headSize / 2, 0, Math.PI * 2);
                this.ctx.fill();
                // Tails
                this.ctx.beginPath();
                this.ctx.strokeStyle = '#fad2e1';
                this.ctx.moveTo(x, memY - thickness / 2);
                this.ctx.lineTo(x, memY);
                this.ctx.stroke();

                // Bottom Lipid
                this.ctx.beginPath();
                this.ctx.arc(x, memY + thickness / 2, headSize / 2, 0, Math.PI * 2);
                this.ctx.fill();
                // Tails
                this.ctx.beginPath();
                this.ctx.moveTo(x, memY + thickness / 2);
                this.ctx.lineTo(x, memY);
                this.ctx.stroke();
            }
        }


        // Draw Proteins
        this.proteins.forEach(prot => {
            this.ctx.fillStyle = prot.type === 'pump' ? '#9b5de5' : '#00bbf9';
            // Round rect for protein
            this.ctx.beginPath();
            const h = thickness + 20;
            this.ctx.roundRect(prot.x - prot.width / 2, memY - h / 2, prot.width, h, 10);
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Inner channel visuals
            this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
            this.ctx.beginPath();
            this.ctx.roundRect(prot.x - 10, memY - h / 2 + 5, 20, h - 10, 5);
            this.ctx.fill();

            // Label
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(prot.type === 'pump' ? 'ATP Pump' : 'Channel', prot.x, memY);
        });

        // Draw Particles
        this.particles.forEach(p => {
            if (p.type === 'vesicle' || p.type === 'proto-vesicle') {
                // Draw Vesicle Membrane
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                this.ctx.strokeStyle = '#ff9f1c'; // Like lipid head
                this.ctx.lineWidth = 4;
                this.ctx.stroke();
                // Contents
                p.contents.forEach(c => {
                    this.ctx.beginPath();
                    this.ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
                    this.ctx.fillStyle = c.color;
                    this.ctx.fill();
                });
            } else {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                this.ctx.fillStyle = p.color;
                this.ctx.fill();
            }
        });
    }

    loop() {
        this.update();
        this.draw();
        this.animationId = requestAnimationFrame(() => this.loop());
    }

    setMode(mode) {
        this.mode = mode;
        this.init();
    }

}

// Global specific logic
const engine = new SimulationEngine('simCanvas');
engine.loop();

// Tab Handling
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // UI Switch
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        // Show/Hide Controls
        const mode = e.target.dataset.tab;
        document.querySelectorAll('.control-group').forEach(g => g.classList.add('hidden'));
        const activeControl = document.getElementById(`controls-${mode}`);
        if (activeControl) activeControl.classList.remove('hidden');

        // Engine Switch
        engine.setMode(mode);
    });
});

// Controls - Simple
document.getElementById('simple-concentration').addEventListener('input', (e) => {
    document.getElementById('val-simple-concentration').innerText = e.target.value;
    engine.config.moleculeCount = parseInt(e.target.value);
    engine.init(); // Restart with new count
});

// Controls - Active
document.getElementById('add-atp').addEventListener('click', () => {
    engine.addATP();
});

document.getElementById('simple-temp').addEventListener('input', (e) => {
    document.getElementById('val-simple-temp').innerText = `${e.target.value}°C`;
    engine.config.temp = parseInt(e.target.value);
});

// Controls - Bulk
document.getElementById('trigger-endo').addEventListener('click', () => {
    engine.triggerBulk('endocytosis');
});
document.getElementById('trigger-exo').addEventListener('click', () => {
    engine.triggerBulk('exocytosis');
});
