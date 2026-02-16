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
            // Keep previous values so they don't reset on refresh
            dev.temperature = d.temperature;
            dev.humidity = d.humidity;
            dev.gas = d.gas;
            dev.fire = d.fire;
            dev.online = d.online || false;
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
let alertNumbers = JSON.parse(localStorage.getItem("alertNumbers")) || [];
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

  const isDesktop = window.innerWidth >= 1024 && typeof ICONS !== 'undefined';

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
        <div class="inline-detail-header">
          <div class="device-header-info">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="device-name-text">${device.name}</span>
              <div data-role="detStatus" class="device-status ${statusClass}">${device.online ? "ONLINE" : "OFFLINE"}</div>
            </div>
            <span class="device-id-badge">${device.acesId}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <button class="device-menu-btn" onclick="toggleMenu(event, '${device.name}')">⋮</button>
            <div class="device-menu" id="menu-${device.name}" style="display: none;">
              <button onclick="editDevice('${device.name}')">Rename</button>
              <button onclick="removeDevice('${device.name}')">Remove</button>
            </div>
          </div>
        </div>

        <div data-role="statusBanner" class="status-banner banner-safe">
          <div data-role="bannerIcon"></div>
          <h2 data-role="bannerText">SYSTEM SAFE</h2>
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

        <div class="modal-button-row" style="display: flex; gap: 25px; margin-bottom: 25px; justify-content: center; width: 100%;">
          <button onclick="triggerInlineValidation('alarm', '${device.acesId}')" data-role="manualAlarmBtn" class="modal-btn tactile-key ${alarmOn ? 'is-active' : ''}">
            <span data-role="alarmBtnIcon" class="power-icon">${alarmOn ? ICONS.ALARM_ON : ICONS.ALARM_OFF}</span>
          </button>
          <button onclick="triggerInlineValidation('bfp', '${device.acesId}')" data-role="bfpBtn" class="modal-btn delete-style tactile-key">
            <span class="bfp-icon-wrap">${ICONS.BFP}</span>
          </button>
        </div>

        <div class="sensor-box activity-log-container" style="height: 220px; padding: 0; display: flex; flex-direction: column; margin-top: 10px;">
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

// ---------------- ALERT NUMBERS LOGIC ----------------
const numModal = document.getElementById("numbersModal");
const numbersList = document.getElementById("numbersList");
const addNumberBtn = document.getElementById("addNumberBtn");
const newNumberInput = document.getElementById("newNumber");
const saveNumbersBtn = document.getElementById("saveNumbersBtn");

// FIXED: Check for button existence to prevent crash
const manageBtn = document.getElementById("manageNumbersBtn");
if (manageBtn) {
    manageBtn.onclick = () => { 
      numModal.style.display = "flex"; 
      // iOS fix: prevent background scroll when modal is open
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      renderNumbers(); 
    }
}

// Added for Drawer link
window.openAlertSettings = function() {
  const modal = document.getElementById("numbersModal");
  if (modal) {
    modal.style.display = "flex";
    // iOS fix: prevent background scroll when modal is open
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    renderNumbers();
  }
};

if (saveNumbersBtn) {
  saveNumbersBtn.onclick = () => { 
    numModal.style.display = "none"; 
    // Restore body scroll
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.width = "";
  };
}

function renderNumbers() {
  numbersList.innerHTML = "";
  alertNumbers.forEach((num, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="seven-seg-modal">${num}</span>
      <button class="delete-btn-modal" onclick="removeNumber(${idx})">Delete</button>
    `;
    numbersList.appendChild(li);
  });
}

window.removeNumber = function(idx) {
  alertNumbers.splice(idx, 1);
  localStorage.setItem("alertNumbers", JSON.stringify(alertNumbers));
  renderNumbers();
  
  // Sync to other devices
  if (typeof emitAlertContactsChanged === 'function') {
    emitAlertContactsChanged(alertNumbers);
  }
};

if (addNumberBtn) {
  addNumberBtn.onclick = () => {
    let val = newNumberInput.value.replace(/\D/g, '');
    if (val.length !== 11) return showToast("Please enter a valid 11-digit phone number", "error");
    if (alertNumbers.includes(val)) return showToast("Number already exists", "warning");
    if (alertNumbers.length >= 5) return showToast("Max 5 numbers allowed", "warning");

    alertNumbers.push(val);
    localStorage.setItem("alertNumbers", JSON.stringify(alertNumbers));
    newNumberInput.value = "";
    renderNumbers();
    showToast("Number added successfully", "success");
    
    // Sync to other devices
    if (typeof emitAlertContactsChanged === 'function') {
      emitAlertContactsChanged(alertNumbers);
    }
  };
}

if (newNumberInput) {
  newNumberInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 11);
  });
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
const darkModeBtn = document.getElementById("darkModeToggle");
const themeIcon = document.getElementById("themeIcon");
const sunSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M440-760v-160h80v160h-80Zm266 110-55-55 112-115 56 57-113 113Zm54 210v-80h160v80H760ZM440-40v-160h80v160h-80ZM254-652 140-763l57-56 113 113-56 54Zm508 512L651-255l54-54 114 110-57 59ZM40-440v-80h160v80H40Zm157 300-56-57 112-112 29 27 29 28-114 114Zm283-100q-100 0-170-70t-70-170q0-100 70-170t170-70q100 0 170 70t70 170q0 100-70 170t-170 70Z"/></svg>`;
const moonSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M483-80q-84 0-157.5-32t-128-86.5Q143-253 111-326.5T79-484q0-146 93-257.5T409-880q-18 99 11 193.5T520-521q71 71 165.5 100T879-410q-26 144-138 237T483-80Z"/></svg>`;

// 1. Initial Load Check: Apply saved theme from LocalStorage
function applySavedTheme() {
    const savedTheme = localStorage.getItem("acesTheme");
    const isDark = savedTheme === "dark";
    
    if (isDark) {
        document.documentElement.classList.add("dark-mode");
    } else {
        document.documentElement.classList.remove("dark-mode");
    }
    
    // Update the icon to match the theme
    if (themeIcon) {
        themeIcon.innerHTML = isDark ? moonSVG : sunSVG;
    }
}

// 2. Click Logic: Toggle and Save to LocalStorage
if (darkModeBtn) {
    darkModeBtn.onclick = () => {
        const isDark = document.documentElement.classList.toggle("dark-mode");
        
        // Save the current state
        localStorage.setItem("acesTheme", isDark ? "dark" : "light");
        
        // Update icon
        if (themeIcon) {
            themeIcon.innerHTML = isDark ? moonSVG : sunSVG;
        }
    };
}

// 3. Trigger initial check
applySavedTheme();

// Backend handles all event logging automatically (24/7)
// No frontend-initiated log posting needed

// ---------------- START ----------------
// Deferred to DOMContentLoaded so ICONS from device.js is available for desktop inline detail
document.addEventListener('DOMContentLoaded', () => {
  renderDevices();
});

// Re-render on breakpoint change (mobile ↔ desktop)
let _lastDesktopState = window.innerWidth >= 1024;
window.addEventListener('resize', () => {
  const isDesktop = window.innerWidth >= 1024;
  if (isDesktop !== _lastDesktopState) {
    _lastDesktopState = isDesktop;
    renderDevices();
  }
});

// Sensor data arrives via WebSocket 'sensor-data' event from backend
// No direct ESP32 polling needed - backend is the single poller