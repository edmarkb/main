class Device {
  constructor(acesId, name, espUrl) {
    this.acesId = acesId;         // Hardware ID: ACES-1, ACES-2, ACES-3
    this.name = name;             // User's custom label (lab name)
    this.espUrl = espUrl;         // e.g., http://192.168.100.70/data

    this.temperature = null;
    this.humidity = null;
    this.gas = null;
    this.fire = null;

    this.online = false;
    this.lastResponse = null;
  }

  // Update sensor data (received from backend via WebSocket)
  updateSensorData(data) {
    if (data.temperature !== undefined) this.temperature = Number(data.temperature);
    if (data.humidity !== undefined) this.humidity = Number(data.humidity);
    if (data.gas !== undefined) this.gas = Number(data.gas);
    // Backend sends "flame", normalize to "fire" for frontend
    // IMPORTANT: If neither fire nor flame is present in the data,
    // explicitly reset to false so the UI doesn't stay stuck in fire state
    if (data.fire !== undefined) {
      this.fire = data.fire;
    } else if (data.flame !== undefined) {
      this.fire = data.flame;
    } else {
      // ESP32 didn't send flame data at all — assume no fire
      this.fire = false;
    }
    
    this.lastResponse = Date.now();
    this.online = true;
  }
}

/* ===============================
   DEVICE STORAGE & LIST LOGIC
   =============================== */

// ✅ FIX: Added "let devices = [];" so the variable is declared properly
let devices = [];
let deviceData = JSON.parse(localStorage.getItem("acesDevices"));

if (deviceData !== null) {
    // Re-instantiate the Class objects from saved data (even if empty array)
    devices = deviceData
        .filter(d => {
            // Remove devices that were auto-added by backend without a user-defined name
            const name = d.name || d.labName;
            return name && name !== 'undefined' && name !== 'null';
        })
        .map(d => {
            const id = d.acesId || d.deviceId || 'ACES-1';
            const name = d.name || d.labName;
            const dev = new Device(id, name, d.espUrl);
            // Always start offline — server/API will confirm true status
            // Sensor values zeroed until confirmed online with fresh data
            dev.temperature = 0;
            dev.humidity = 0;
            dev.gas = 0;
            dev.fire = false;
            dev.online = false;
            dev.lastResponse = d.lastResponse;
            return dev;
        });
    localStorage.setItem("acesDevices", JSON.stringify(devices));
} else {
    // Fresh device - start with empty array, devices will sync via WebSocket
    devices = [];
    localStorage.setItem("acesDevices", JSON.stringify(devices));
}

// 2. Save function to keep LocalStorage updated
function saveDevices() {
    localStorage.setItem("acesDevices", JSON.stringify(devices));
}

/* ===============================
   EDIT / REMOVE / ADD FUNCTIONS
   =============================== */

function editDevice(deviceName) {
    const device = devices.find(d => d.name === deviceName);
    if (!device) return;

    const newName = prompt("Edit device name:", device.name);
    if (newName && newName.trim() !== "") {
        const oldName = device.name;
        device.name = newName.trim();
        saveDevices();
        
        // Notify other users
        if (typeof emitDeviceRenamed === 'function') {
            emitDeviceRenamed(oldName, device.name);
        }
        
        if (typeof renderDevices === "function") renderDevices();
    }
}

function removeDevice(deviceName) {
    if (!confirm(`Are you sure you want to remove "${deviceName}"?`)) return;

    // Find device to get its ID for clearing localStorage
    const device = devices.find(d => d.name === deviceName);
    if (device) {
        // Clear device-specific logs and BFP number from localStorage using acesId
        localStorage.removeItem(`deviceActivityLogs_${device.acesId}`);
        localStorage.removeItem(`bfpContactNumber_${device.acesId}`);
    }

    devices = devices.filter(d => d.name !== deviceName);
    saveDevices();
    
    // Notify other users
    if (typeof emitDeviceRemoved === 'function') {
        emitDeviceRemoved(deviceName);
    }
    
    if (typeof renderDevices === "function") renderDevices();
}

function addNewDevice(acesId, name, url = "") {
    const newDev = new Device(acesId, name, url || "");
    // Sensor values will be populated by backend via WebSocket
    
    devices.push(newDev);
    saveDevices();
    
    // Register device with backend for polling
    if (API_CONFIG.ENABLE_API) {
        fetch(getApiUrl(API_CONFIG.ENDPOINTS.GET_DEVICES), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: acesId, labName: name, espUrl: url })
        }).catch(err => console.error('Failed to register device with backend:', err));
    }
    
    // Notify other users via WebSocket
    if (typeof emitDeviceAdded === 'function') {
        emitDeviceAdded(newDev);
    }
}
// 1. ADDED: Define the devices list (Pull from storage or start empty)

const deviceGrid = document.getElementById("deviceGrid");
let currentEditingName = null;
let deviceToDelete = null;

// ---------------- DEVICE SAVE ----------------
function saveDevices() {
  const plainDevices = devices.map(d => ({
    acesId: d.acesId,
    name: d.name,
    espUrl: d.espUrl,
    temperature: d.temperature,
    humidity: d.humidity,
    gas: d.gas,
    flame: d.flame,
    online: d.online,
    lastResponse: d.lastResponse
  }));
  localStorage.setItem("acesDevices", JSON.stringify(plainDevices));
}

// ---------------- SENSOR MINI SCREEN HELPER ----------------
function createSensorHTML(label, value, unit, iconSVG = "") {
  const wrapper = document.createElement("div");
  wrapper.className = "sensor-box";
  wrapper.innerHTML = `
    <div class="sensor-icon">${iconSVG}</div>
    <div class="sensor-unit">${unit}</div> <div class="sensor-data-group">
      <span class="sensor-value" data-value="${value}">${value}</span>
    </div>
    <div class="sensor-label">${label}</div>
  `;
  return wrapper;
}

// ---------------- UPDATE SENSOR VALUES SMOOTHLY ----------------
function updateSensorValues(tile, device) {
  const boxes = tile.querySelectorAll(".sensor-box");
  let isEmergency = false;
  let isWarning = false;
  
  // Check fire sensor first (highest priority)
  const isFire = device.fire === true || device.fire === 1 || device.fire === "true";
  if (isFire) {
    isEmergency = true;
  }
  
  boxes.forEach(box => {
    const labelEl = box.querySelector(".sensor-label");
    if (!labelEl) return;

    const label = labelEl.textContent;
    let newVal = 0;
    let isDanger = false;
    let isWarn = false;

    if (label === "Temp") {
      newVal = parseFloat((device.temperature ?? 0).toFixed(1));
      if (newVal >= 42 || isFire) {
        isDanger = true;
        isEmergency = true;
      } else if (newVal >= 38) {
        isWarn = true;
        isWarning = true;
      }
    } else if (label === "Humidity") {
      newVal = parseFloat((device.humidity ?? 0).toFixed(1));
    } else if (label === "Gas") {
      newVal = parseFloat((device.gas ?? 0).toFixed(1));
      if (newVal >= 600 || isFire) {
        isDanger = true;
        isEmergency = true;
      } else if (newVal >= 450) {
        isWarn = true;
        isWarning = true;
      }
    }

    box.classList.toggle("danger", isDanger);
    box.classList.toggle("warning", isWarn);
    const valueEl = box.querySelector(".sensor-value");
    const oldVal = parseFloat(valueEl.dataset.value) || 0;
    
    if (newVal === oldVal) return;

    const diff = newVal - oldVal;
    const step = diff / 3;
    let i = 0;

    if (valueEl.animInterval) clearInterval(valueEl.animInterval);
    valueEl.animInterval = setInterval(() => {
      i++;
      if (i >= 3) {
        clearInterval(valueEl.animInterval);
        valueEl.textContent = newVal.toFixed(1);
        valueEl.dataset.value = newVal;
      } else {
        valueEl.textContent = (oldVal + (step * i)).toFixed(1);
      }
    }, 30);
  });
  
  // Toggle emergency/warning class on tile (emergency takes priority)
  tile.classList.toggle("emergency-active", isEmergency);
  tile.classList.toggle("warning-active", isWarning && !isEmergency);
}

// ---------------- RENDER DEVICE TILES / INLINE DETAIL ----------------
function renderDevices() {
  if (!deviceGrid) return; // Guard against missing grid
  deviceGrid.innerHTML = "";

  const isDesktop = window.innerWidth >= 768 && typeof ICONS !== 'undefined';

  if (isDesktop) {
    // ========================================
    // DESKTOP: Inline Device Detail View
    // ========================================
    const detTempIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-120q-83 0-141.5-58.5T280-320q0-48 21-89.5t59-70.5v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q38 29 59 70.5t21 89.5q0 83-58.5 141.5T480-120Zm0-80q50 0 85-35t35-85q0-29-12.5-54T552-416l-32-24v-280q0-17-11.5-28.5T480-760q-17 0-28.5 11.5T440-720v280l-32 24q-23 17-35.5 42T360-320q0 50 35 85t85 35Zm0-120Z"/></svg>`;
    const detHumIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M460-160q-50 0-85-35t-35-85h80q0 17 11.5 28.5T460-240q17 0 28.5-11.5T500-280q0-17-11.5-28.5T460-320H80v-80h380q50 0 85 35t35 85q0 50-35 85t-85 35ZM80-560v-80h540q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43h-80q0-59 40.5-99.5T620-840q59 0 99.5 40.5T760-700q0 59-40.5 99.5T620-560H80Zm660 320v-80q26 0 43-17t17-43q0-26-17-43t-43-17H80v-80h660q59 0 99.5 40.5T880-380q0 59-40.5 99.5T740-240Z"/></svg>`;
    const detGasIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M320-80q-66 0-113-47t-47-113v-400q0-66 47-113t113-47h40v-80h80v80h80v-80h80v80h40q66 0 113 47t47 113v400q0 66-47 113T640-80H320Zm0-80h320q33 0 56.5-23.5T720-240v-400q0-33-23.5-56.5T640-720H320q-33 0-56.5 23.5T240-640v400q0 33 23.5 56.5T320-160Zm0-400h320v-80H320v80Zm160 320q42 0 71-28.5t29-69.5q0-33-19-56.5T480-490q-63 72-81.5 96T380-338q0 41 29 69.5t71 28.5ZM240-720v560-560Z"/></svg>`;
    const logSVG = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor" class="activity-log-icon"><path d="M480-120q-138 0-240.5-91.5T122-440h82q14 104 92.5 172T480-200q117 0 198.5-81.5T760-480q0-117-81.5-198.5T480-760q-69 0-129 32t-101 88h110v80H120v-240h80v94q51-64 124.5-99T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-120Zm112-192L440-464v-216h80v184l128 128-56 56Z"/></svg>`;
    const reportSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="m720-120 160-160-56-56-64 64v-167h-80v167l-64-64-56 56 160 160ZM560 0v-80h320V0H560ZM240-160q-33 0-56.5-23.5T160-240v-560q0-33 23.5-56.5T240-880h280l240 240v121h-80v-81H480v-200H240v560h240v80H240Zm0-80v-560 560Z"/></svg>`;

    devices.forEach(device => {
      const card = document.createElement("div");
      card.className = "device-tile device-inline-detail";
      card.setAttribute('data-name', device.name);
      card.setAttribute('data-aces-id', device.acesId);
      const statusClass = device.online ? "online" : "offline";
      const alarmOn = localStorage.getItem(`manualAlarm_${device.acesId}`) === 'true';

      card.innerHTML = `
        <div class="bento-title-bar">
          <div class="bento-title-info">
            <span class="bento-device-name">${device.name}</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="bento-device-id">${device.acesId}</span>
              <div data-role="detStatus" class="device-status ${statusClass}">${device.online ? "ONLINE" : "OFFLINE"}</div>
            </div>
          </div>
          <div class="bento-title-actions">
            <button class="bento-action-btn bento-rename-btn" onclick="editDevice('${device.name}')">
              <svg xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>
              RENAME
            </button>
            <button class="bento-action-btn bento-remove-btn" onclick="removeDevice('${device.name}')">
              <svg xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 -960 960 960" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
              REMOVE
            </button>
          </div>
        </div>

        <div class="bento-grid">
          <!-- Left: Status Banner (spans 2 rows) -->
          <div class="bento-banner">
            <div data-role="statusBanner" class="status-banner banner-safe">
              <div data-role="bannerIcon"></div>
              <h2 data-role="bannerText">SYSTEM SAFE</h2>
            </div>
          </div>

          <!-- Top Right: Sensor Cards -->
          <div class="bento-sensors">
            <div class="bento-section-header">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="bento-section-icon"><path d="M197-197q-54-55-85.5-127.5T80-480q0-84 31.5-156.5T197-763l57 57q-44 44-69 102t-25 124q0 67 25 125t69 101l-57 57Zm113-113q-32-33-51-76.5T240-480q0-51 19-94.5t51-75.5l57 57q-22 22-34.5 51T320-480q0 33 12.5 62t34.5 51l-57 57Zm113.5-113.5Q400-447 400-480t23.5-56.5Q447-560 480-560t56.5 23.5Q560-513 560-480t-23.5 56.5Q513-400 480-400t-56.5-23.5ZM650-310l-57-57q22-22 34.5-51t12.5-62q0-33-12.5-62T593-593l57-57q32 32 51 75.5t19 94.5q0 50-19 93.5T650-310Zm113 113-57-57q44-44 69-102t25-124q0-67-25-125t-69-101l57-57q54 54 85.5 126.5T880-480q0 83-31.5 155.5T763-197Z"/></svg>
              <span class="bento-section-title">Realtime Sensor Values</span>
            </div>
            <div class="sensor-row">
              <div class="sensor-box" data-role="tempBox">
                <div class="sensor-icon">${detTempIcon}</div>
                <div class="sensor-unit">°C</div>
                <span class="sensor-value" data-role="detTemp">${(device.temperature ?? 0).toFixed(1)}</span>
                <div class="sensor-label">Temperature</div>
              </div>
              <div class="sensor-box" data-role="humBox">
                <div class="sensor-icon">${detHumIcon}</div>
                <div class="sensor-unit">%</div>
                <span class="sensor-value" data-role="detHum">${(device.humidity ?? 0).toFixed(1)}</span>
                <div class="sensor-label">Humidity</div>
              </div>
              <div class="sensor-box" data-role="gasBox">
                <div class="sensor-icon">${detGasIcon}</div>
                <div class="sensor-unit">PPM</div>
                <span class="sensor-value" data-role="detGas">${(device.gas ?? 0).toFixed(0)}</span>
                <div class="sensor-label">Gas/Smoke</div>
              </div>
            </div>
          </div>

          <!-- Bottom Right: Controls -->
          <div class="bento-controls">
            <div class="bento-section-header">
              <svg viewBox="0 0 25 25" fill="none" stroke="currentColor" stroke-width="1.2" class="bento-section-icon"><path d="M6.5 5V7.5M6.5 7.5C5.39543 7.5 4.5 8.39543 4.5 9.5C4.5 10.6046 5.39543 11.5 6.5 11.5M6.5 7.5C7.60457 7.5 8.5 8.39543 8.5 9.5C8.5 10.6046 7.60457 11.5 6.5 11.5M6.5 11.5V20M12.5 5V13.5M12.5 13.5C11.3954 13.5 10.5 14.3954 10.5 15.5C10.5 16.6046 11.3954 17.5 12.5 17.5M12.5 13.5C13.6046 13.5 14.5 14.3954 14.5 15.5C14.5 16.6046 13.6046 17.5 12.5 17.5M12.5 17.5V20M18.5 5V7.5M18.5 7.5C17.3954 7.5 16.5 8.39543 16.5 9.5C16.5 10.6046 17.3954 11.5 18.5 11.5M18.5 7.5C19.6046 7.5 20.5 8.39543 20.5 9.5C20.5 10.6046 19.6046 11.5 18.5 11.5M18.5 11.5V20"/></svg>
              <span class="bento-section-title">Device Controls</span>
            </div>
            <div class="modal-button-row">
              <button onclick="triggerInlineValidation('alarm', '${device.acesId}')" data-role="manualAlarmBtn" class="modal-btn tactile-key tactile-key-labeled ${alarmOn ? 'is-active' : ''}">
                <span data-role="alarmBtnIcon" class="power-icon">${alarmOn ? ICONS.ALARM_ON : ICONS.ALARM_OFF}</span>
                <span class="tactile-label" data-role="alarmBtnLabel">${alarmOn ? 'DEACTIVATE ALARM' : 'ACTIVATE ALARM'}</span>
              </button>
              <button onclick="triggerInlineValidation('bfp', '${device.acesId}')" data-role="bfpBtn" class="modal-btn delete-style tactile-key tactile-key-labeled">
                <span class="bfp-icon-wrap">${ICONS.BFP}</span>
                <span class="tactile-label">ALERT BFP</span>
              </button>
            </div>
          </div>

          <!-- Bottom Left: Sensor Trends -->
          <div class="bento-trends">
            <div class="bento-section-header bento-trends-header">
              <div class="bento-trends-title-group">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="bento-section-icon"><path d="M280-280h80v-200h-80v200Zm320 0h80v-400h-80v400Zm-160 0h80v-120h-80v120Zm0-200h80v-80h-80v80ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z"/></svg>
                <span class="bento-section-title">SENSOR TRENDS</span>
              </div>
              <div class="trend-timeframe-btns" data-aces-id="${device.acesId}">
                <button class="trend-tf-btn active" data-tf="live" onclick="switchTrendTimeframe('${device.acesId}','live',this)">LIVE</button>
                <button class="trend-tf-btn" data-tf="24h" onclick="switchTrendTimeframe('${device.acesId}','24h',this)">24H</button>
                <button class="trend-tf-btn" data-tf="7d" onclick="switchTrendTimeframe('${device.acesId}','7d',this)">7D</button>
              </div>
            </div>
            <div class="trend-chart-wrapper">
              <canvas data-role="trendChart" class="trend-chart-canvas"></canvas>
              <div class="trend-crosshair" style="display:none;"></div>
              <div class="trend-tooltip" style="display:none;"></div>
              <div class="trend-loading" style="display:none;">
                <div class="trend-loading-spinner"></div>
                <span>Loading historical data...</span>
              </div>
              <div class="trend-no-data" style="display:none;">
                <span>No historical data available for this period</span>
              </div>
            </div>
            <div class="trend-legend">
              <span class="trend-legend-item"><span class="trend-dot" style="background:#ff6b6b;"></span>Temp</span>
              <span class="trend-legend-item"><span class="trend-dot" style="background:#48dbfb;"></span>Humidity</span>
              <span class="trend-legend-item"><span class="trend-dot" style="background:#ffa502;"></span>Gas</span>
            </div>
          </div>

          <!-- Bottom Right: Activity Log -->
          <div class="bento-log">
            <div class="sensor-box activity-log-container">
              <div class="activity-log-header">
                <div class="activity-log-title-group">
                  ${logSVG}
                  <h3 class="activity-log-title">DEVICE ACTIVITY LOG</h3>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div class="report-dropdown">
                    <button class="activity-log-action-btn" onclick="toggleInlineReportMenu('${device.acesId}')">GENERATE REPORT</button>
                    <div data-role="deviceReportMenu" class="report-menu" style="display: none;">
                      <button class="report-option" onclick="generateInlineDeviceReport('${device.acesId}', 'pdf')">${reportSVG} PDF</button>
                      <button class="report-option" onclick="generateInlineDeviceReport('${device.acesId}', 'txt')">${reportSVG} TXT</button>
                      <button class="report-option" onclick="generateInlineDeviceReport('${device.acesId}', 'csv')">${reportSVG} CSV</button>
                    </div>
                  </div>
                  <button onclick="clearInlineDeviceLogs('${device.acesId}')" class="activity-log-action-btn">CLEAR CONSOLE</button>
                </div>
              </div>
              <div data-role="deviceLogList" style="width: 100%; flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 0 28px 20px 28px;"></div>
            </div>
          </div>
        </div>
      `;

      deviceGrid.appendChild(card);
    });

  } else {
    // ========================================
    // MOBILE: Compact Device Tiles
    // ========================================
    const tempIcon = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-120q-83 0-141.5-58.5T280-320q0-48 21-89.5t59-70.5v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q38 29 59 70.5t21 89.5q0 83-58.5 141.5T480-120Zm0-80q50 0 85-35t35-85q0-29-12.5-54T552-416l-32-24v-280q0-17-11.5-28.5T480-760q-17 0-28.5 11.5T440-720v280l-32 24q-23 17-35.5 42T360-320q0 50 35 85t85 35Zm0-120Z"/></svg>`;
    const humIcon = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" fill="currentColor"><path d="M460-160q-50 0-85-35t-35-85h80q0 17 11.5 28.5T460-240q17 0 28.5-11.5T500-280q0-17-11.5-28.5T460-320H80v-80h380q50 0 85 35t35 85q0 50-35 85t-85 35ZM80-560v-80h540q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43h-80q0-59 40.5-99.5T620-840q59 0 99.5 40.5T760-700q0 59-40.5 99.5T620-560H80Zm660 320v-80q26 0 43-17t17-43q0-26-17-43t-43-17H80v-80h660q59 0 99.5 40.5T880-380q0 59-40.5 99.5T740-240Z"/></svg>`;
    const gasIcon = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" fill="currentColor"><path d="M320-80q-66 0-113-47t-47-113v-400q0-66 47-113t113-47h40v-80h80v80h80v-80h80v80h40q66 0 113 47t47 113v400q0 66-47 113T640-80H320Zm0-80h320q33 0 56.5-23.5T720-240v-400q0-33-23.5-56.5T640-720H320q-33 0-56.5 23.5T240-640v400q0 33 23.5 56.5T320-160Zm0-400h320v-80H320v80Zm160 320q42 0 71-28.5t29-69.5q0-33-19-56.5T480-490q-63 72-81.5 96T380-338q0 41 29 69.5t71 28.5ZM240-720v560-560Z"/></svg>`;

    devices.forEach(device => {
      const tile = document.createElement("div");
      tile.className = "device-tile";
      tile.setAttribute('data-name', device.name);
      const statusClass = device.online ? "online" : "offline";
      
      tile.innerHTML = `
        <div class="device-name">
          <div class="device-name-left">
            <span>${device.name}</span>
            <span class="device-status ${statusClass}">${device.online ? "Online" : "Offline"}</span>
          </div>
          <button class="device-menu-btn" onclick="toggleMenu(event, '${device.name}')">⋮</button>
          <div class="device-menu" id="menu-${device.name}" style="display: none;">
            <button onclick="editDevice('${device.name}')">Rename</button>
            <button onclick="removeDevice('${device.name}')">Remove</button>
          </div>
        </div>
        <div class="sensor-row"></div>
        <button onclick="openDeviceDetail('${device.name}')">View Details</button>
      `;

      const row = tile.querySelector(".sensor-row");
      row.appendChild(createSensorHTML("Temp", (device.temperature ?? 0).toFixed(1), "°C", tempIcon));
      row.appendChild(createSensorHTML("Humidity", (device.humidity ?? 0).toFixed(1), "%", humIcon));
      row.appendChild(createSensorHTML("Gas", (device.gas ?? 0).toFixed(1), "PPM", gasIcon));

      deviceGrid.appendChild(tile);
      updateSensorValues(tile, device);
    });
  }

  // Add device button (both modes)
  if (devices.length < 3) {
    const addCard = document.createElement("div");
    addCard.className = "device-card add-device-slot";
    addCard.innerHTML = `
      <div class="add-icon-wrapper"><span class="plus-icon">+</span></div>
      <p>Add New Device</p>
    `;
    addCard.onclick = addDevicePrompt;
    deviceGrid.appendChild(addCard);
  }

  // Initialize inline devices on desktop
  if (isDesktop && typeof initAllInlineDevices === 'function') {
    initAllInlineDevices();
  }

  // Populate side nav device list
  populateSideNavDevices();

  // Initialize trend charts (desktop bento only)
  if (isDesktop) {
    setTimeout(initTrendCharts, 100);
  }
}

// ---------------- SIDE NAV DEVICE LIST ----------------
function populateSideNavDevices() {
  const list = document.getElementById('sideNavDeviceList');
  if (!list) return;
  list.innerHTML = '';

  if (typeof devices === 'undefined' || !devices.length) {
    list.innerHTML = '<li class="side-nav-device-empty">No devices added</li>';
    return;
  }

  devices.forEach(device => {
    const li = document.createElement('li');
    li.className = 'side-nav-device-item';
    li.setAttribute('data-device-name', device.name);
    li.setAttribute('data-tooltip', `${device.name} (${device.acesId || ''})`);
    const isOnline = device.online === true;
    li.innerHTML = `
      <span class="side-nav-device-dot ${isOnline ? 'online' : ''}"></span>
      <span class="side-nav-device-name">${device.name}</span>
      <span class="side-nav-device-id">(${device.acesId || ''})</span>
    `;
    li.onclick = () => {
      // Highlight this item immediately
      document.querySelectorAll('.side-nav-device-item').forEach(i => i.classList.remove('active'));
      li.classList.add('active');

      // Scroll to the device tile in main content with smooth animation
      const tile = document.querySelector(`.device-tile[data-name="${device.name}"]`);
      if (tile) {
        tile.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Add a brief highlight flash on the tile
        tile.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease';
        tile.style.boxShadow = '0 0 0 3px rgba(65, 195, 143, 0.5)';
        tile.style.transform = 'scale(1.01)';
        setTimeout(() => {
          tile.style.boxShadow = '';
          tile.style.transform = '';
        }, 800);
      }
    };

    // Right-click context menu
    li.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      // Remove any existing context menu
      const existing = document.querySelector('.side-nav-context-menu');
      if (existing) existing.remove();

      const menu = document.createElement('div');
      menu.className = 'side-nav-context-menu';
      menu.innerHTML = `
        <button class="ctx-rename" onclick="editDevice('${device.name}'); this.parentElement.remove();">
          <svg xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>
          Rename
        </button>
        <button class="ctx-remove" onclick="removeDevice('${device.name}'); this.parentElement.remove();">
          <svg xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 -960 960 960" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
          Remove
        </button>
      `;
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      document.body.appendChild(menu);

      // Close on click outside
      const closeCtx = (ev) => {
        if (!menu.contains(ev.target)) {
          menu.remove();
          document.removeEventListener('click', closeCtx);
        }
      };
      setTimeout(() => document.addEventListener('click', closeCtx), 10);
    });

    list.appendChild(li);
  });

  // Set up scroll-sync with IntersectionObserver
  setupSideNavScrollSync();
}

// Scroll-sync: highlight side nav device based on which tile is in view
let sideNavObserver = null;
function setupSideNavScrollSync() {
  if (sideNavObserver) sideNavObserver.disconnect();
  const tiles = document.querySelectorAll('.device-tile.device-inline-detail');
  if (!tiles.length) return;

  sideNavObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const name = entry.target.getAttribute('data-name');
        document.querySelectorAll('.side-nav-device-item').forEach(item => {
          item.classList.toggle('active', item.getAttribute('data-device-name') === name);
        });
      }
    });
  }, { rootMargin: '-20% 0px -60% 0px', threshold: 0.1 });

  tiles.forEach(tile => sideNavObserver.observe(tile));
}

// Update side nav device online status (called from websocket-client)
window.updateSideNavDeviceStatus = function(deviceName, isOnline) {
  const item = document.querySelector(`.side-nav-device-item[data-device-name="${deviceName}"]`);
  if (!item) return;
  const dot = item.querySelector('.side-nav-device-dot');
  if (dot) dot.classList.toggle('online', isOnline);
};

// Expose populateSideNavDevices for websocket-client to call on device add/sync
window.populateSideNavDevices = populateSideNavDevices;

// ================================================================
// SIDE NAV COLLAPSE / EXPAND TOGGLE
// ================================================================
(function initSideNavToggle() {
  const sideNav = document.getElementById('sideNav');
  const toggleBtn = document.getElementById('sideNavToggle');
  if (!sideNav || !toggleBtn) return;

  // Restore saved state (default: collapsed)
  const saved = localStorage.getItem('sideNavCollapsed');
  const isCollapsed = saved === null ? true : saved === 'true';

  if (isCollapsed) {
    sideNav.classList.add('collapsed');
    document.body.classList.add('side-nav-collapsed');
    toggleBtn.setAttribute('data-tooltip', 'Expand');
    toggleBtn.setAttribute('title', 'Expand');
  } else {
    sideNav.classList.remove('collapsed');
    document.body.classList.remove('side-nav-collapsed');
    toggleBtn.setAttribute('data-tooltip', 'Collapse');
    toggleBtn.setAttribute('title', 'Collapse');
  }

  toggleBtn.addEventListener('click', () => {
    const willCollapse = !sideNav.classList.contains('collapsed');
    sideNav.classList.toggle('collapsed', willCollapse);
    document.body.classList.toggle('side-nav-collapsed', willCollapse);
    localStorage.setItem('sideNavCollapsed', willCollapse);
    toggleBtn.setAttribute('data-tooltip', willCollapse ? 'Expand' : 'Collapse');
    toggleBtn.setAttribute('title', willCollapse ? 'Expand' : 'Collapse');

    // Redraw trend charts after transition (canvas sizes change)
    setTimeout(() => {
      if (typeof devices !== 'undefined') {
        devices.forEach(d => {
          if (typeof drawTrendChart === 'function') drawTrendChart(d.acesId);
        });
      }
    }, 350);
  });
})();

// ================================================================
// SENSOR TREND CHARTS (Canvas sparklines for bento grid)
// ================================================================
const trendData = {}; // { acesId: { temp: [], hum: [], gas: [] } }
const TREND_MAX_POINTS = 30;
const activeTrendTimeframe = {}; // { acesId: 'live' | '24h' | '7d' }

// Store computed chart points for hover lookup
// { acesId: { points: [{x, temp, hum, gas, label}], padding, chartW, chartH } }
const chartPointsCache = {};

// Push a new data point for a device
function pushTrendData(acesId, temp, hum, gas) {
  if (!trendData[acesId]) {
    trendData[acesId] = { temp: [], hum: [], gas: [] };
  }
  const d = trendData[acesId];
  d.temp.push(temp);
  d.hum.push(hum);
  d.gas.push(gas);
  if (d.temp.length > TREND_MAX_POINTS) d.temp.shift();
  if (d.hum.length > TREND_MAX_POINTS) d.hum.shift();
  if (d.gas.length > TREND_MAX_POINTS) d.gas.shift();
}

// Draw a smooth sparkline on a canvas (LIVE mode only)
function drawTrendChart(acesId) {
  // Don't draw live chart if viewing historical data
  if (activeTrendTimeframe[acesId] && activeTrendTimeframe[acesId] !== 'live') return;

  const container = document.querySelector(`.device-inline-detail[data-aces-id="${acesId}"]`);
  if (!container) return;
  const canvas = container.querySelector('[data-role="trendChart"]');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const data = trendData[acesId];
  if (!data) return;

  // HiDPI scaling
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width;
  const H = rect.height;

  ctx.clearRect(0, 0, W, H);

  const isDark = document.documentElement.classList.contains('dark-mode');

  const padding = { top: 8, bottom: 8, left: 4, right: 4 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  const lineMargin = 14;
  const drawH = chartH - lineMargin * 2;

  // Draw subtle grid lines
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(W - padding.right, y);
    ctx.stroke();
  }

  // Per-series fixed ranges — each series uses its own natural scale
  const series = [
    { pts: data.temp, color: '#ff6b6b', min: 0, max: 60 },
    { pts: data.hum,  color: '#48dbfb', min: 0, max: 100 },
    { pts: data.gas,  color: '#ffa502', min: 0, max: 1000 }
  ];

  series.forEach(s => {
    if (s.pts.length < 2) return;
    const pts = s.pts;
    const range = s.max - s.min || 1;

    ctx.beginPath();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const points = pts.map((val, i) => {
      const x = padding.left + (i / (TREND_MAX_POINTS - 1)) * chartW;
      const y = padding.top + lineMargin + drawH - ((Math.min(Math.max(val, s.min), s.max) - s.min) / range) * drawH;
      return { x, y };
    });

    // Draw smooth quadratic Bezier curve
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, cpx, (prev.y + curr.y) / 2);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();

    // Draw glow for the last point (live indicator)
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = s.color.replace(')', ', 0.2)').replace('rgb', 'rgba');
    // Hex to rgba for glow
    ctx.fillStyle = s.color + '33';
    ctx.fill();
  });

  // Cache points for hover tooltip (LIVE mode)
  const hoverPoints = [];
  for (let i = 0; i < data.temp.length; i++) {
    const x = padding.left + (i / (TREND_MAX_POINTS - 1)) * chartW;
    const ago = (data.temp.length - 1 - i) * 2; // ~2s intervals
    hoverPoints.push({
      x,
      temp: data.temp[i],
      hum: data.hum[i],
      gas: data.gas[i],
      label: ago === 0 ? 'Now' : `${ago}s ago`
    });
  }
  chartPointsCache[acesId] = { points: hoverPoints, padding, chartW, chartH: H, lineMargin, drawH, series: [{min:0,max:60},{min:0,max:100},{min:0,max:1000}] };
  setupTrendHover(acesId);
}

// Expose for websocket-client to call
window.pushTrendData = pushTrendData;
window.drawTrendChart = drawTrendChart;

// ================================================================
// TREND CHART HOVER TOOLTIP (Crosshair + value readout)
// ================================================================
const trendHoverSetup = new Set(); // Track which canvases already have listeners

function setupTrendHover(acesId) {
  const container = document.querySelector(`.device-inline-detail[data-aces-id="${acesId}"]`);
  if (!container) return;
  const wrapper = container.querySelector('.trend-chart-wrapper');
  const canvas = container.querySelector('[data-role="trendChart"]');
  if (!wrapper || !canvas) return;

  // Only attach listeners once per canvas
  if (canvas._trendHoverBound) return;
  canvas._trendHoverBound = true;

  const crosshair = wrapper.querySelector('.trend-crosshair');
  const tooltip = wrapper.querySelector('.trend-tooltip');
  if (!crosshair || !tooltip) return;

  canvas.addEventListener('mousemove', (e) => {
    const cache = chartPointsCache[acesId];
    if (!cache || !cache.points.length) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const W = rect.width;
    const H = rect.height;

    // Find nearest point by x distance
    let nearest = cache.points[0];
    let minDist = Math.abs(mouseX - nearest.x);
    for (let i = 1; i < cache.points.length; i++) {
      const dist = Math.abs(mouseX - cache.points[i].x);
      if (dist < minDist) {
        minDist = dist;
        nearest = cache.points[i];
      }
    }

    // Show crosshair vertical line (pixel-based for accuracy)
    crosshair.style.display = '';
    crosshair.style.left = `${nearest.x}px`;
    crosshair.style.top = `${cache.padding.top}px`;
    crosshair.style.height = `${cache.chartH - cache.padding.top - (cache.padding.bottom || 8)}px`;

    // Compute Y positions for intersection dots
    const seriesColors = ['#ff6b6b', '#48dbfb', '#ffa502'];
    const seriesVals = [nearest.temp, nearest.hum, nearest.gas];
    let dotsHTML = '';
    if (cache.lineMargin !== undefined && cache.drawH !== undefined && cache.series) {
      for (let si = 0; si < 3; si++) {
        const s = cache.series[si];
        const val = seriesVals[si];
        const clamped = Math.min(Math.max(val, s.min), s.max);
        const frac = (clamped - s.min) / (s.max - s.min || 1);
        const dotY = cache.padding.top + cache.lineMargin + cache.drawH - frac * cache.drawH;
        // Position relative to crosshair's top
        const relY = dotY - cache.padding.top;
        dotsHTML += `<span class="trend-crosshair-dot" style="background:${seriesColors[si]};top:${relY}px;"></span>`;
      }
    }
    crosshair.innerHTML = dotsHTML;

    // Build tooltip HTML
    const isDark = document.documentElement.classList.contains('dark-mode');
    tooltip.innerHTML = `
      <div class="trend-tooltip-time">${nearest.label}</div>
      <div class="trend-tooltip-row">
        <span class="trend-tooltip-dot" style="background:#ff6b6b;"></span>
        <span class="trend-tooltip-label">Temp</span>
        <span class="trend-tooltip-value">${nearest.temp.toFixed(1)}°C</span>
      </div>
      <div class="trend-tooltip-row">
        <span class="trend-tooltip-dot" style="background:#48dbfb;"></span>
        <span class="trend-tooltip-label">Humidity</span>
        <span class="trend-tooltip-value">${nearest.hum.toFixed(1)}%</span>
      </div>
      <div class="trend-tooltip-row">
        <span class="trend-tooltip-dot" style="background:#ffa502;"></span>
        <span class="trend-tooltip-label">Gas</span>
        <span class="trend-tooltip-value">${nearest.gas.toFixed(0)} ppm</span>
      </div>
    `;

    tooltip.style.display = '';

    // Position tooltip — flip sides if near edge
    const tooltipW = tooltip.offsetWidth || 140;
    const tooltipH = tooltip.offsetHeight || 80;
    let tx = nearest.x + 12;
    let ty = mouseY - tooltipH / 2;

    // Flip to left side if too close to right edge
    if (tx + tooltipW > W - 4) {
      tx = nearest.x - tooltipW - 12;
    }
    // Clamp vertical
    ty = Math.max(4, Math.min(ty, H - tooltipH - 4));

    tooltip.style.left = `${tx}px`;
    tooltip.style.top = `${ty}px`;
  });

  canvas.addEventListener('mouseleave', () => {
    crosshair.style.display = 'none';
    crosshair.innerHTML = '';
    tooltip.style.display = 'none';
  });
}

// ================================================================
// HISTORICAL TREND CHART (Timeframe: 24H, 7D)
// ================================================================
const historicalTrendCache = {}; // { `${acesId}_${tf}`: { data, fetchedAt } }
const HISTORICAL_CACHE_TTL = 60000; // 1 minute cache

function switchTrendTimeframe(acesId, timeframe, btnEl) {
  // Update active button
  const container = btnEl.closest('.trend-timeframe-btns');
  container.querySelectorAll('.trend-tf-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');

  activeTrendTimeframe[acesId] = timeframe;

  if (timeframe === 'live') {
    // Switch back to live mode — show real-time canvas
    showTrendState(acesId, 'canvas');
    // Clear the canvas and cached hover data so stale historical data doesn't persist
    const ctr = document.querySelector(`.device-inline-detail[data-aces-id="${acesId}"]`);
    if (ctr) {
      const cvs = ctr.querySelector('[data-role="trendChart"]');
      if (cvs) {
        const c = cvs.getContext('2d');
        if (c) c.clearRect(0, 0, cvs.width, cvs.height);
      }
    }
    // Clear hover cache so historical tooltip doesn't appear on empty live chart
    delete chartPointsCache[acesId];
    drawTrendChart(acesId);
    return;
  }

  // Historical mode — fetch from API
  fetchAndDrawHistorical(acesId, timeframe);
}
window.switchTrendTimeframe = switchTrendTimeframe;

async function fetchAndDrawHistorical(acesId, timeframe) {
  const cacheKey = `${acesId}_${timeframe}`;
  const cached = historicalTrendCache[cacheKey];

  // Use cache if fresh
  if (cached && (Date.now() - cached.fetchedAt < HISTORICAL_CACHE_TTL)) {
    drawHistoricalChart(acesId, cached.data, timeframe);
    return;
  }

  // Show loading state
  showTrendState(acesId, 'loading');

  try {
    const url = getApiUrl(API_CONFIG.ENDPOINTS.GET_SENSOR_READINGS) +
      `?acesId=${encodeURIComponent(acesId)}&timeframe=${timeframe}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    const readings = result.readings || result.data || result || [];

    if (!Array.isArray(readings) || readings.length === 0) {
      showTrendState(acesId, 'no-data');
      return;
    }

    // Cache the result
    historicalTrendCache[cacheKey] = { data: readings, fetchedAt: Date.now() };

    // Only draw if still on this timeframe
    if (activeTrendTimeframe[acesId] === timeframe) {
      drawHistoricalChart(acesId, readings, timeframe);
    }
  } catch (err) {
    console.error(`[Trend] Failed to fetch ${timeframe} data for ${acesId}:`, err.message);
    // If still on this timeframe, show no-data
    if (activeTrendTimeframe[acesId] === timeframe) {
      showTrendState(acesId, 'no-data');
    }
  }
}

function showTrendState(acesId, state) {
  const container = document.querySelector(`.device-inline-detail[data-aces-id="${acesId}"]`);
  if (!container) return;
  const canvas = container.querySelector('[data-role="trendChart"]');
  const loading = container.querySelector('.trend-loading');
  const noData = container.querySelector('.trend-no-data');
  if (canvas) canvas.style.display = state === 'canvas' ? '' : 'none';
  if (loading) loading.style.display = state === 'loading' ? 'flex' : 'none';
  if (noData) noData.style.display = state === 'no-data' ? 'flex' : 'none';
}

function drawHistoricalChart(acesId, readings, timeframe) {
  showTrendState(acesId, 'canvas');
  const container = document.querySelector(`.device-inline-detail[data-aces-id="${acesId}"]`);
  if (!container) return;
  const canvas = container.querySelector('[data-role="trendChart"]');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // HiDPI scaling
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width;
  const H = rect.height;

  ctx.clearRect(0, 0, W, H);

  const isDark = document.documentElement.classList.contains('dark-mode');

  // Padding for axis labels
  const padding = { top: 10, bottom: 28, left: 4, right: 4 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  const lineMargin = 14;
  const drawH = chartH - lineMargin * 2;

  // Draw subtle grid lines
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(W - padding.right, y);
    ctx.stroke();
  }

  // Parse timestamps and values
  const parsed = readings.map(r => ({
    ts: new Date(r.timestamp || r.created_at || r.time),
    temp: parseFloat(r.temperature ?? r.temp ?? 0),
    hum: parseFloat(r.humidity ?? r.hum ?? 0),
    gas: parseFloat(r.gas ?? r.gas_level ?? 0)
  })).sort((a, b) => a.ts - b.ts);

  const tsMin = parsed[0].ts.getTime();
  const tsMax = parsed[parsed.length - 1].ts.getTime();
  const tsRange = tsMax - tsMin || 1;

  // Draw time axis labels
  drawTimeAxis(ctx, parsed, timeframe, padding, W, H, chartW, isDark);

  // Per-series fixed ranges — each series uses its own natural scale
  const series = [
    { key: 'temp', color: '#ff6b6b', min: 0, max: 60 },
    { key: 'hum', color: '#48dbfb', min: 0, max: 100 },
    { key: 'gas', color: '#ffa502', min: 0, max: 1000 }
  ];

  series.forEach(s => {
    if (parsed.length < 2) return;

    const range = s.max - s.min || 1;

    ctx.beginPath();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const points = parsed.map(p => {
      const x = padding.left + ((p.ts.getTime() - tsMin) / tsRange) * chartW;
      const val = p[s.key];
      const y = padding.top + lineMargin + drawH - ((Math.min(Math.max(val, s.min), s.max) - s.min) / range) * drawH;
      return { x, y };
    });

    // Draw smooth Bezier curve
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, cpx, (prev.y + curr.y) / 2);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();

    // Fill area under curve (subtle gradient)
    ctx.lineTo(last.x, padding.top + lineMargin + drawH);
    ctx.lineTo(points[0].x, padding.top + lineMargin + drawH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + lineMargin + drawH);
    grad.addColorStop(0, s.color + '20');
    grad.addColorStop(1, s.color + '05');
    ctx.fillStyle = grad;
    ctx.fill();
  });

  // Cache points for hover tooltip (HISTORICAL mode)
  const tfFormatters = {
    '24h': (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
    '7d':  (d) => d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
  };
  const fmt = tfFormatters[timeframe] || tfFormatters['24h'];
  const hoverPoints = parsed.map(p => ({
    x: padding.left + ((p.ts.getTime() - tsMin) / tsRange) * chartW,
    temp: p.temp,
    hum: p.hum,
    gas: p.gas,
    label: fmt(p.ts)
  }));
  chartPointsCache[acesId] = { points: hoverPoints, padding, chartW, chartH: H, lineMargin, drawH, series: [{min:0,max:60},{min:0,max:100},{min:0,max:1000}] };
  setupTrendHover(acesId);
}

function drawTimeAxis(ctx, parsed, timeframe, padding, W, H, chartW, isDark) {
  const tsMin = parsed[0].ts.getTime();
  const tsMax = parsed[parsed.length - 1].ts.getTime();
  const tsRange = tsMax - tsMin || 1;

  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  ctx.font = `${Math.max(9, Math.min(11, W * 0.025))}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Determine label count and format based on timeframe
  let labelCount, formatFn;
  switch (timeframe) {
    case '24h':
      labelCount = 6;
      formatFn = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      break;
    case '7d':
      labelCount = 7;
      formatFn = (d) => d.toLocaleDateString([], { weekday: 'short' });
      break;
    default:
      labelCount = 5;
      formatFn = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const labelY = H - padding.bottom + 8;

  // Draw tick marks and labels
  for (let i = 0; i < labelCount; i++) {
    const frac = i / (labelCount - 1);
    const x = padding.left + frac * chartW;
    const ts = new Date(tsMin + frac * tsRange);

    // Tick mark
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, H - padding.bottom);
    ctx.lineTo(x, H - padding.bottom + 4);
    ctx.stroke();

    // Label
    ctx.fillText(formatFn(ts), x, labelY);
  }
}

// Initialize trend data from current device values
function initTrendCharts() {
  if (typeof devices === 'undefined') return;
  devices.forEach(device => {
    // Only seed trend data if device is online and has real values
    if (!trendData[device.acesId] && device.online) {
      const t = device.temperature ?? 0;
      const h = device.humidity ?? 0;
      const g = device.gas ?? 0;
      for (let i = 0; i < 5; i++) {
        pushTrendData(device.acesId, t, h, g);
      }
    }
    drawTrendChart(device.acesId);
  });

  // Restore active timeframe after re-render (tab switch, sync, etc.)
  restoreTrendTimeframes();
}

function restoreTrendTimeframes() {
  if (typeof devices === 'undefined') return;
  devices.forEach(device => {
    const tf = activeTrendTimeframe[device.acesId];
    if (!tf || tf === 'live') return;

    const container = document.querySelector(`.device-inline-detail[data-aces-id="${device.acesId}"]`);
    if (!container) return;
    const btnGroup = container.querySelector('.trend-timeframe-btns');
    if (!btnGroup) return;

    // Update active button state
    btnGroup.querySelectorAll('.trend-tf-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tf === tf);
    });

    // Re-fetch/draw the historical chart
    fetchAndDrawHistorical(device.acesId, tf);
  });
}

// ---------------- MENU LOGIC ----------------
function toggleMenu(e, deviceName) {
  e.stopPropagation();
  document.querySelectorAll(".device-menu").forEach(m => {
    if (m.id !== `menu-${deviceName}`) m.style.display = "none";
  });
  const menu = document.getElementById(`menu-${deviceName}`);
  if (menu) menu.style.display = menu.style.display === "block" ? "none" : "block";
}
// --- NAVIGATION LOGIC ---
window.openDeviceDetail = function(name) {
    // This takes the device name and adds it to the URL
    // Example: device.html?name=Lab%201
    window.location.href = `device.html?name=${encodeURIComponent(name)}`;
};

window.addEventListener("click", () => {
  document.querySelectorAll(".device-menu").forEach(m => m.style.display = "none");
});

// AUTO-DISCOVERY FUNCTION - Uses backend API instead of direct ESP32 scanning
async function discoverACESDevices(onDeviceFound) {
  const discoveredDevices = [];
  const discoveredSet = new Set();
  const usedAcesIds = new Set(devices.map(d => d.acesId));

  try {
    console.log('📡 [DISCOVERY] Fetching active devices from backend...');
    
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.GET_ACTIVE_DEVICES), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }
    
    const data = await response.json();
    console.log('📡 [DISCOVERY] Backend response:', data);
    
    if (data.success && Array.isArray(data.devices)) {
      for (const backendDevice of data.devices) {
        // Skip devices already added to the frontend
        if (usedAcesIds.has(backendDevice.deviceId)) {
          console.log(`⏭️ [DISCOVERY] Skipping ${backendDevice.deviceId} - already added`);
          continue;
        }
        
        // Skip if already discovered in this session
        if (discoveredSet.has(backendDevice.deviceId)) {
          continue;
        }
        
        // Map backend format to frontend discovery format
        const device = {
          acesId: backendDevice.deviceId,
          ip: backendDevice.deviceId, // No direct IP needed anymore
          url: `backend://${backendDevice.deviceId}`, // Placeholder - not used for direct polling
          temperature: backendDevice.temperature != null ? parseFloat(backendDevice.temperature).toFixed(1) : '--',
          humidity: backendDevice.humidity != null ? parseFloat(backendDevice.humidity).toFixed(1) : '--',
          gas: backendDevice.gas != null ? parseFloat(backendDevice.gas).toFixed(1) : '--',
          labName: backendDevice.labName || null
        };
        
        discoveredSet.add(device.acesId);
        discoveredDevices.push(device);
        
        console.log(`✅ [DISCOVERY] Found: ${device.acesId} (${device.labName || 'No name set'})`);
        
        // Callback for real-time UI update
        if (onDeviceFound) {
          onDeviceFound(device);
        }
      }
      
      console.log(`📡 [DISCOVERY] Complete. Found ${discoveredDevices.length} new device(s)`);
    } else {
      console.log('📡 [DISCOVERY] No active devices reported by backend');
    }
  } catch (error) {
    console.error('❌ [DISCOVERY] Failed to fetch from backend:', error.message);
    throw error; // Re-throw so caller can show error to user
  }
  
  return discoveredDevices;
}

// ---------------- DEVICE MODAL LOGIC (ADD/EDIT) ----------------
const deviceModal = document.getElementById("deviceModal");
const deviceModalTitle = document.getElementById("deviceModalTitle");
const deviceNameInput = document.getElementById("deviceNameInput");
const confirmDeviceBtn = document.getElementById("confirmDeviceBtn");
const cancelDeviceBtn = document.getElementById("cancelDeviceBtn");
const hardwareIndicator = document.getElementById("hardwareIndicator");
const hardwareStatusText = document.getElementById("hardwareStatusText");

function addDevicePrompt() {
  if (devices.length >= 3) { showToast("All hardware slots are full", "warning"); return; }
  
  // SVG icons for discovery display
  const tempIcon = `<svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-120q-83 0-141.5-58.5T280-320q0-48 21-89.5t59-70.5v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q38 29 59 70.5t21 89.5q0 83-58.5 141.5T480-120Zm0-80q50 0 85-35t35-85q0-29-12.5-54T552-416l-32-24v-280q0-17-11.5-28.5T480-760q-17 0-28.5 11.5T440-720v280l-32 24q-23 17-35.5 42T360-320q0 50 35 85t85 35Zm0-120Z"/></svg>`;
  const humIcon = `<svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" fill="currentColor"><path d="M460-160q-50 0-85-35t-35-85h80q0 17 11.5 28.5T460-240q17 0 28.5-11.5T500-280q0-17-11.5-28.5T460-320H80v-80h380q50 0 85 35t35 85q0 50-35 85t-85 35ZM80-560v-80h540q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43h-80q0-59 40.5-99.5T620-840q59 0 99.5 40.5T760-700q0 59-40.5 99.5T620-560H80Zm660 320v-80q26 0 43-17t17-43q0-26-17-43t-43-17H80v-80h660q59 0 99.5 40.5T880-380q0 59-40.5 99.5T740-240Z"/></svg>`;
  const gasIcon = `<svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" fill="currentColor"><path d="M320-80q-66 0-113-47t-47-113v-400q0-66 47-113t113-47h40v-80h80v80h80v-80h80v80h40q66 0 113 47t47 113v400q0 66-47 113T640-80H320Zm0-80h320q33 0 56.5-23.5T720-240v-400q0-33-23.5-56.5T640-720H320q-33 0-56.5 23.5T240-640v400q0 33 23.5 56.5T320-160Zm0-400h320v-80H320v80Zm160 320q42 0 71-28.5t29-69.5q0-33-19-56.5T480-490q-63 72-81.5 96T380-338q0 41 29 69.5t71 28.5ZM240-720v560-560Z"/></svg>`;
  
  currentEditingName = null;
  deviceModalTitle.textContent = "Scanning Devices...";
  confirmDeviceBtn.textContent = "Connect"; 
  confirmDeviceBtn.style.display = "none";
  hardwareIndicator.style.display = "none";
  const discoveryContainer = document.getElementById("discoveryContainer");
  if (discoveryContainer) {
    discoveryContainer.innerHTML = '<div class="discovery-list"></div><div class="discovery-scanning" id="discoveryScanIndicator"><span class="spinner-icon">📡</span> Scanning...</div>';
    discoveryContainer.style.display = "block";
  }
  deviceNameInput.style.display = "none";
  deviceNameInput.parentElement.style.display = "none";
  deviceModal.style.display = "flex";
  const discoveredDevices = new Map();
  const handleDeviceFound = (device) => {
    // Check by acesId since we no longer use direct ESP32 URLs
    if (devices.some(dev => dev.acesId === device.acesId) || discoveredDevices.has(device.acesId)) return;
    discoveredDevices.set(device.acesId, device);
    const discoveryList = discoveryContainer?.querySelector('.discovery-list');
    if (discoveryList) {
      const index = discoveredDevices.size - 1;
      const card = document.createElement('div');
      card.className = 'discovery-card';
      card.innerHTML = `
        <div class="discovery-header">
          <strong>${device.acesId}</strong>
          <span class="discovery-status-badge"><span class="discovery-status-dot"></span> Online</span>
        </div>
        <div class="discovery-sensors">
          <span>${tempIcon} ${device.temperature}<small>°C</small></span>
          <span>${humIcon} ${device.humidity}<small>%</small></span>
          <span>${gasIcon} ${device.gas}<small>ppm</small></span>
        </div>`;
      card.onclick = () => selectDiscoveredDevice(index, Array.from(discoveredDevices.values()));
      discoveryList.appendChild(card);
    }
  };
  (async () => {
    try {
      await discoverACESDevices(handleDeviceFound);
      const scanIndicator = discoveryContainer?.querySelector('#discoveryScanIndicator');
      if (scanIndicator) scanIndicator.remove();
      const available = Array.from(discoveredDevices.values());
      if (available.length === 0) {
        if (discoveryContainer) discoveryContainer.innerHTML = '<div class="discovery-empty"><p>No devices found</p><small>Make sure devices are powered on and connected</small></div>';
        confirmDeviceBtn.disabled = true;
        return;
      }
      window.availableDevicesForDiscovery = available;
      confirmDeviceBtn.disabled = false;
    } catch (error) {
      console.error('Discovery failed:', error);
      if (discoveryContainer) discoveryContainer.innerHTML = `<div class="discovery-empty"><p>Backend unreachable</p><small>Make sure the server is running and ESP32 devices are posting data</small></div>`;
    }
  })();
}

function selectDiscoveredDevice(index, available) {
  const device = available[index];
  if (!device) return;
  const discoveryContainer = document.getElementById("discoveryContainer");
  if (discoveryContainer) discoveryContainer.style.display = "none";
  deviceModalTitle.textContent = "New Connection";
  hardwareIndicator.style.display = "flex";
  hardwareStatusText.innerHTML = `Linked to: <strong>${device.acesId}</strong>`;
  deviceNameInput.style.display = "block";
  deviceNameInput.parentElement.style.display = "block";
  // Lab name is always user-defined - never pre-fill from backend
  deviceNameInput.value = "";
  deviceNameInput.placeholder = "Enter Lab Name";
  deviceNameInput.focus();
  confirmDeviceBtn.style.display = "block";
  confirmDeviceBtn.dataset.pendingUrl = device.url;
  confirmDeviceBtn.dataset.pendingAcesId = device.acesId;
  confirmDeviceBtn.disabled = false;
}

window.editDevice = function(name) {
  currentEditingName = name;
  deviceModalTitle.textContent = "Rename Lab";
  confirmDeviceBtn.textContent = "Save Changes";
  confirmDeviceBtn.style.display = "block";
  confirmDeviceBtn.disabled = false;
  hardwareIndicator.style.display = "none";
  const discoveryContainer = document.getElementById("discoveryContainer");
  if (discoveryContainer) discoveryContainer.style.display = "none";
  deviceNameInput.style.display = "block";
  deviceNameInput.parentElement.style.display = "block";
  deviceNameInput.value = name;
  deviceModal.style.display = "flex";
};

if (confirmDeviceBtn) {
  confirmDeviceBtn.onclick = () => {
    const newName = deviceNameInput.value.trim();
    if (!newName) return showToast("Please enter a name", "error");

    if (currentEditingName) {
      const device = devices.find(d => d.name === currentEditingName);
      if (device) {
        const oldName = device.name;
        
        // Check if new name already exists (excluding current device)
        const nameExists = devices.some(d => d.name.toLowerCase() === newName.toLowerCase() && d.name !== oldName);
        if (nameExists) {
          return showToast(`Lab name "${newName}" already exists`, "error");
        }
        
        device.name = newName;
        saveDevices();
        
        // Notify other users about rename
        if (typeof emitDeviceRenamed === 'function') {
          emitDeviceRenamed(oldName, newName);
        }
      }
    } else {
      // Check if name already exists when adding new device
      const nameExists = devices.some(d => d.name.toLowerCase() === newName.toLowerCase());
      if (nameExists) {
        return showToast(`Lab name "${newName}" already exists`, "error");
      }
      
      const url = confirmDeviceBtn.dataset.pendingUrl;
      const acesId = confirmDeviceBtn.dataset.pendingAcesId;
      // Use addNewDevice to ensure WebSocket sync
      addNewDevice(acesId, newName, url);
    }

    deviceModal.style.display = "none";
    renderDevices();
  };
}

if (cancelDeviceBtn) {
  cancelDeviceBtn.onclick = () => { 
    deviceModal.style.display = "none";
    // Reset modal state
    confirmDeviceBtn.style.display = "block";
    confirmDeviceBtn.disabled = false;
    deviceNameInput.style.display = "block";
    deviceNameInput.parentElement.style.display = "block";
    const discoveryContainer = document.getElementById("discoveryContainer");
    if (discoveryContainer) discoveryContainer.style.display = "none";
  };
}

// ---------------- REMOVE DEVICE LOGIC ----------------
const deleteModal = document.getElementById("deleteModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

window.removeDevice = function(name) {
  deviceToDelete = name;
  document.getElementById("deleteWarningText").textContent = `Are you sure you want to remove "${name}"?`;
  deleteModal.style.display = "flex";
};

if (confirmDeleteBtn) {
  confirmDeleteBtn.onclick = () => {
    if (deviceToDelete) {
      // Find device to get its ID for clearing localStorage
      const device = devices.find(d => d.name === deviceToDelete);
      if (device) {
        // Determine ACES ID from espUrl (safe check)
        let acesId = 'ACES-1';
        if (device.espUrl && device.espUrl.includes('192.168.100.70')) acesId = 'ACES-1';
        else if (device.espUrl && device.espUrl.includes('192.168.100.71')) acesId = 'ACES-2';
        else if (device.espUrl && device.espUrl.includes('192.168.100.72')) acesId = 'ACES-3';
        
        // Clear device-specific logs and BFP number from localStorage
        localStorage.removeItem(`deviceActivityLogs_${acesId}`);
        localStorage.removeItem(`bfpContactNumber_${acesId}`);
      }
      
      devices = devices.filter(d => d.name !== deviceToDelete);
      saveDevices();
      
      // Notify other users via WebSocket
      if (typeof emitDeviceRemoved === 'function') {
        emitDeviceRemoved(deviceToDelete);
      }
      
      renderDevices();
    }
    deleteModal.style.display = "none";
  };
}

if (cancelDeleteBtn) {
  cancelDeleteBtn.onclick = () => { deleteModal.style.display = "none"; };
}

// Sensor data & device status now received via WebSocket events
// No polling loop needed - updates happen in real-time

function toggleDrawer() {
  const drawer = document.getElementById('sideDrawer');
  const overlay = document.getElementById('drawerOverlay');
  if (drawer && overlay) {
    drawer.classList.toggle('open');
    overlay.classList.toggle('active');
  }
}

// ---------------- THEME ----------------
// Apply saved theme from LocalStorage
function applySavedTheme() {
    const savedTheme = localStorage.getItem("acesTheme");
    const isDark = savedTheme === "dark";
    
    if (isDark) {
        document.documentElement.classList.add("dark-mode");
        document.body.classList.add("dark-mode");
    } else {
        document.documentElement.classList.remove("dark-mode");
        document.body.classList.remove("dark-mode");
    }
}

applySavedTheme();

// Backend handles all event logging automatically (24/7)
// No frontend-initiated log posting needed

// ---------------- START ----------------
// Deferred to DOMContentLoaded so ICONS from device.js is available for desktop inline detail
document.addEventListener('DOMContentLoaded', () => {
  renderDevices();
});

// Re-render on breakpoint change (mobile ↔ desktop)
let _lastDesktopState = window.innerWidth >= 768;
window.addEventListener('resize', () => {
  const isDesktop = window.innerWidth >= 768;
  if (isDesktop !== _lastDesktopState) {
    _lastDesktopState = isDesktop;
    renderDevices();
  }
});

// --- Sidebar collapsed tooltip (JS-driven) ---
(function initSideNavTooltips() {
  let tip = null;
  function show(el) {
    const sideNav = document.getElementById('sideNav');
    if (!sideNav || !sideNav.classList.contains('collapsed')) return;
    const text = el.getAttribute('data-tooltip');
    if (!text) return;
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'side-nav-tooltip';
      document.body.appendChild(tip);
    }
    tip.textContent = text;
    const rect = el.getBoundingClientRect();
    tip.style.left = (rect.right + 10) + 'px';
    tip.style.top = (rect.top + rect.height / 2) + 'px';
    tip.style.transform = 'translateY(-50%)';
    tip.classList.add('visible');
  }
  function hide() {
    if (tip) tip.classList.remove('visible');
  }
  document.addEventListener('mouseover', function(e) {
    const el = e.target.closest('[data-tooltip]');
    if (el && el.closest('.side-nav')) show(el);
    else hide();
  });
  document.addEventListener('mouseout', function(e) {
    const el = e.target.closest('[data-tooltip]');
    if (el && el.closest('.side-nav')) hide();
  });
})();

// Sensor data arrives via WebSocket 'sensor-data' event from backend
// No direct ESP32 polling needed - backend is the single poller