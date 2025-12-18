// --- Feature: Graph History ---
const tempHistory = [];

// --- Feature: Tracking ---
let trackedParticle = null;
let trackedState = ""; // Description text
let isFollowing = false;

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

    if (!btn || !statusLabel) return;

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

// --- Feature: Graph Rendering ---

// Note: updateGraph requires gCtx, graphCanvas which are globally accessed (or can be passed)
// Assuming they are global as per the "Global scope" plan in ui.js

function updateGraph() {
    // Check if gCtx exists
    if (!gCtx || !graphCanvas) return;

    // Clear
    gCtx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);

    const w = graphCanvas.width;
    const h = graphCanvas.height;

    // Background grid lines
    gCtx.strokeStyle = 'rgba(255,255,255,0.1)';
    gCtx.lineWidth = 1;
    gCtx.beginPath();
    for (let i = 0; i <= 4; i++) {
        let y = h * (i / 4);
        gCtx.moveTo(0, y);
        gCtx.lineTo(w, y);
    }
    gCtx.stroke();

    if (tempHistory.length < 2) return;

    // Scale
    const minT = 0;
    const maxT = 45;
    const range = maxT - minT;

    // Draw Area
    gCtx.fillStyle = 'rgba(239, 68, 68, 0.2)'; // Red-500 transparent
    gCtx.beginPath();
    gCtx.moveTo(0, h);

    for (let i = 0; i < tempHistory.length; i++) {
        let x = (i / (tempHistory.length - 1)) * w;
        let val = tempHistory[i];
        if (val > maxT) val = maxT;
        if (val < minT) val = minT;
        let y = h - ((val - minT) / range) * h;
        gCtx.lineTo(x, y);
    }
    gCtx.lineTo(w, h);
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

    // Labels
    gCtx.fillStyle = '#94a3b8'; // Slate-400
    gCtx.font = '10px monospace';
    gCtx.fillText(`Max: ${maxT}°C`, 5, 12);
    gCtx.fillText(`Min: ${minT}°C`, 5, h - 5);

    // Current Temp Label
    if (tempHistory.length > 0) {
        let current = tempHistory[tempHistory.length - 1];
        let cx = w;
        let cy = h - ((current - minT) / range) * h;

        gCtx.fillStyle = '#fff';
        gCtx.fillText(`${current.toFixed(1)}°C`, cx - 40, cy - 5);

        gCtx.fillStyle = '#ef4444';
        gCtx.beginPath();
        gCtx.arc(cx, cy, 3, 0, Math.PI * 2);
        gCtx.fill();
    }
}

// --- Feature: Data Export ---

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

function exportImage() {
    const link = document.createElement('a');
    link.download = 'climate_graph.png';
    link.href = graphCanvas.toDataURL();
    link.click();
}
