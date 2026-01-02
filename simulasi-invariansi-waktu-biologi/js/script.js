(function () {
    // --- 1. SAFE INIT & DOM ELEMENTS ---
    const els = {
        slider: document.getElementById('vSlider'),
        vDisplay: document.getElementById('vDisplay'),
        gammaDisplay: document.getElementById('gammaDisplay'),
        spacecraftVLabel: document.getElementById('spacecraftVLabel'),
        startBtn: document.getElementById('startBtn'),
        resetBtn: document.getElementById('resetBtn'),
        statusMessage: document.getElementById('statusMessage'),
        targetTimeInput: document.getElementById('targetTimeInput'),
        doublingTimeInput: document.getElementById('doublingTimeInput'),
        // New SVG Hands
        earthClockHand: document.getElementById('earthClockHand'),
        spaceClockHand: document.getElementById('spaceClockHand'),
        earthTimeText: document.getElementById('earthTimeText'),
        spaceTimeText: document.getElementById('spaceTimeText'),
        earthGText: document.getElementById('earthG'),
        spaceGText: document.getElementById('spaceG'),
        earthCountText: document.getElementById('earthCount'),
        spaceCountText: document.getElementById('spaceCount'),
        earthContainer: document.getElementById('earthBacteriaContainer'),
        spaceContainer: document.getElementById('spaceBacteriaContainer'),
        resultEarthG: document.getElementById('resultEarthG'),
        resultSpaceG: document.getElementById('resultSpaceG'),
        infoModal: document.getElementById('infoModal'),
        infoBtn: document.getElementById('infoBtn'),
        closeInfoBtn: document.getElementById('closeInfoBtn'),
        dilationIndicator: document.getElementById('dilationIndicator'),
        // Displays
        earthTargetDisplay: document.getElementById('earthTargetDisplay'),
        spaceTargetDisplay: document.getElementById('spaceTargetDisplay'),
        // Chart
        // Chart
        earthChartCanvas: document.getElementById('earthChartCanvas'),
        spaceChartCanvas: document.getElementById('spaceChartCanvas')
    };

    // --- 2. VARIABLES & CONSTANTS ---
    let isRunning = false;
    let animationFrame;
    let v = 0;
    let gamma = 1;
    let coordinateTime = 0; // NEW: Universal Coordinate Time for X-axis
    let earthProperTime = 0;
    let spaceProperTime = 0;
    let chartInstance = null; // Deprecated
    let earthChartInstance = null;
    let spaceChartInstance = null;

    // --- 3. HELPER FUNCTIONS ---
    function calculateGamma(velocity) {
        if (velocity >= 1) return 1000; // Limit to avoid Infinity issues
        return 1 / Math.sqrt(1 - (velocity * velocity));
    }

    function safeUpdateIcons() {
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            try { lucide.createIcons(); } catch (e) { console.log('Icons update skipped'); }
        }
    }

    function initCharts(maxTime) {
        // Destroy existing
        if (earthChartInstance) earthChartInstance.destroy();
        if (spaceChartInstance) spaceChartInstance.destroy();

        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    type: 'linear',
                    display: false, // Hide X axis for cleaner in-box look
                    max: maxTime
                },
                y: {
                    type: 'logarithmic',
                    display: true,
                    title: { display: false },
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8', font: { size: 10 } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false } // Disable tooltips for performance/simplicity
            },
            elements: {
                point: { radius: 0 }
            }
        };

        // Earth Chart
        const ctxE = els.earthChartCanvas.getContext('2d');
        earthChartInstance = new Chart(ctxE, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Populasi',
                    borderColor: '#4ade80',
                    backgroundColor: 'rgba(74, 222, 128, 0.1)',
                    data: [],
                    tension: 0.2,
                    borderWidth: 2,
                    fill: true
                }]
            },
            options: commonOptions
        });

        // Space Chart
        const ctxS = els.spaceChartCanvas.getContext('2d');
        spaceChartInstance = new Chart(ctxS, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Populasi',
                    borderColor: '#60a5fa',
                    backgroundColor: 'rgba(96, 165, 250, 0.1)',
                    data: [],
                    tension: 0.2,
                    borderWidth: 2,
                    fill: true
                }]
            },
            options: commonOptions
        });
    }

    function createBacterium(type) {
        const div = document.createElement('div');
        div.className = `bacterium ${type === 'space' ? 'space' : ''}`;
        return div;
    }

    function updateBacteriaDisplay(container, count, type) {
        const MAX_VISUAL_DOTS = 64; // Capped for performance
        const currentVisuals = container.children.length;

        // Handling Limit Indicator
        const hasIndicator = container.lastElementChild && container.lastElementChild.classList.contains('limit-indicator');
        const visualCount = hasIndicator ? currentVisuals - 1 : currentVisuals;

        if (count > MAX_VISUAL_DOTS) {
            // Ensure full capacity first
            if (visualCount < MAX_VISUAL_DOTS) {
                for (let i = visualCount; i < MAX_VISUAL_DOTS; i++) {
                    container.appendChild(createBacterium(type));
                }
            }
            // Add indicator if not present
            if (!hasIndicator) {
                const indicator = document.createElement('div');
                indicator.className = 'limit-indicator text-xs text-slate-400 flex items-center justify-center font-bold';
                indicator.style.width = '24px';
                indicator.style.height = '24px';
                indicator.textContent = '+';
                container.appendChild(indicator);
            }
            return;
        }

        // If below limit, remove indicator if exists
        if (hasIndicator) {
            container.removeChild(container.lastElementChild);
        }

        if (count > visualCount) {
            const diff = count - visualCount;
            for (let i = 0; i < diff; i++) {
                container.appendChild(createBacterium(type));
            }
        } else if (count < visualCount && count >= 0) {
            // Rebuild if reducing significantly or just remove last
            container.innerHTML = '';
            for (let i = 0; i < count; i++) {
                container.appendChild(createBacterium(type));
            }
        }
    }

    // --- 4. CORE LOGIC ---
    function updateSlider() {
        v = parseFloat(els.slider.value);
        gamma = calculateGamma(v);

        els.vDisplay.textContent = v.toFixed(2) + " c";
        els.spacecraftVLabel.textContent = "v = " + v.toFixed(2) + " c";
        els.gammaDisplay.textContent = gamma.toFixed(3);

        if (v > 0.1) {
            els.dilationIndicator.classList.remove('hidden');
            els.dilationIndicator.style.opacity = Math.min((v - 0.1) * 2, 1);
        } else {
            els.dilationIndicator.classList.add('hidden');
        }
    }

    function updateVisuals(eTime, sTime, eCount, sCount, eG, sG) {
        els.earthTimeText.textContent = eTime.toFixed(2);
        els.spaceTimeText.textContent = sTime.toFixed(2);
        els.earthGText.textContent = eG.toFixed(1);
        els.spaceGText.textContent = sG.toFixed(1);
        els.earthCountText.textContent = Math.floor(eCount).toLocaleString();
        els.spaceCountText.textContent = Math.floor(sCount).toLocaleString();

        // Rotate SVG Hands (rotate around center)
        const eDeg = (eTime % 12) / 12 * 360;
        const sDeg = (sTime % 12) / 12 * 360;
        els.earthClockHand.style.transform = `rotate(${eDeg}deg)`;
        els.spaceClockHand.style.transform = `rotate(${sDeg}deg)`;

        updateBacteriaDisplay(els.earthContainer, eCount, 'earth');
        updateBacteriaDisplay(els.spaceContainer, sCount, 'space');
    }

    function finishSim(eG, sG) {
        isRunning = false;
        els.startBtn.innerHTML = `Selesai (Ulangi)`;
        safeUpdateIcons();

        els.statusMessage.textContent = "Eksperimen Selesai: Proper Time tercapai di kedua sistem.";
        els.statusMessage.classList.replace('text-yellow-400', 'text-green-400');

        els.resultEarthG.textContent = eG.toFixed(2);
        els.resultSpaceG.textContent = sG.toFixed(2);
    }

    function resetSim() {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        isRunning = false;
        coordinateTime = 0;
        earthProperTime = 0;
        spaceProperTime = 0;

        // Clear Canvases logic in chart cleanup below
        // Clear dots
        els.earthContainer.innerHTML = '';
        els.spaceContainer.innerHTML = '';
        els.earthContainer.appendChild(createBacterium('earth'));
        els.spaceContainer.appendChild(createBacterium('space'));

        els.resultEarthG.textContent = "-";
        els.resultSpaceG.textContent = "-";

        els.startBtn.innerHTML = `Mulai`;
        els.statusMessage.style.opacity = 0;

        els.slider.disabled = false;
        els.targetTimeInput.disabled = false;
        els.doublingTimeInput.disabled = false;

        // Update target display labels
        const targetT = els.targetTimeInput.value;
        els.earthTargetDisplay.textContent = targetT + "h";
        els.spaceTargetDisplay.textContent = targetT + "h";

        safeUpdateIcons();

        // Chart Cleanup
        els.earthChartCanvas.classList.add('hidden');
        els.spaceChartCanvas.classList.add('hidden');
        if (earthChartInstance) { earthChartInstance.destroy(); earthChartInstance = null; }
        if (spaceChartInstance) { spaceChartInstance.destroy(); spaceChartInstance = null; }
    }

    function startSim() {
        if (isRunning) return;

        const targetTime = parseFloat(els.targetTimeInput.value);
        const doublingTime = parseFloat(els.doublingTimeInput.value);

        if (targetTime <= 0 || doublingTime <= 0) {
            alert("Masukkan waktu target dan waktu duplikasi yang valid (>0)");
            return;
        }

        // Update labels
        els.earthTargetDisplay.textContent = targetTime + "h";
        els.spaceTargetDisplay.textContent = targetTime + "h";

        isRunning = true;
        els.startBtn.innerHTML = `Berjalan...`;
        els.statusMessage.textContent = "Simulasi Berjalan...";
        els.statusMessage.style.opacity = 1;
        els.statusMessage.classList.replace('text-green-400', 'text-yellow-400');

        els.slider.disabled = true;
        els.targetTimeInput.disabled = true;
        els.doublingTimeInput.disabled = true;

        safeUpdateIcons();

        // CONDITIONAL CHART LOGIC
        const showChart = targetTime > 14;

        if (showChart) {
            // Show Charts, Hide Dots
            els.earthChartCanvas.classList.remove('hidden');
            els.spaceChartCanvas.classList.remove('hidden');

            // CLEAR DOTS to prevent overlap
            els.earthContainer.innerHTML = '';
            els.spaceContainer.innerHTML = '';

            initCharts(targetTime * 2); // Set X-axis max slightly larger than targetTime? Or just targetTime?
            // If v=0.866, gamma=2. Space needs 2*targetTime coordinate time to finish. 
            // So X axis should support enough coordinate time.
            // Let's use auto-scaling or estimate max coordinate time needed: TargetTime * Gamma.
            // But we don't know gamma if user changes slider? Slider is locked during run.
            // Current gamma is set.
            const maxCoordinateTime = targetTime * (gamma > 1 ? gamma : 1);
            initCharts(maxCoordinateTime);

        } else {
            els.earthChartCanvas.classList.add('hidden');
            els.spaceChartCanvas.classList.add('hidden');
        }

        let lastTimestamp = performance.now();
        let lastChartUpdate = 0;
        coordinateTime = 0; // Reset coordinate time

        function loop(timestamp) {
            if (!isRunning) return;

            const deltaTime = (timestamp - lastTimestamp) / 1000;
            lastTimestamp = timestamp;

            const step = deltaTime * 5; // Simulation speed

            // Advance Coordinate Time (The Driver)
            coordinateTime += step;

            // Increment Earth Time (Earth is stationary relative to coordinate system, so Proper = Coordinate)
            // But we MUST clamp it at targetTime because the experiment "stops" for the observer when their clock reads T.
            if (earthProperTime < targetTime) {
                earthProperTime = Math.min(coordinateTime, targetTime);
            }

            // Increment Space Time (adjusted by Gamma)
            // SpaceProper = Coordinate / Gamma
            // Also clamp at targetTime
            if (spaceProperTime < targetTime) {
                spaceProperTime = Math.min(coordinateTime / gamma, targetTime);
            }

            // Calculate Biology
            const earthGen = earthProperTime / doublingTime;
            const spaceGen = spaceProperTime / doublingTime;
            const earthCount = Math.pow(2, earthGen);
            const spaceCount = Math.pow(2, spaceGen);

            // Logic moved to conditional block below
            // updateVisuals(earthProperTime, spaceProperTime, earthCount, spaceCount, earthGen, spaceGen);

            // Update Chart (limit reflows)
            // Update Chart (limit reflows)
            // Update Chart (limit reflows)
            if (showChart && (timestamp - lastChartUpdate > 100)) {
                if (earthChartInstance) {
                    earthChartInstance.data.datasets[0].data.push({ x: coordinateTime, y: earthCount });
                    earthChartInstance.update('none');
                }
                if (spaceChartInstance) {
                    spaceChartInstance.data.datasets[0].data.push({ x: coordinateTime, y: spaceCount });
                    spaceChartInstance.update('none');
                }
                lastChartUpdate = timestamp;
            } else if (!showChart) {
                // Only update dots if chart is NOT shown to save massive CPU
                updateVisuals(earthProperTime, spaceProperTime, earthCount, spaceCount, earthGen, spaceGen);
            } else {
                // Even if showing chart, we still need to update text numbers!
                els.earthTimeText.textContent = earthProperTime.toFixed(2);
                els.spaceTimeText.textContent = spaceProperTime.toFixed(2);
                els.earthGText.textContent = earthGen.toFixed(1);
                els.spaceGText.textContent = spaceGen.toFixed(1);

                // Smart formatting for count
                const fmt = (n) => n < 1e6 ? Math.floor(n).toLocaleString() : Math.floor(n).toExponential(2);
                els.earthCountText.textContent = fmt(earthCount);
                els.spaceCountText.textContent = fmt(spaceCount);

                // Still rotate clocks
                const eDeg = (earthProperTime % 12) / 12 * 360;
                const sDeg = (spaceProperTime % 12) / 12 * 360;
                els.earthClockHand.style.transform = `rotate(${eDeg}deg)`;
                els.spaceClockHand.style.transform = `rotate(${sDeg}deg)`;
            }

            // Finish Check
            if (Math.abs(earthProperTime - targetTime) < 0.01 && Math.abs(spaceProperTime - targetTime) < 0.01) {
                finishSim(earthGen, spaceGen);
                return;
            }

            animationFrame = requestAnimationFrame(loop);
        }

        animationFrame = requestAnimationFrame(loop);
    }

    // --- 5. EVENT LISTENERS ---
    // Bind events immediately
    els.slider.addEventListener('input', updateSlider);
    els.startBtn.addEventListener('click', startSim);
    els.resetBtn.addEventListener('click', resetSim);

    // Update display when input changes (even before start)
    els.targetTimeInput.addEventListener('input', () => {
        const t = els.targetTimeInput.value;
        els.earthTargetDisplay.textContent = t + "h";
        els.spaceTargetDisplay.textContent = t + "h";
    });

    els.infoBtn.addEventListener('click', () => els.infoModal.classList.remove('hidden'));
    els.closeInfoBtn.addEventListener('click', () => els.infoModal.classList.add('hidden'));

    // --- 6. INITIALIZATION ---
    updateSlider();
    resetSim();
    setTimeout(safeUpdateIcons, 100);

})();
