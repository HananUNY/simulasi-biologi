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
        spaceTargetDisplay: document.getElementById('spaceTargetDisplay')
    };

    // --- 2. VARIABLES & CONSTANTS ---
    let isRunning = false;
    let animationFrame;
    let v = 0;
    let gamma = 1;
    let earthProperTime = 0;
    let spaceProperTime = 0;

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

    function createBacterium(type) {
        const div = document.createElement('div');
        div.className = `bacterium ${type === 'space' ? 'space' : ''}`;
        return div;
    }

    function updateBacteriaDisplay(container, count, type) {
        const MAX_VISUAL_DOTS = 32; // Reduced for cleaner UI
        const currentVisuals = container.children.length;

        if (count > MAX_VISUAL_DOTS) {
            if (currentVisuals < MAX_VISUAL_DOTS) {
                for (let i = currentVisuals; i < MAX_VISUAL_DOTS; i++) {
                    container.appendChild(createBacterium(type));
                }
            }
            return;
        }

        if (count > currentVisuals) {
            const diff = count - currentVisuals;
            for (let i = 0; i < diff; i++) {
                container.appendChild(createBacterium(type));
            }
        } else if (count < currentVisuals) {
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
        earthProperTime = 0;
        spaceProperTime = 0;

        updateVisuals(0, 0, 1, 1, 0, 0);

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

        let lastTimestamp = performance.now();

        function loop(timestamp) {
            if (!isRunning) return;

            const deltaTime = (timestamp - lastTimestamp) / 1000;
            lastTimestamp = timestamp;

            const step = deltaTime * 5; // Simulation speed

            // Increment Earth Time
            if (earthProperTime < targetTime) {
                earthProperTime += step;
                if (earthProperTime > targetTime) earthProperTime = targetTime;
            }

            // Increment Space Time (adjusted by Gamma)
            if (spaceProperTime < targetTime) {
                spaceProperTime += (step / gamma);
                if (spaceProperTime > targetTime) spaceProperTime = targetTime;
            }

            // Calculate Biology
            const earthGen = earthProperTime / doublingTime;
            const spaceGen = spaceProperTime / doublingTime;
            const earthCount = Math.pow(2, earthGen);
            const spaceCount = Math.pow(2, spaceGen);

            updateVisuals(earthProperTime, spaceProperTime, earthCount, spaceCount, earthGen, spaceGen);

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
