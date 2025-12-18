// --- Main Entry Point ---

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
    if (typeof updateTrackingUI === 'function') updateTrackingUI();

    // Initial Population
    if (typeof updateCO2Count === 'function') updateCO2Count();
    if (typeof updateCloudCount === 'function') updateCloudCount();
}

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

function loop() {
    // Run physics/logic multiple times per frame based on slider
    for (let i = 0; i < params.simSpeed; i++) {
        updateModel();
    }

    // Draw once per frame
    drawModel();

    requestAnimationFrame(loop);
}

// Start
resize();
init();
loop();
