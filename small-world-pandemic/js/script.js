(function () {
    // --- Definisi Tema ---
    const themes = {
        default: {
            name: "Default (Dark)",
            colors: {
                '--bg-dark': '#0f172a',
                '--panel-bg': '#1e293b',
                '--border': '#334155',
                '--text-main': '#f1f5f9',
                '--text-muted': '#94a3b8',
                '--accent': '#3b82f6',
            },
            js: {
                linkBase: 'rgba(100, 116, 139, 0.2)',
                linkRewired: 'rgba(59, 130, 246, 0.4)',
                nodeSusceptible: '#64748b',
                nodeInfected: '#ef4444',
                chartLine: '#ef4444',
                chartFill: 'rgba(239, 68, 68, 0.2)',
                chartGrid: '#334155'
            }
        },
        colorblind: {
            name: "Colorblind Safe",
            colors: {
                '--bg-dark': '#1a1a1a',
                '--panel-bg': '#2d2d2d',
                '--border': '#404040',
                '--text-main': '#ffffff',
                '--text-muted': '#b0b0b0',
                '--accent': '#56B4E9',
            },
            js: {
                linkBase: 'rgba(255, 255, 255, 0.15)',
                linkRewired: 'rgba(240, 228, 66, 0.6)',
                nodeSusceptible: '#56B4E9',
                nodeInfected: '#E69F00',
                chartLine: '#E69F00',
                chartFill: 'rgba(230, 159, 0, 0.2)',
                chartGrid: '#555555'
            }
        },
        light: {
            name: "Light Mode",
            colors: {
                '--bg-dark': '#f8fafc',
                '--panel-bg': '#ffffff',
                '--border': '#e2e8f0',
                '--text-main': '#0f172a',
                '--text-muted': '#64748b',
                '--accent': '#2563eb',
            },
            js: {
                linkBase: 'rgba(0, 0, 0, 0.1)',
                linkRewired: 'rgba(37, 99, 235, 0.4)',
                nodeSusceptible: '#94a3b8',
                nodeInfected: '#dc2626',
                chartLine: '#dc2626',
                chartFill: 'rgba(220, 38, 38, 0.1)',
                chartGrid: '#cbd5e1'
            }
        }
    };

    // --- Variabel Global ---
    let currentTheme = themes.default;
    let canvas, ctx, width, height;
    let animationFrameId;
    let isRunning = false;
    let day = 0;
    let lastUpdateTime = 0;
    const updateInterval = 100;

    // Sim State untuk dua world
    let simParams = {
        N: 100,
        K: 4,
        P: 0.05,
        InfectionRate: 0.2
    };

    let simState = {
        smallWorld: { nodes: [], links: [], infectedCount: 0 },
        normalWorld: { nodes: [], links: [], infectedCount: 0 }
    };

    let infectionChart;

    // --- Manajemen Tema ---
    function changeTheme(themeKey) {
        const theme = themes[themeKey];
        if (!theme) return;
        currentTheme = theme;

        const root = document.documentElement;
        for (const [key, value] of Object.entries(theme.colors)) {
            root.style.setProperty(key, value);
        }

        if (simState.smallWorld.nodes.length > 0) drawNetwork();

        initChart();
        if (infectionChart) {
            // Update dataset colors
            // Dataset 0: Small World (Red/Theme Color)
            infectionChart.data.datasets[0].borderColor = theme.js.chartLine;
            infectionChart.data.datasets[0].backgroundColor = theme.js.chartFill;

            // Dataset 1: Normal World (Gray/Neutral)
            infectionChart.data.datasets[1].borderColor = theme.colors['--text-muted'];
            infectionChart.data.datasets[1].backgroundColor = 'transparent';

            infectionChart.options.scales.x.ticks.color = theme.colors['--text-muted'];
            infectionChart.options.scales.y.ticks.color = theme.colors['--text-muted'];
            infectionChart.options.scales.y.grid.color = theme.js.chartGrid;
            infectionChart.update();
        }
    }
    window.changeTheme = changeTheme;

    // --- Chart.js ---
    function initChart() {
        const canvasEl = document.getElementById('chartCanvas');
        if (!canvasEl) return;
        const ctxChart = canvasEl.getContext('2d');

        // Preserve data if exists
        const oldLabels = infectionChart ? infectionChart.data.labels : [];
        const oldDataSW = infectionChart ? infectionChart.data.datasets[0].data : [];
        const oldDataNW = (infectionChart && infectionChart.data.datasets[1]) ? infectionChart.data.datasets[1].data : [];

        if (infectionChart) infectionChart.destroy();

        Chart.defaults.font.family = "'Segoe UI', sans-serif";

        infectionChart = new Chart(ctxChart, {
            type: 'line',
            data: {
                labels: oldLabels,
                datasets: [
                    {
                        label: 'Small World (Rewired)',
                        data: oldDataSW,
                        borderColor: currentTheme.js.chartLine,
                        backgroundColor: currentTheme.js.chartFill,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    },
                    {
                        label: 'Normal World (Regular)',
                        data: oldDataNW,
                        borderColor: currentTheme.colors['--text-muted'], // Gray-ish
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: currentTheme.colors['--text-muted'], font: { size: 10 } }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { maxTicksLimit: 10, color: currentTheme.colors['--text-muted'] }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: { color: currentTheme.js.chartGrid, borderDash: [5, 5] },
                        ticks: { color: currentTheme.colors['--text-muted'] },
                        title: { display: true, text: '% Populasi', color: currentTheme.colors['--text-muted'] }
                    }
                }
            }
        });
    }

    // --- Network Logic ---
    function buildGraph(N, K, P) {
        let nodes = [];
        let links = [];

        // Layout only matters for the visualized one (Small World), but we generate nodes for both logic
        const padding = 15;
        const radius = Math.min(width, height) / 2 - padding;
        const centerX = width / 2;
        const centerY = height / 2;

        for (let i = 0; i < N; i++) {
            const angle = (i / N) * 2 * Math.PI - (Math.PI / 2);
            nodes.push({
                id: i,
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
                angle: angle,
                status: 'susceptible',
                nextStatus: 'susceptible'
            });
        }

        // Create Regular Ring Lattice
        for (let i = 0; i < N; i++) {
            for (let j = 1; j <= K / 2; j++) {
                let target = (i + j) % N;
                links.push({ source: i, target: target, rewired: false });
            }
        }

        // Rewire
        for (let i = 0; i < links.length; i++) {
            if (Math.random() < P) {
                let link = links[i];
                let oldTarget = link.target;
                let newTarget = Math.floor(Math.random() * N);
                while (newTarget === link.source || newTarget === oldTarget) {
                    newTarget = Math.floor(Math.random() * N);
                }
                link.target = newTarget;
                link.rewired = true;
            }
        }

        // Infect Patient Zero
        if (nodes.length > 0) nodes[0].status = 'infected';

        return { nodes, links };
    }

    function createNetwork() {
        // Small World: User P
        const sw = buildGraph(simParams.N, simParams.K, simParams.P);
        simState.smallWorld.nodes = sw.nodes;
        simState.smallWorld.links = sw.links;
        simState.smallWorld.infectedCount = 1;

        // Normal World: P = 0
        const nw = buildGraph(simParams.N, simParams.K, 0); // P must be 0 explicitly
        simState.normalWorld.nodes = nw.nodes;
        simState.normalWorld.links = nw.links;
        simState.normalWorld.infectedCount = 1;

        drawNetwork();
        updateChartData();
    }

    function propagate(state) {
        let changeOccurred = false;
        // Optimization: create adjacency map or just iterate links? 
        // For N=200, iterating links is fast enough (approx 1000 links max).

        state.links.forEach(link => {
            let s = state.nodes[link.source];
            let t = state.nodes[link.target];

            if (s.status === 'infected' && t.status === 'susceptible') {
                if (Math.random() < simParams.InfectionRate) {
                    t.nextStatus = 'infected';
                    changeOccurred = true;
                }
            }
            if (t.status === 'infected' && s.status === 'susceptible') {
                if (Math.random() < simParams.InfectionRate) {
                    s.nextStatus = 'infected';
                    changeOccurred = true;
                }
            }
        });

        let totalInfected = 0;
        state.nodes.forEach(node => {
            node.status = node.nextStatus;
            if (node.status === 'infected') totalInfected++;
        });

        state.infectedCount = totalInfected;
        return changeOccurred;
    }

    function stepSimulation() {
        // Step both worlds
        propagate(simState.smallWorld);
        propagate(simState.normalWorld);

        day++;
        const dayEl = document.getElementById('dayDisplay');
        if (dayEl) dayEl.innerText = day;

        updateChartData();

        // Stop if both done? Or just if Small World done? 
        // Let's stop when Small World is done OR if both saturated.
        // Usually user cares about the main visualization (Small World).
        // Let's stop when BOTH are fully infected OR one is full and other stuck?
        // Simplest: Stop when Small World is 100% infected (as it's the main view).
        // BUT, Normal world might be slower. The user wants to see the comparison.
        // Better: Stop when both reach 100% or saturation.

        if (simState.smallWorld.infectedCount >= simParams.N && simState.normalWorld.infectedCount >= simParams.N) {
            stopSim();
            const btn = document.getElementById('btnStart');
            if (btn) { btn.innerText = "Selesai"; btn.disabled = true; }
        }
    }

    function updateChartData() {
        if (!infectionChart) return;

        let swPercent = simParams.N > 0 ? (simState.smallWorld.infectedCount / simParams.N) * 100 : 0;
        let nwPercent = simParams.N > 0 ? (simState.normalWorld.infectedCount / simParams.N) * 100 : 0;

        infectionChart.data.labels.push(day);
        infectionChart.data.datasets[0].data.push(swPercent);
        infectionChart.data.datasets[1].data.push(nwPercent);

        if (infectionChart.data.labels.length > 300) {
            infectionChart.data.labels.shift();
            infectionChart.data.datasets[0].data.shift();
            infectionChart.data.datasets[1].data.shift();
        }
        infectionChart.update();
    }

    function drawNetwork() {
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);

        // Visualize ONLY Small World
        const nodes = simState.smallWorld.nodes;
        const links = simState.smallWorld.links;

        ctx.lineWidth = 1;
        links.forEach(link => {
            const s = nodes[link.source];
            const t = nodes[link.target];
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(t.x, t.y);

            if (link.rewired) {
                ctx.strokeStyle = currentTheme.js.linkRewired;
                ctx.globalAlpha = 0.6;
            } else {
                ctx.strokeStyle = currentTheme.js.linkBase;
                ctx.globalAlpha = 1.0;
            }
            ctx.stroke();
        });
        ctx.globalAlpha = 1.0;

        nodes.forEach(node => {
            ctx.beginPath();
            const radius = node.status === 'infected' ? 6 : 4;
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);

            ctx.fillStyle = node.status === 'infected' ? currentTheme.js.nodeInfected : currentTheme.js.nodeSusceptible;
            ctx.fill();

            ctx.strokeStyle = currentTheme.colors['--bg-dark'];
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }

    function gameLoop(timestamp) {
        if (!isRunning) return;
        if (timestamp - lastUpdateTime > updateInterval) {
            stepSimulation();
            drawNetwork();
            lastUpdateTime = timestamp;
        }
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    window.toggleSim = function () {
        const btn = document.getElementById('btnStart');
        if (isRunning) {
            stopSim();
            btn.innerText = "Lanjutkan";
            btn.classList.remove('primary');
        } else {
            // Restart condition check
            if (day >= 1 && simState.smallWorld.infectedCount >= simParams.N && simState.normalWorld.infectedCount >= simParams.N) return;

            isRunning = true;
            btn.innerText = "Pause";
            btn.classList.add('primary');
            lastUpdateTime = performance.now();
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    };

    window.stopSim = function () {
        isRunning = false;
        cancelAnimationFrame(animationFrameId);
    };

    window.resetSim = function () {
        window.stopSim();
        day = 0;
        const dayEl = document.getElementById('dayDisplay');
        if (dayEl) dayEl.innerText = "0";

        const btn = document.getElementById('btnStart');
        if (btn) { btn.innerText = "Mulai"; btn.disabled = false; btn.classList.add('primary'); }

        simParams.N = parseInt(document.getElementById('paramN').value);
        simParams.K = parseInt(document.getElementById('paramK').value);
        simParams.P = parseFloat(document.getElementById('paramP').value);
        simParams.InfectionRate = parseInt(document.getElementById('paramInf').value) / 100;

        document.getElementById('valN').innerText = simParams.N;
        document.getElementById('valK').innerText = simParams.K;
        document.getElementById('valP').innerText = simParams.P;
        document.getElementById('valInf').innerText = (simParams.InfectionRate * 100);

        if (infectionChart) {
            infectionChart.data.labels = [];
            infectionChart.data.datasets[0].data = [];
            infectionChart.data.datasets[1].data = [];
            infectionChart.update();
        }

        createNetwork();
    };

    function resize() {
        const container = document.getElementById('networkContainer');
        if (!container || !canvas) return;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        width = canvas.width;
        height = canvas.height;
        if (simState.smallWorld.nodes.length > 0) window.resetSim(); else createNetwork();
    }

    function init() {
        canvas = document.getElementById('netCanvas');
        if (canvas) ctx = canvas.getContext('2d');
        initChart();
        resize();

        const bindSlider = (id, targetId) => {
            const el = document.getElementById(id);
            if (el) {
                el.oninput = function () { document.getElementById(targetId).innerText = this.value; };
                el.onchange = window.resetSim;
            }
        };
        bindSlider('paramN', 'valN');
        bindSlider('paramK', 'valK');
        bindSlider('paramP', 'valP');
        bindSlider('paramInf', 'valInf');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.addEventListener('resize', () => {
        clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(resize, 200);
    });
})();
