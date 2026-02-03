class Device {
  constructor(name, espUrl, simulate = false) {
    this.name = name;
    this.espUrl = espUrl;
    this.simulate = simulate;

    this.temperature = 0;
    this.humidity = 0;
    this.gas = 0;

    this.online = false;
    this.lastResponse = Date.now();
  }

  async fetchData() {
    if (this.simulate) {
      // ✅ ADDED: Randomizers so the screen isn't blank/zeros
      this.temperature = 22 + Math.random() * 5; 
      this.humidity = 40 + Math.random() * 10;
      this.gas = 100 + Math.random() * 20;
      this.online = true;
      return;
    }

    try {
      const res = await fetch(this.espUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("No response");

      const data = await res.json();

      this.temperature = Number(data.temperature) || this.temperature;
      this.humidity = Number(data.humidity) || this.humidity;
      this.gas = Number(data.gas) || this.gas;

      this.lastResponse = Date.now();
      this.online = true;
    } catch (err) {
      const timeout = 6000; // 6 seconds
      this.online = Date.now() - this.lastResponse < timeout;
    }
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
    devices = deviceData.map(d => {
        const dev = new Device(d.name, d.espUrl, d.simulate);
        // Keep previous values so they don't jump to 0 on refresh
        dev.temperature = d.temperature || 0;
        dev.humidity = d.humidity || 0;
        dev.gas = d.gas || 0;
        dev.online = d.online || false;
        return dev;
    });
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
        // Determine ACES ID from espUrl
        let acesId = 'ACES-1';
        if (device.espUrl.includes('192.168.100.70')) acesId = 'ACES-1';
        else if (device.espUrl.includes('192.168.100.71')) acesId = 'ACES-2';
        else if (device.espUrl.includes('192.168.100.72')) acesId = 'ACES-3';
        
        // Clear device-specific logs and BFP number from localStorage
        localStorage.removeItem(`deviceActivityLogs_${acesId}`);
        localStorage.removeItem(`bfpContactNumber_${acesId}`);
    }

    devices = devices.filter(d => d.name !== deviceName);
    saveDevices();
    
    // Notify other users
    if (typeof emitDeviceRemoved === 'function') {
        emitDeviceRemoved(deviceName);
    }
    
    if (typeof renderDevices === "function") renderDevices();
}

function addNewDevice(name, url = "", isSimulated = true) {
    const newDev = new Device(name, url || "http://0.0.0.0/data", isSimulated);
    // Sensor values will be populated by ESP32
    newDev.temperature = null;
    newDev.humidity = null;
    newDev.gas = null;
    newDev.online = false;
    
    devices.push(newDev);
    saveDevices();
    
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
    name: d.name,
    espUrl: d.espUrl,
    simulate: d.simulate,
    temperature: d.temperature,
    humidity: d.humidity,
    gas: d.gas,
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
  boxes.forEach(box => {
    const labelEl = box.querySelector(".sensor-label");
    if (!labelEl) return;

    const label = labelEl.textContent;
    let newVal = 0;
    let isDanger = false;

    // ... inside updateSensorValues(tile, device) ...

let isEmergency = false; // Add this variable at the top of the function

// Your existing logic...
if (label === "Temp") {
  newVal = parseFloat((device.temperature ?? 0).toFixed(1));
  if (newVal >= 42) isEmergency = true; // Trigger 1
} else if (label === "Gas") {
  newVal = parseFloat((device.gas ?? 0).toFixed(1));
  if (newVal >= 600) isEmergency = true; // Trigger 2
}

// AT THE END of the function, add this line:
tile.classList.toggle("emergency-active", isEmergency);

    box.classList.toggle("danger", isDanger);
    const valueEl = box.querySelector(".sensor-value");
    const oldVal = parseFloat(valueEl.dataset.value) || 0;
    
    if (newVal === oldVal) return;

    const diff = newVal - oldVal;
    const step = diff / 5;
    let i = 0;

    if (valueEl.animInterval) clearInterval(valueEl.animInterval);
    valueEl.animInterval = setInterval(() => {
      i++;
      if (i >= 5) {
        clearInterval(valueEl.animInterval);
        valueEl.textContent = newVal.toFixed(1);
        valueEl.dataset.value = newVal;
      } else {
        valueEl.textContent = (oldVal + (step * i)).toFixed(1);
      }
    }, 50);
  });
}

// ---------------- RENDER DEVICE TILES ----------------
function renderDevices() {
  if (!deviceGrid) return; // Guard against missing grid
  deviceGrid.innerHTML = "";

  devices.forEach(device => {
    const tile = document.createElement("div");
    tile.className = "device-tile";
    const statusClass = device.online ? "online" : "offline";

    const tempIcon = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-120q-83 0-141.5-58.5T280-320q0-48 21-89.5t59-70.5v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q38 29 59 70.5t21 89.5q0 83-58.5 141.5T480-120Zm0-80q50 0 85-35t35-85q0-29-12.5-54T552-416l-32-24v-280q0-17-11.5-28.5T480-760q-17 0-28.5 11.5T440-720v280l-32 24q-23 17-35.5 42T360-320q0 50 35 85t85 35Zm0-120Z"/></svg>`;
    const humIcon = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" fill="currentColor"><path d="M460-160q-50 0-85-35t-35-85h80q0 17 11.5 28.5T460-240q17 0 28.5-11.5T500-280q0-17-11.5-28.5T460-320H80v-80h380q50 0 85 35t35 85q0 50-35 85t-85 35ZM80-560v-80h540q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43h-80q0-59 40.5-99.5T620-840q59 0 99.5 40.5T760-700q0 59-40.5 99.5T620-560H80Zm660 320v-80q26 0 43-17t17-43q0-26-17-43t-43-17H80v-80h660q59 0 99.5 40.5T880-380q0 59-40.5 99.5T740-240Z"/></svg>`;
    const gasIcon = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" fill="currentColor"><path d="M320-80q-66 0-113-47t-47-113v-400q0-66 47-113t113-47h40v-80h80v80h80v-80h80v80h40q66 0 113 47t47 113v400q0 66-47 113T640-80H320Zm0-80h320q33 0 56.5-23.5T720-240v-400q0-33-23.5-56.5T640-720H320q-33 0-56.5 23.5T240-640v400q0 33 23.5 56.5T320-160Zm0-400h320v-80H320v80Zm160 320q42 0 71-28.5t29-69.5q0-33-19-56.5T480-490q-63 72-81.5 96T380-338q0 41 29 69.5t71 28.5ZM240-720v560-560Z"/></svg>`;
    
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

// ---------------- DEVICE MODAL LOGIC (ADD/EDIT) ----------------
const deviceModal = document.getElementById("deviceModal");
const deviceModalTitle = document.getElementById("deviceModalTitle");
const deviceNameInput = document.getElementById("deviceNameInput");
const confirmDeviceBtn = document.getElementById("confirmDeviceBtn");
const cancelDeviceBtn = document.getElementById("cancelDeviceBtn");
const hardwareIndicator = document.getElementById("hardwareIndicator");
const hardwareStatusText = document.getElementById("hardwareStatusText");

function addDevicePrompt() {
  if (devices.length >= 3) {
    showToast("All hardware slots are full", "warning");
    return;
  }

  const hardwarePool = [
    { id: "ACES-1", url: "http://192.168.100.70/data" },
    { id: "ACES-2", url: "http://192.168.100.71/data" },
    { id: "ACES-3", url: "http://192.168.100.72/data" }
  ];

  const available = hardwarePool.find(h => !devices.some(d => d.espUrl === h.url));

  if (available) {
    currentEditingName = null;
    deviceModalTitle.textContent = "New Connection";
    confirmDeviceBtn.textContent = "Connect"; 
    hardwareIndicator.style.display = "flex"; 
    hardwareStatusText.innerHTML = `Linked to: <strong>${available.id}</strong>`;
    confirmDeviceBtn.dataset.pendingUrl = available.url;

    deviceNameInput.value = "";
    deviceModal.style.display = "flex";
  } else {
    showToast("No free hardware slots found", "warning");
  }
}

window.editDevice = function(name) {
  currentEditingName = name;
  deviceModalTitle.textContent = "Rename Lab";
  confirmDeviceBtn.textContent = "Save Changes"; 
  hardwareIndicator.style.display = "none"; 
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
      // Use addNewDevice to ensure WebSocket sync
      addNewDevice(newName, url, true);
    }

    deviceModal.style.display = "none";
    renderDevices();
  };
}

if (cancelDeviceBtn) {
  cancelDeviceBtn.onclick = () => { deviceModal.style.display = "none"; };
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
        // Determine ACES ID from espUrl
        let acesId = 'ACES-1';
        if (device.espUrl.includes('192.168.100.70')) acesId = 'ACES-1';
        else if (device.espUrl.includes('192.168.100.71')) acesId = 'ACES-2';
        else if (device.espUrl.includes('192.168.100.72')) acesId = 'ACES-3';
        
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

// ---------------- DATA LOOP ----------------
// Reduced frequency to save battery on mobile
setInterval(() => {
  devices.forEach(device => {
    if (!device.simulate && device.fetchData) {
      device.fetchData();
    } else {
      device.temperature += (Math.random() - 0.5) * 0.5;
      device.humidity += (Math.random() - 0.5) * 0.5;
      device.gas += (Math.random() - 0.5) * 5;
      device.online = true;
    }

    if (device.temperature >= 42) {
      alertNumbers.forEach(num => console.log(`SMS to ${num}: ${device.name} ALERT!`));
    }

    const tiles = document.querySelectorAll(".device-tile");
    tiles.forEach(tile => {
      const nameEl = tile.querySelector(".device-name-left span");
      if (nameEl && nameEl.textContent === device.name) {
        updateSensorValues(tile, device);
        const st = tile.querySelector(".device-status");
        st.textContent = device.online ? "Online" : "Offline";
        st.className = `device-status ${device.online ? 'online' : 'offline'}`;
      }
    });
  });
}, 5000); // Increased from 2000ms to 5000ms (every 5 seconds instead of 2)

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
        themeIcon.innerHTML = isDark ? sunSVG : moonSVG;
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
            themeIcon.innerHTML = isDark ? sunSVG : moonSVG;
        }
    };
}

// 3. Trigger initial check
applySavedTheme();

// ============================================
// BACKEND EVENT LOGGING
// ============================================
// TODO: When events occur, log them to the backend
// Examples of events to log:
// - Device comes online: await logEvent('ACES-1', 'device_online', ...)
// - Device goes offline: await logEvent('ACES-1', 'device_offline', ...)
// - Manual alarm toggled: await logEvent('ACES-1', 'manual_alarm_on', ...)
// - Temperature warning: await logEvent('ACES-1', 'warning', ...)
// - Critical/Fire alert: await logEvent('ACES-1', 'critical', ...)
// See js/config.js for API helper functions

// Helper function to log events to backend
async function logEvent(deviceId, eventType, data = {}) {
    try {
        // Get device name from devices array
        const device = devices.find(d => d.name.toUpperCase().includes(deviceId.toUpperCase()));
        if (!device) return;
        
        // Map device name to device ID (ACES-1, ACES-2, ACES-3)
        let aceId = 'ACES-1';
        if (device.name.includes('Computer Laboratory 2')) aceId = 'ACES-2';
        else if (device.name.includes('Food Laboratory')) aceId = 'ACES-3';
        
        const logPayload = {
            deviceId: aceId,
            labName: device.name,
            eventType: eventType,
            temperature: device.temperature,
            humidity: device.humidity,
            gas: device.gas,
            timestamp: new Date().toLocaleString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }),
            alertMessage: data.message || `${eventType} event logged`
        };
        
        // Send to backend
        if (typeof apiCall === 'function') {
            await apiCall('POST', API_CONFIG.ENDPOINTS.LOG_EVENT, logPayload);
        }
    } catch (error) {
        console.error('Failed to log event:', error);
    }
}

// ---------------- START ----------------
renderDevices();