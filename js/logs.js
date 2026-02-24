// Apply saved theme on page load
(function applySavedTheme() {
  const savedTheme = localStorage.getItem("acesTheme");
  const isDark = savedTheme === "dark";
  
  if (isDark) {
    document.documentElement.classList.add("dark-mode");
  }
  
  // Update the header icon
  const themeIcon = document.getElementById("themeIcon");
  const sunSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M440-760v-160h80v160h-80Zm266 110-55-55 112-115 56 57-113 113Zm54 210v-80h160v80H760ZM440-40v-160h80v160h-80ZM254-652 140-763l57-56 113 113-56 54Zm508 512L651-255l54-54 114 110-57 59ZM40-440v-80h160v80H40Zm157 300-56-57 112-112 29 27 29 28-114 114Zm283-100q-100 0-170-70t-70-170q0-100 70-170t170-70q100 0 170 70t70 170q0 100-70 170t-170 70Z"/></svg>`;
  const moonSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M483-80q-84 0-157.5-32t-128-86.5Q143-253 111-326.5T79-484q0-146 93-257.5T409-880q-18 99 11 193.5T520-521q71 71 165.5 100T879-410q-26 144-138 237T483-80Z"/></svg>`;
  
  if (themeIcon) {
    themeIcon.innerHTML = isDark ? moonSVG : sunSVG;
  }
  // Update bottom nav icon and label
  const bottomNavIcon = document.getElementById("bottomNavThemeIcon");
  if (bottomNavIcon) {
    bottomNavIcon.innerHTML = isDark ? moonSVG : sunSVG;
  }
  const bottomNavLabel = document.getElementById("bottomNavThemeLabel");
  if (bottomNavLabel) {
    bottomNavLabel.textContent = isDark ? "Dark" : "Light";
  }
  // Update side nav theme icon and label
  const sideNavIcon = document.getElementById("sideNavThemeIcon");
  if (sideNavIcon) {
    sideNavIcon.innerHTML = isDark ? moonSVG : sunSVG;
  }
  const sideNavLabel = document.getElementById("sideNavThemeLabel");
  if (sideNavLabel) {
    sideNavLabel.textContent = isDark ? "Dark Mode" : "Light Mode";
  }
})();

// Dark mode toggle - shared function
const sunSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M440-760v-160h80v160h-80Zm266 110-55-55 112-115 56 57-113 113Zm54 210v-80h160v80H760ZM440-40v-160h80v160h-80ZM254-652 140-763l57-56 113 113-56 54Zm508 512L651-255l54-54 114 110-57 59ZM40-440v-80h160v80H40Zm157 300-56-57 112-112 29 27 29 28-114 114Zm283-100q-100 0-170-70t-70-170q0-100 70-170t170-70q100 0 170 70t70 170q0 100-70 170t-170 70Z"/></svg>`;
const moonSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960"><path d="M483-80q-84 0-157.5-32t-128-86.5Q143-253 111-326.5T79-484q0-146 93-257.5T409-880q-18 99 11 193.5T520-521q71 71 165.5 100T879-410q-26 144-138 237T483-80Z"/></svg>`;

function logsToggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark-mode");
  localStorage.setItem("acesTheme", isDark ? "dark" : "light");
  
  const themeIcon = document.getElementById("themeIcon");
  if (themeIcon) {
    themeIcon.innerHTML = isDark ? moonSVG : sunSVG;
  }
  const bottomNavIcon = document.getElementById("bottomNavThemeIcon");
  if (bottomNavIcon) {
    bottomNavIcon.innerHTML = isDark ? moonSVG : sunSVG;
  }
  const bottomNavLabel = document.getElementById("bottomNavThemeLabel");
  if (bottomNavLabel) {
    bottomNavLabel.textContent = isDark ? "Dark" : "Light";
  }
  // Update side nav theme icon and label
  const sideNavIcon = document.getElementById("sideNavThemeIcon");
  if (sideNavIcon) {
    sideNavIcon.innerHTML = isDark ? moonSVG : sunSVG;
  }
  const sideNavLabel = document.getElementById("sideNavThemeLabel");
  if (sideNavLabel) {
    sideNavLabel.textContent = isDark ? "Dark Mode" : "Light Mode";
  }
}

const darkModeToggle = document.getElementById("darkModeToggle");
if (darkModeToggle) {
  darkModeToggle.addEventListener("click", logsToggleTheme);
}

const bottomNavThemeBtn = document.getElementById("bottomNavThemeToggle");
if (bottomNavThemeBtn) {
  bottomNavThemeBtn.addEventListener("click", logsToggleTheme);
}

const sideNavThemeBtn = document.getElementById("sideNavThemeToggle");
if (sideNavThemeBtn) {
  sideNavThemeBtn.addEventListener("click", logsToggleTheme);
}

// Helper function to determine status based on event type
function getEventStatus(eventType) {
  if (eventType === 'critical' || eventType === 'gas_critical' || eventType === 'bfp_alert') return 'critical';
  if (eventType === 'warning' || eventType === 'gas_warning' || eventType === 'smoke_warning' || eventType === 'manual_alarm_on') return 'warning';
  if (eventType === 'device_offline') return 'warning';
  return 'safe'; // device_online, manual_alarm_off
}

// ==========================================
// SAMPLE DATA (Fallback when API is unavailable)
// TODO: REPLACE WITH FIREBASE or NODE.JS API
// In production, fetch logs from backend API
// Example: const logs = await apiCall('GET', '/api/logs');
// ==========================================
const sampleLogs = [
  {
    id: 1,
    deviceId: "ACES-1",
    labName: "Computer Laboratory 1",
    timestamp: "2024-01-15 14:32:18",
    eventType: "device_online",
    alertMessage: "Device came back online",
    temperature: 28,
    humidity: 65,
    gas: 245
  },
  {
    id: 2,
    deviceId: "ACES-2",
    labName: "Computer Laboratory 2",
    timestamp: "2024-01-15 14:28:45",
    eventType: "warning",
    alertMessage: "High Temperature Warning - 36.0°C detected",
    temperature: 36,
    humidity: 68,
    gas: 350
  },
  {
    id: 3,
    deviceId: "ACES-3",
    labName: "Food Laboratory",
    timestamp: "2024-01-15 14:15:22",
    eventType: "critical",
    alertMessage: "FIRE ALERT DETECTED - Temperature: 45.0°C, Gas: 650 ppm",
    temperature: 45,
    humidity: 72,
    gas: 650
  },
  {
    id: 4,
    deviceId: "ACES-3",
    labName: "Food Laboratory",
    timestamp: "2024-01-15 14:15:30",
    eventType: "bfp_alert",
    alertMessage: "Emergency alert dispatched to Bureau of Fire Protection",
    temperature: 45,
    humidity: 72,
    gas: 650
  },
  {
    id: 5,
    deviceId: "ACES-3",
    labName: "Food Laboratory",
    timestamp: "2024-01-15 14:16:05",
    eventType: "manual_alarm_on",
    alertMessage: "Manual alarm activated - Emergency alert muted",
    temperature: 44,
    humidity: 70,
    gas: 620
  },
  {
    id: 6,
    deviceId: "ACES-1",
    labName: "Computer Laboratory 1",
    timestamp: "2024-01-15 14:05:10",
    eventType: "device_offline",
    alertMessage: "Device went offline - Connection lost",
    temperature: 26,
    humidity: 62,
    gas: 230
  },
  {
    id: 7,
    deviceId: "ACES-3",
    labName: "Food Laboratory",
    timestamp: "2024-01-15 14:20:15",
    eventType: "manual_alarm_off",
    alertMessage: "Manual alarm deactivated - System monitoring resumed",
    temperature: 32,
    humidity: 65,
    gas: 380
  }
].map(log => {
  return {
    ...log,
    status: getEventStatus(log.eventType)
  };
});

// Filter controls
const deviceFilter = document.getElementById("deviceFilter");
const statusFilter = document.getElementById("statusFilter");
const clearLogsBtn = document.getElementById("clearLogsBtn");

// ==========================================
// ==========================================
// API Integration - Fetch logs from backend
// ==========================================
async function loadLogsFromAPI() {
  // If API is disabled in config, use sample data immediately
  if (!API_CONFIG.ENABLE_API) {
    console.log('Using sample logs (API disabled)');
    return sampleLogs.slice();
  }
  
  try {
    const data = await apiCall('GET', API_CONFIG.ENDPOINTS.GET_LOGS);
    if (data && Array.isArray(data.logs)) {
      console.log('Loaded logs from API:', data.logs.length);
      return data.logs;
    } else {
      console.log('No logs returned from API');
      return [];
    }
  } catch (error) {
    console.error('Failed to load logs from API:', error);
    return [];
  }
}

// ==========================================
// TODO: Replace renderLogs() to fetch from API
// Example structure for API integration:
// const logs = await apiCall('GET', '/api/logs');
// const filteredLogs = logs.filter(...);
// renderLogs(filteredLogs);
// ==========================================

// Render logs
function renderLogs(logs) {
  const container = document.querySelector(".timeline-container");
  const timelineLine = container.querySelector(".timeline-line");
  
  // Clear existing entries except timeline line
  container.innerHTML = "";
  container.appendChild(timelineLine);

  if (logs.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML = `
      <svg viewBox="0 -960 960 960" fill="currentColor">
        <path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
      </svg>
      <p>No logs found</p>
    `;
    container.appendChild(emptyState);
    return;
  }

  logs.forEach(log => {
    const entry = document.createElement("div");
    entry.className = "log-entry";
    
    // Get status from event type
    const status = getEventStatus(log.eventType);
    entry.setAttribute("data-status", status);

    // Convert to 12-hour format
    const date = new Date(log.timestamp);
    const formattedTime = date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const statusIcons = {
      safe: '<path d="m424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>',
      warning: '<path d="m40-120 440-760 440 760H40Zm138-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm-40-120h80v-200h-80v200Zm40-100Z"/>',
      critical: '<path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>'
    };

    entry.innerHTML = `
      <div class="log-marker"></div>
      <div class="log-card">
        <div class="log-header">
          <div class="log-title">
            <h3 class="log-lab-name">${log.labName}</h3>
            <span class="log-device-id">(${log.deviceId})</span>
          </div>
          <span class="log-timestamp">${formattedTime}</span>
        </div>
        <div class="log-body">
          <div class="log-status status-${status}">
            <svg viewBox="0 -960 960 960" fill="currentColor">
              ${statusIcons[status]}
            </svg>
            ${status.toUpperCase()}
          </div>
          <p class="log-message">${log.alertMessage}</p>
          <div class="log-sensors">
            <div class="log-sensor">
              <span class="sensor-icon">🌡️</span>
              <span class="sensor-reading">${log.temperature != null ? log.temperature : 0}°C</span>
            </div>
            <div class="log-sensor">
              <span class="sensor-icon">💧</span>
              <span class="sensor-reading">${log.humidity != null ? log.humidity : 0}%</span>
            </div>
            <div class="log-sensor">
              <span class="sensor-icon">☁️</span>
              <span class="sensor-reading">${log.gas != null ? log.gas : 0} ppm</span>
            </div>
          </div>
        </div>
      </div>
    `;

    container.appendChild(entry);
  });

  // Update counts
  document.getElementById("visibleLogs").textContent = logs.length;
  document.getElementById("totalLogs").textContent = logs.length;
}

// Filter logs
async function filterLogs() {
  const selectedDevice = deviceFilter.value;
  const selectedStatus = statusFilter.value;

  // Load logs from API or use sample data as fallback
  let filtered = await loadLogsFromAPI();
  
  // Check if logs were cleared - only show logs created AFTER the clear time
  const logsClearedTime = localStorage.getItem('acesLogsClearedTime');
  if (logsClearedTime) {
    const clearedTimestamp = parseInt(logsClearedTime);
    filtered = filtered.filter(log => {
      // Parse log timestamp and compare
      const logTime = new Date(log.timestamp).getTime();
      return logTime > clearedTimestamp;
    });
  }

  // Filter by device - map filter values to device IDs
  if (selectedDevice !== "all") {
    const deviceMap = {
      "aces1": "ACES-1",
      "aces2": "ACES-2",
      "aces3": "ACES-3"
    };
    const targetDeviceId = deviceMap[selectedDevice];
    filtered = filtered.filter(log => log.deviceId === targetDeviceId);
  }

  // Filter by status
  if (selectedStatus !== "all") {
    filtered = filtered.filter(log => getEventStatus(log.eventType) === selectedStatus);
  }

  // Sort by timestamp - NEWEST FIRST (descending order)
  filtered.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;  // Descending order (newest first)
  });

  renderLogs(filtered);
}

// Event listeners
deviceFilter.addEventListener("change", filterLogs);
statusFilter.addEventListener("change", filterLogs);

// Clear Logs Modal Handler - Direct setup
const clearLogsModal = document.getElementById("clearLogsModal");
const clearLogsCancel = document.getElementById("clearLogsCancel");
const clearLogsConfirm = document.getElementById("clearLogsConfirm");

if (clearLogsBtn && clearLogsModal) {
  clearLogsBtn.addEventListener("click", () => {
    clearLogsModal.style.display = "flex";
  });

  clearLogsCancel.addEventListener("click", () => {
    clearLogsModal.style.display = "none";
  });

  clearLogsConfirm.addEventListener("click", async () => {
    clearLogsModal.style.display = "none";
    // ONLY clear the frontend display, NOT the database
    // Database keeps the logs as a backup/archive
    window.systemEventLogs = []; // Clear from memory
    
    // Save cleared timestamp to localStorage - only logs after this time will show
    localStorage.setItem('acesLogsClearedTime', new Date().getTime().toString());
    
    renderLogs([]); // Clear the display
  });

  clearLogsModal.addEventListener("click", (e) => {
    if (e.target === clearLogsModal) {
      clearLogsModal.style.display = "none";
    }
  });
}

// Initial render - Load logs on page load
(async function() {
  // Start with empty logs (logs only appear when actual events happen)
  renderLogs([]);
  
  // Load and filter logs (filterLogs handles the cleared timestamp check)
  await filterLogs();
})();

// ==========================================
// REAL-TIME LOG UPDATES via WebSocket
// Listen for events that create new logs and auto-refresh
// ==========================================
function setupLogsWebSocketListeners() {
  // Wait for socket to be available (loaded from websocket-client.js)
  if (typeof socket === 'undefined' || !socket) {
    setTimeout(setupLogsWebSocketListeners, 500);
    return;
  }

  // When a BFP dispatch happens, refresh logs after a short delay
  // (give the backend time to persist the log)
  socket.on('bfp-dispatch', () => {
    console.log('📋 [LOGS] BFP dispatch detected, refreshing logs...');
    setTimeout(filterLogs, 1000);
  });

  // When sensor-based critical/warning alerts are logged by the backend
  socket.on('critical-alert', () => {
    console.log('📋 [LOGS] Critical alert detected, refreshing logs...');
    setTimeout(filterLogs, 1500);
  });

  socket.on('warning-alert', () => {
    console.log('📋 [LOGS] Warning alert detected, refreshing logs...');
    setTimeout(filterLogs, 1500);
  });

  // When alarm state changes (manual alarm on/off)
  socket.on('alarm-state-changed', () => {
    console.log('📋 [LOGS] Alarm state changed, refreshing logs...');
    setTimeout(filterLogs, 1000);
  });

  // When device status changes (online/offline)
  socket.on('device-status-changed', () => {
    console.log('📋 [LOGS] Device status changed, refreshing logs...');
    setTimeout(filterLogs, 1500);
  });

  console.log('✅ [LOGS] WebSocket listeners for real-time log updates initialized');
}

// Initialize after a short delay to let the socket connect
setTimeout(setupLogsWebSocketListeners, 1000);

// ============================================================
// ALERT CONTACTS LOGIC (for bottom nav Alerts on logs page)
// ============================================================
let alertNumbers = JSON.parse(localStorage.getItem("alertNumbers")) || [];

function setBottomNavActive(selector) {
  document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));
  if (selector) {
    const target = document.querySelector(selector);
    if (target) target.classList.add('active');
  }
}

function restoreBottomNavActive() {
  document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));
  const path = window.location.pathname;
  document.querySelectorAll('.bottom-nav-item[href]').forEach(item => {
    const href = item.getAttribute('href');
    if (path.endsWith('logs.html') && href === 'logs.html') item.classList.add('active');
    else if ((path.endsWith('index.html') || path === '/' || path.endsWith('/')) && href === 'index.html') item.classList.add('active');
    else if (path.endsWith('device.html') && href === 'index.html') item.classList.add('active');
  });
}

window.openAlertSettings = function() {
  const modal = document.getElementById("numbersModal");
  if (modal) {
    modal.style.display = "flex";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    setBottomNavActive('.bottom-nav-item[onclick*="openAlertSettings"]');
    renderNumbers();
  }
};

const saveNumbersBtn = document.getElementById("saveNumbersBtn");
if (saveNumbersBtn) {
  saveNumbersBtn.onclick = () => {
    const modal = document.getElementById("numbersModal");
    if (modal) modal.style.display = "none";
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.width = "";
    restoreBottomNavActive();
  };
}

function renderNumbers() {
  const numbersList = document.getElementById("numbersList");
  if (!numbersList) return;
  numbersList.innerHTML = "";
  alertNumbers.forEach((num, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="number-display">${num}</span>
      <button class="delete-btn-modal" onclick="removeNumber(${idx})">Delete</button>
    `;
    numbersList.appendChild(li);
  });
}

window.removeNumber = function(idx) {
  alertNumbers.splice(idx, 1);
  localStorage.setItem("alertNumbers", JSON.stringify(alertNumbers));
  renderNumbers();
  if (typeof emitAlertContactsChanged === 'function') {
    emitAlertContactsChanged(alertNumbers);
  }
};

const addNumberBtn = document.getElementById("addNumberBtn");
const newNumberInput = document.getElementById("newNumber");

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
