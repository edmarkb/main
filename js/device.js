/* ============================================================
    DEVICE DETAIL LOGIC (js/device.js)
   ============================================================ */

// THEME: Apply saved dark/light mode from localStorage
(function applySavedTheme() {
    const savedTheme = localStorage.getItem("acesTheme");
    if (savedTheme === "dark") {
        document.documentElement.classList.add("dark-mode");
        document.body.classList.add("dark-mode");
    } else {
        document.documentElement.classList.remove("dark-mode");
        document.body.classList.remove("dark-mode");
    }
})();

// 1. ICON LIBRARY (SVG Paths) - Colors match banner status
const ICONS = {
    SAFE: `<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#22c55e"><path d="m438-338 226-226-57-57-169 169-84-84-57 57 141 141Zm42 258q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-84q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Zm0-316Z"/></svg>`,
    FIRE: `<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#ef4444"><path d="M200-400q0 52 21 98.5t60 81.5q-1-5-1-9v-9q0-32 12-60t35-51l113-111 113 111q23 23 35 51t12 60v9q0 4-1 9 39-35 60-81.5t21-98.5q0-50-18.5-94.5T608-574q-20 13-42 19.5t-45 6.5q-62 0-107.5-41T361-690q-39 33-69 68.5t-50.5 72Q221-513 210.5-475T200-400Zm240 52-57 56q-11 11-17 25t-6 29q0 32 23.5 55t56.5 23q33 0 56.5-23t23.5-55q0-16-6-29.5T497-292l-57-56Zm0-492v132q0 34 23.5 57t57.5 23q18 0 33.5-7.5T582-658l18-22q74 42 117 117t43 163q0 134-93 227T440-80q-134 0-227-93t-93-227q0-129 86.5-245T440-840Zm400 320q-17 0-28.5-11.5T800-560q0-17 11.5-28.5T840-600q17 0 28.5 11.5T880-560q0 17-11.5 28.5T840-520Zm-40-120v-200h80v200h-80Z"/></svg>`,
    HEAT: `<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#ef4444"><path d="M320-120q-83 0-141.5-58.5T120-320q0-48 21-89.5t59-70.5v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q38 29 59 70.5t21 89.5q0 83-58.5 141.5T320-120Zm0-80q50 0 85-35t35-85q0-29-12.5-54T392-416l-32-24v-280q0-17-11.5-28.5T320-760q-17 0-28.5 11.5T280-720v280l-32 24q-23 17-35.5 42T200-320q0 50 35 85t85 35Zm0-120Zm400-200q-17 0-28.5-11.5T680-560q0-17 11.5-28.5T720-600q17 0 28.5 11.5T760-560q0 17-11.5 28.5T720-520Zm-40-120v-200h80v200h-80Z"/></svg>`,
    SMOKE: `<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#ef4444"><path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H260Zm0-80h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41Zm220-240Zm0 160q17 0 28.5-11.5T520-360q0-17-11.5-28.5T480-400q-17 0-28.5 11.5T440-360q0 17 11.5 28.5T480-320Zm-40-140h80v-180h-80v180Z"/></svg>`,
    HEAT_WARN: `<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#f59e0b"><path d="M320-120q-83 0-141.5-58.5T120-320q0-48 21-89.5t59-70.5v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q38 29 59 70.5t21 89.5q0 83-58.5 141.5T320-120Zm0-80q50 0 85-35t35-85q0-29-12.5-54T392-416l-32-24v-280q0-17-11.5-28.5T320-760q-17 0-28.5 11.5T280-720v280l-32 24q-23 17-35.5 42T200-320q0 50 35 85t85 35Zm0-120Zm400-200q-17 0-28.5-11.5T680-560q0-17 11.5-28.5T720-600q17 0 28.5 11.5T760-560q0 17-11.5 28.5T720-520Zm-40-120v-200h80v200h-80Z"/></svg>`,
    SMOKE_WARN: `<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#f59e0b"><path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H260Zm0-80h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41Zm220-240Zm0 160q17 0 28.5-11.5T520-360q0-17-11.5-28.5T480-400q-17 0-28.5 11.5T440-360q0 17 11.5 28.5T480-320Zm-40-140h80v-180h-80v180Z"/></svg>`,
    OFFLINE: `<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#94a3b8"><path d="M791-55 325-521q-2 10-3.5 20t-1.5 21q0 36 14.5 66.5T374-360l-57 57q-35-33-56-78.5T240-480q0-28 6-54t17-49l-59-59q-21 36-32.5 76.5T160-480q0 69 27 129t74 104l-57 57q-57-55-90.5-129.5T80-480q0-62 17-117t49-103l-91-91 57-57 736 736-57 57Zm23-205-58-58q21-35 32.5-76t11.5-86q0-134-93-227t-227-93q-45 0-85.5 11.5T318-756l-58-58q48-32 103.5-49T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 61-17 116.5T814-260ZM697-377l-62-62q2-10 3.5-20t1.5-21q0-66-47-113t-113-47q-11 0-21 1.5t-20 3.5l-62-62q23-11 49-17t54-6q100 0 170 70t70 170q0 28-6 54t-17 49Z"/></svg>`,
    RECONNECT: `<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#22c55e"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-692v-148h80v280H520v-80h168q-32-56-87.5-88T480-760q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`,
    ALARM_OFF: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M160-200h640v-80H160v80Zm160-240h80v-120q0-33 23.5-56.5T480-640v-80q-66 0-113 47t-47 113v120Zm160 160Zm-200-80h400v-200q0-83-58.5-141.5T480-760q-83 0-141.5 58.5T280-560v200ZM160-120q-33 0-56.5-23.5T80-200v-80q0-33 23.5-56.5T160-360h40v-200q0-117 81.5-198.5T480-840q117 0 198.5 81.5T760-560v200h40q33 0 56.5 23.5T880-280v80q0 33-23.5 56.5T800-120H160Zm320-240Z"/></svg>`,
    ALARM_ON: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 512 512" width="24px" fill="currentColor"><path d="M416.001,405.331V266.67c0-88.225-71.776-160.001-160-160.001c-88.225,0-160.002,71.776-160.002,160.001v138.662 c-29.409,0.001-53.335,23.926-53.335,53.333v42.666c0,5.892,4.777,10.669,10.669,10.669h405.332 c5.892,0,10.669-4.776,10.669-10.669v-42.666C469.334,429.257,445.408,405.331,416.001,405.331z M117.337,266.67 c0-76.459,62.206-138.663,138.664-138.663S394.663,190.21,394.663,266.67v138.662H266.67v-97.346 c18.382-4.75,32.001-21.472,32.001-41.317c0-23.528-19.141-42.669-42.669-42.669c-23.528,0-42.668,19.141-42.668,42.669 c0,19.845,13.619,36.568,32,41.317v97.346H117.337V266.67z M256.001,288c-11.762,0-21.331-9.569-21.331-21.33 c0-11.762,9.569-21.332,21.331-21.332c11.762,0,21.332,9.57,21.332,21.332C277.333,278.431,267.763,288,256.001,288z M447.996,490.663H64.002v-31.998c0-17.643,14.356-31.995,32.001-31.995h319.998c17.642,0,31.995,14.354,31.995,31.995V490.663z"/><path d="M69.336,266.67c0-5.892-4.776-10.669-10.669-10.669H10.669C4.776,256.001,0,260.777,0,266.67s4.776,10.669,10.669,10.669 h47.999C64.561,277.339,69.336,272.562,69.336,266.67z"/><path d="M148.096,101.109c1.976,3.423,5.563,5.336,9.25,5.336c1.809,0,3.644-0.461,5.324-1.431 c5.103-2.946,6.851-9.471,3.905-14.573l-23.998-41.569c-2.947-5.103-9.472-6.851-14.573-3.905 c-5.103,2.946-6.851,9.471-3.905,14.573L148.096,101.109z"/><path d="M256.001,80.008c5.892,0,10.669-4.776,10.669-10.669v-58.67C266.67,4.776,261.893,0,256.001,0 c-5.891,0-10.669,4.776-10.669,10.669v58.669C245.332,75.232,250.11,80.008,256.001,80.008z"/><path d="M28.966,147.909l50.805,29.334c1.68,0.97,3.515,1.431,5.325,1.431c3.687,0,7.273-1.914,9.249-5.335 c2.947-5.103,1.198-11.628-3.905-14.573l-50.805-29.334c-5.101-2.945-11.627-1.197-14.573,3.905 C22.114,138.437,23.863,144.963,28.966,147.909z"/><path d="M426.904,178.673c1.809,0,3.644-0.461,5.325-1.431l50.807-29.334c5.102-2.946,6.851-9.471,3.905-14.573 c-2.947-5.103-9.472-6.852-14.573-3.905l-50.807,29.334c-5.103,2.946-6.851,9.471-3.905,14.573 C419.63,176.76,423.216,178.673,426.904,178.673z"/><path d="M349.331,105.014c1.68,0.97,3.514,1.431,5.324,1.431c3.688,0,7.274-1.914,9.25-5.336l23.999-41.568 c2.947-5.103,1.197-11.628-3.905-14.573c-5.102-2.946-11.627-1.198-14.573,3.905L345.426,90.44 C342.481,95.544,344.228,102.069,349.331,105.014z"/><path d="M501.331,256.001h-48.001c-5.892,0-10.669,4.776-10.669,10.669s4.776,10.669,10.669,10.669h48.001 c5.89,0,10.669-4.776,10.669-10.669S507.223,256.001,501.331,256.001z"/></svg>`,
    BFP: `<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M280-120q-50 0-85-35t-35-85h-40q-33 0-56.5-23.5T40-320v-200h440v-160q0-33 23.5-56.5T560-760h80v-40q0-17 11.5-28.5T680-840h40q17 0 28.5 11.5T760-800v40h22q26 0 47 15t29 40l58 172q2 6 3 12.5t1 13.5v267H800q0 50-35 85t-85 35q-50 0-85-35t-35-85H400q0 50-35 85t-85 35Zm0-80q17 0-28.5-11.5T320-240q0-17-11.5-28.5T280-280q-17 0-28.5 11.5T240-240q0 17 11.5 28.5T280-200Zm400 0q17 0-28.5-11.5T720-240q0-17-11.5-28.5T680-280q-17 0-28.5 11.5T640-240q0 17 11.5 28.5T680-200ZM120-440v120h71q17-19 40-29.5t49-10.5q26 0 49 10.5t40 29.5h111v-120H120Zm440 120h31q17-19 40-29.5t49-10.5q26 0 49 10.5t40 29.5h71v-120H560v120Zm0-200h276l-54-160H560v160ZM40-560v-60h40v-80H40v-60h400v60h-40v80h40v60H40Zm100-60h70v-80h-70v80Zm130 0h70v-80h-70v80Zm210 180H120h360Zm80 0h280-280Z"/></svg>`
};

let activeDevice = null;
let manualAlarmActive = false;
let lastAlertState = "SAFE";
let lastOnlineState = false;  // Track online status for logging
let pollIntervalId = null;  // Track polling interval for cleanup
let isPolling = false;  // Prevent concurrent fetch requests
// Store device activity logs for reporting - load from localStorage if available (device-specific)
let deviceActivityLogs = [];
let currentDeviceId = null; // Track which device we're viewing

// Helper function to get localStorage key for current device
function getDeviceLogsKey() {
    return `deviceActivityLogs_${currentDeviceId}`;
}

// Helper function to get localStorage key for BFP number (GLOBAL - shared across all devices)
function getGlobalBFPKey() {
    return 'globalBFPContactNumber';
}

// Helper function to load logs for specific device
function loadActivityLogsForDevice(deviceId) {
    currentDeviceId = deviceId;
    deviceActivityLogs = JSON.parse(localStorage.getItem(getDeviceLogsKey())) || [];
}

// Helper function to save logs to localStorage (device-specific)
function saveActivityLogsToStorage() {
    localStorage.setItem(getDeviceLogsKey(), JSON.stringify(deviceActivityLogs));
}

// Helper function to render saved logs from localStorage
function renderSavedActivityLogs() {
    const logList = document.getElementById('deviceLogList');
    if (!logList) return;
    
    // Build all HTML at once instead of using prepend for each log
    let html = '';
    
    // Reverse to show newest first (prepend order)
    [...deviceActivityLogs].reverse().forEach(log => {
        let dotColor = "#3b82f6";
        if (log.type === 'danger') dotColor = "#ef4444";
        if (log.type === 'warning') dotColor = "#fcc419";
        
        const timestampParts = log.timestamp.split(' ');
        const dateStr = timestampParts[0];
        const timeStr = timestampParts[1] + ' ' + timestampParts[2];
        
        html += `<div>
            <div class="log-time-wrapper">
              <span class="log-date">${dateStr}</span>
              <span class="log-time">${timeStr}</span>
            </div>
            <span class="status-dot" style="background: ${dotColor}; box-shadow: 0 0 10px ${dotColor};"></span>
            <span class="log-msg">${log.message}</span>
        </div>`;
    });
    
    // Set all HTML at once
    logList.innerHTML = html;
}

window.deviceActivityLogs = deviceActivityLogs; // Explicitly expose to window

// Global system event logs - shared with logs.js
if (!window.systemEventLogs) {
    window.systemEventLogs = [];
}

// 2. ACTIVITY LOG LOGIC
function addDeviceLog(message, type = 'info', postToBackend = false, eventType = null) {
    const logList = document.getElementById('deviceLogList');
    if (!logList) return;

    // Create timestamp with date and time separated
    const dateObj = new Date();
    const dateStr = dateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const logEntry = document.createElement('div');
    
    let dotColor = "#3b82f6"; 
    if (type === 'danger') dotColor = "#ef4444";
    if (type === 'warning') dotColor = "#fcc419";

    // Store log for reporting
    deviceActivityLogs.push({
      timestamp: `${dateStr} ${timeStr}`,
      message: message,
      type: type,
      fullTimestamp: new Date().toISOString()
    });
    
    // Save to localStorage
    saveActivityLogsToStorage();

    // Also add to global system event logs with actual sensor data
    const temp = (activeDevice && activeDevice.temperature != null) ? activeDevice.temperature : 0;
    const hum = (activeDevice && activeDevice.humidity != null) ? activeDevice.humidity : 0;
    const gasVal = (activeDevice && activeDevice.gas != null) ? activeDevice.gas : 0;
    addToSystemEventLog(message, eventType || type, activeDevice ? activeDevice.name : 'Unknown Device', temp, hum, gasVal, postToBackend);

    // Update this line inside your addDeviceLog function
logEntry.innerHTML = `
    <div class="log-time-wrapper">
      <span class="log-date">${dateStr}</span>
      <span class="log-time">${timeStr}</span>
    </div>
    <span class="status-dot" style="background: ${dotColor}; box-shadow: 0 0 10px ${dotColor};"></span>
    <span class="log-msg">${message}</span>
`;

    logList.prepend(logEntry);
}

// Helper function to add event to system event log
// postToBackend: true for user-initiated actions (alarm, BFP), false for sensor events (backend logs those)
async function addToSystemEventLog(message, type, deviceName, temperature = null, humidity = null, gas = null, postToBackend = false) {
    const eventTypeMap = {
        'danger': 'critical',
        'warning': 'warning',
        'info': 'device_online'
    };

    const eventType = eventTypeMap[type] || type;
    const deviceId = getDeviceIdFromName(deviceName);
    
    // Use actual sensor data if provided, otherwise use 0 as placeholder
    const systemEvent = {
        id: window.systemEventLogs.length + 1,
        deviceId: deviceId,
        labName: deviceName,
        timestamp: new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
        eventType: eventType,
        alertMessage: message,
        temperature: (temperature != null) ? temperature : 0,
        humidity: (humidity != null) ? humidity : 0,
        gas: (gas != null) ? gas : 0
    };
    
    window.systemEventLogs.unshift(systemEvent);
    
    // POST to backend for user-initiated events (alarm toggle, BFP dispatch, etc.)
    // Sensor-based alerts are handled by the backend automatically — no need to double-post
    if (postToBackend && API_CONFIG.ENABLE_API) {
        try {
            const apiPayload = {
                deviceId: deviceId,
                labName: deviceName,
                eventType: eventType,
                alertMessage: message,
                temperature: (temperature != null) ? temperature : 0,
                humidity: (humidity != null) ? humidity : 0,
                gas: (gas != null) ? gas : 0,
                timestamp: new Date().toLocaleString('en-US')
            };
            
            await apiCall('POST', API_CONFIG.ENDPOINTS.CREATE_LOG, apiPayload);
            console.log('✅ Log posted to backend:', eventType, message);
        } catch (error) {
            console.error('Failed to post log to backend:', error);
        }
    }
}

// Helper function to get device ID from name (now uses acesId directly)
function getDeviceIdFromName(name) {
    // Find the device by name from the global devices array
    if (!name || typeof name !== 'string') return 'ACES-1';
    
    // Access the devices array from main.js (it's global)
    if (typeof devices !== 'undefined' && Array.isArray(devices)) {
        const device = devices.find(d => d.name === name);
        if (device && device.acesId) {
            return device.acesId;
        }
    }
    
    return 'ACES-1'; // Default fallback
}

// 3. EVENT MONITORING

// ============================================================
// EVENT CHECKING & LOGGING (backend handles alert persistence)
// ============================================================

function checkEvents(temp, hum, gas, fire) {
    let currentState = "SAFE";
    const isFire = fire === true || fire === 1 || fire === "true";
    
    // Critical conditions (highest priority)
    if (isFire) currentState = "FIRE";
    else if (temp >= 42 && gas >= 600) currentState = "FIRE";
    else if (temp >= 42) currentState = "HEAT";
    else if (gas >= 600) currentState = "GAS_CRITICAL";
    // Warning conditions (elevated but not critical)
    else if (temp >= 38) currentState = "HEAT_WARNING";
    else if (gas >= 450) currentState = "GAS_WARNING";
    else if (gas >= 300) currentState = "SMOKE_WARNING";

    if (currentState !== lastAlertState) {
        // Backend handles alert logging - frontend only updates local UI
        if (currentState === "FIRE") {
            addDeviceLog("Fire condition detected by flame sensor.", "danger");
        } else if (currentState === "HEAT") {
            addDeviceLog(`Temperature threshold exceeded. Current value: ${temp.toFixed(1)}°C`, "danger");
        } else if (currentState === "GAS_CRITICAL") {
            addDeviceLog(`Critical gas leak detected. Current value: ${gas} ppm`, "danger");
        } else if (currentState === "HEAT_WARNING") {
            addDeviceLog(`High temperature detected. Current value: ${temp.toFixed(1)}°C`, "warning");
        } else if (currentState === "GAS_WARNING") {
            addDeviceLog(`Gas leak warning. Current value: ${gas} ppm`, "warning");
        } else if (currentState === "SMOKE_WARNING") {
            addDeviceLog(`Smoke warning. Current value: ${gas} ppm`, "warning");
        } else if (currentState === "SAFE" && lastAlertState !== "SAFE") {
            addDeviceLog("System returned to normal parameters.", "info");
        }
        
        lastAlertState = currentState;
    }
}

// 4. UI UPDATE LOGIC
function updateDetailUI() {
    if (!activeDevice) return;

    const { temperature: temp, humidity: hum, gas, fire } = activeDevice;
    const banner = document.getElementById('statusBanner');
    const bannerText = document.getElementById('bannerText');
    const bannerIcon = document.getElementById('bannerIcon');
    const tempBox = document.getElementById('tempBox');
    const gasBox = document.getElementById('gasBox');

    banner.classList.remove('banner-safe', 'banner-danger', 'banner-warning', 'banner-gas-warning', 'banner-smoke-warning', 'banner-offline', 'banner-reconnect');
    [tempBox, gasBox].forEach(box => box && box.classList.remove('danger', 'warning'));

    let isEmergency = false;
    let isWarning = false;

    // OFFLINE STATE — takes priority over all sensor states
    if (!activeDevice.online) {
        banner.classList.add('banner-offline');
        bannerText.innerText = "SYSTEM OFFLINE";
        bannerIcon.innerHTML = ICONS.OFFLINE;
    }
    // Check for actual fire sensor OR combined high temp + gas
    else if ((fire === true || fire === 1 || fire === "true")) {
        banner.classList.add('banner-danger');
        bannerText.innerText = "FIRE DETECTED";
        bannerIcon.innerHTML = ICONS.FIRE;
        if(tempBox) tempBox.classList.add('danger');
        if(gasBox) gasBox.classList.add('danger');
        isEmergency = true;
    } else if (temp >= 42 && gas >= 600) {
        banner.classList.add('banner-danger');
        bannerText.innerText = "FIRE DETECTED";
        bannerIcon.innerHTML = ICONS.FIRE;
        if(tempBox) tempBox.classList.add('danger');
        if(gasBox) gasBox.classList.add('danger');
        isEmergency = true;
    } else if (gas >= 600) {
        banner.classList.add('banner-danger');
        bannerText.innerText = "CRITICAL GAS LEAK DETECTED";
        bannerIcon.innerHTML = ICONS.SMOKE;
        if(gasBox) gasBox.classList.add('danger');
        isEmergency = true;
    } else if (temp >= 42) {
        banner.classList.add('banner-danger');
        bannerText.innerText = "HIGH TEMPERATURE ALERT";
        bannerIcon.innerHTML = ICONS.HEAT;
        if(tempBox) tempBox.classList.add('danger');
        isEmergency = true;
    } else if (gas >= 450) {
        banner.classList.add('banner-gas-warning');
        bannerText.innerText = "GAS LEAK WARNING";
        bannerIcon.innerHTML = ICONS.SMOKE_WARN;
        if(gasBox) gasBox.classList.add('warning');
        isWarning = true;
    } else if (temp >= 38) {
        banner.classList.add('banner-warning');
        bannerText.innerText = "ELEVATED TEMPERATURE";
        bannerIcon.innerHTML = ICONS.HEAT_WARN;
        if(tempBox) tempBox.classList.add('warning');
        isWarning = true;
    } else if (gas >= 300) {
        banner.classList.add('banner-smoke-warning');
        bannerText.innerText = "SMOKE WARNING";
        bannerIcon.innerHTML = ICONS.SMOKE_WARN;
        if(gasBox) gasBox.classList.add('warning');
        isWarning = true;
    } else {
        banner.classList.add('banner-safe');
        bannerText.innerText = "SYSTEM SAFE";
        bannerIcon.innerHTML = ICONS.SAFE;
    }


    // Update Values
    document.getElementById('detTemp').textContent = (temp ?? 0).toFixed(1);
    document.getElementById('detHum').textContent = (hum ?? 0).toFixed(1);
    document.getElementById('detGas').textContent = (gas ?? 0).toFixed(0);

    const statusEl = document.getElementById('detStatus');
    if (statusEl) {
        statusEl.textContent = activeDevice.online ? "ONLINE" : "OFFLINE";
        statusEl.className = `device-status ${activeDevice.online ? 'online' : 'offline'}`;
    }
}

// Global variable to store BFP contact for the session - load from localStorage if available (device-specific)
let bfpContactNumber = "";

// Helper function to load BFP number for specific device
function loadGlobalBFPNumber() {
    bfpContactNumber = localStorage.getItem(getGlobalBFPKey()) || "";
}

// Helper function to save BFP number to localStorage (GLOBAL - shared across all devices)
function saveGlobalBFPNumber() {
    localStorage.setItem(getGlobalBFPKey(), bfpContactNumber);
    // Sync BFP number to all other devices via WebSocket
    if (typeof emitGlobalBFPNumberChanged === 'function') {
      emitGlobalBFPNumberChanged(bfpContactNumber);
    }
}

// Function to update BFP number from WebSocket sync
function updateBFPNumberFromSync(newNumber) {
    bfpContactNumber = newNumber;
    localStorage.setItem(getGlobalBFPKey(), newNumber);
    console.log('📱 BFP number synced globally:', newNumber);
} 

// 5. BOOTSTRAP / INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const deviceName = params.get('name');
    activeDevice = devices.find(d => d.name === deviceName);

    if (activeDevice) {
        // Initialize lastOnlineState to prevent false "came back online" on page load
        lastOnlineState = activeDevice.online;
        
        // Load device-specific activity logs from localStorage
        const deviceId = getDeviceIdFromName(activeDevice.name);
        loadActivityLogsForDevice(deviceId);
        // Load global BFP number (shared across all devices)
        loadGlobalBFPNumber();
        
        // DON'T load alarm state from localStorage — wait for server sync.
        // Stale localStorage values caused phantom siren activation on page load.
        // Server's sync-siren-state (via WebSocket) will set the correct state within ~1s.
        manualAlarmActive = false;
        
        document.getElementById('detDeviceName').textContent = activeDevice.name;
        
        // Display the ACES device ID
        const deviceIdBadge = document.getElementById('detDeviceId');
        if (deviceIdBadge) {
            deviceIdBadge.textContent = deviceId;
        }
        
        const alarmIconWrap = document.getElementById('alarmBtnIcon');
        const bfpIconWrap = document.querySelector('.bfp-icon-wrap');

        if(alarmIconWrap) alarmIconWrap.innerHTML = manualAlarmActive ? ICONS.ALARM_ON : ICONS.ALARM_OFF; 
        if(bfpIconWrap) bfpIconWrap.innerHTML = ICONS.BFP;

        const alarmBtn = document.getElementById('manualAlarmBtn');
        const bfpBtn = document.getElementById('bfpBtn');
        const alarmLabel = document.getElementById('alarmBtnLabel');
        
        if(alarmBtn) {
            manualAlarmActive ? alarmBtn.classList.add('is-active') : alarmBtn.classList.remove('is-active');
        }
        if(alarmLabel) {
            alarmLabel.textContent = manualAlarmActive ? 'DEACTIVATE ALARM' : 'ACTIVATE ALARM';
        }
        if(bfpBtn) bfpBtn.classList.remove('is-active'); 

        updateDetailUI();
        
        // Check events immediately with stored data (in case fire sensor was already triggered)
        checkEvents(activeDevice.temperature, activeDevice.humidity, activeDevice.gas, activeDevice.fire);
        
        // Render saved logs from localStorage
        renderSavedActivityLogs();
        
        // Sensor data now arrives via WebSocket 'sensor-data' event
        // Online/offline status arrives via WebSocket 'device-status-changed' event
        // No direct ESP32 polling needed
    }
});

// --- NEW MODAL HELPER FUNCTION ---
function showCustomModal(title, message, onConfirm, onCancel) {
    const modal = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const messageEl = document.getElementById('modalMessage');
    const confirmBtn = document.getElementById('modalConfirm');
    const cancelBtn = document.getElementById('modalCancel');

    titleEl.innerText = title;
    messageEl.innerHTML = message;
    // Reset confirm button to default style
    confirmBtn.className = 'modal-v2-btn danger';
    openModal(modal);

    confirmBtn.onclick = () => {
        onConfirm();
        closeModal(modal);
    };

    cancelBtn.onclick = () => {
        if (onCancel) onCancel();
        closeModal(modal);
    };
}

// 6. WINDOW ACTIONS (The Security Layer)

window.triggerValidation = function(type) {
    const btnId = type === 'alarm' ? 'manualAlarmBtn' : 'bfpBtn';
    const btnElement = document.getElementById(btnId);
    const numInput = document.getElementById('bfpNumberInput');
    
    if(btnElement) btnElement.classList.add('is-active');

    // --- CASE: MANUAL ALARM / SIREN ---
    if (type === 'alarm') {
        if(numInput) numInput.style.display = 'none'; // Hide phone input
        const title = "SYSTEM CONFIRMATION";
        const acesId = getDeviceIdFromName(activeDevice.name);
        const sirenSource = localStorage.getItem(`sirenSource_${acesId}`) || 'manual';
        const isAutoSiren = manualAlarmActive && sirenSource === 'auto';
        
        let message;
        if (manualAlarmActive && isAutoSiren) {
            message = `THE SIREN WAS <span class="text-engage">AUTO-ACTIVATED</span> DUE TO CRITICAL CONDITIONS.<br><br>ARE YOU SURE YOU WANT TO <span class="text-deactivate">OVERRIDE AND DEACTIVATE</span> THE SIREN?`;
        } else if (manualAlarmActive) {
            message = `ARE YOU SURE YOU WANT TO <span class="text-deactivate">DEACTIVATE</span> THE SIREN?`;
        } else {
            message = `ARE YOU SURE YOU WANT TO <span class="text-engage">ENGAGE</span> THE LABORATORY SIREN?`;
        }

        setTimeout(() => {
            showCustomModal(title, message, 
                () => { window.toggleManualAlarm(); }, 
                () => { if (!manualAlarmActive && btnElement) btnElement.classList.remove('is-active'); }
            );
        }, 150);
    } 
    
  // --- CASE: BFP DISPATCH ---
    else if (type === 'bfp') {
      (async () => {
        // Check system configuration (address + BFP number required)
        let configOk = true;
        try {
          const configUrl = getApiUrl(API_CONFIG.ENDPOINTS.GET_SYSTEM_CONFIG);
          const resp = await fetch(configUrl);
          const configData = await resp.json();
          if (!configData.success || !configData.configured) configOk = false;
        } catch (err) {
          console.warn('Could not verify system config:', err);
        }

        // Re-read BFP number from localStorage (may have been updated from settings)
        bfpContactNumber = localStorage.getItem(getGlobalBFPKey()) || "";

        if (!configOk || !bfpContactNumber) {
          if (btnElement) btnElement.classList.remove('is-active');
          if (numInput) numInput.style.display = 'none';
          const missing = [];
          if (!configOk) missing.push('<span class="text-engage">ADDRESS</span>');
          if (!bfpContactNumber) missing.push('<span class="text-engage">BFP CONTACT NUMBER</span>');
          showCustomModal(
            "SETUP REQUIRED",
            `SYSTEM CONFIGURATION IS NOT COMPLETE.<br><br>PLEASE GO TO <span class='text-engage'>SETTINGS</span> AND CONFIGURE YOUR ${missing.join(' AND ')} BEFORE DISPATCHING BFP ALERTS.`,
            () => { window.location.href = 'settings.html'; },
            () => {}
          );
          return;
        }

        // All configured — show dispatch confirmation
        if (numInput) numInput.style.display = 'none';
        const title = "FIRE DISPATCH";
        const message = `CONFIRM ALERT TO BFP AT:<br>
                       <span class="text-engage" style="font-size: 1.2rem; display: block; margin: 10px 0;">${bfpContactNumber}</span>
                       <span onclick="window.changeBfpNumber()" class="text-change">
                          <span style="font-size: 0.9rem; margin-right: 4px;">✎</span> CHANGE NUMBER
                       </span>`;

        showCustomModal(title, message,
          () => {
            // Second confirmation — final warning before dispatch
            setTimeout(() => {
              showCustomModal(
                "⚠️ FINAL CONFIRMATION",
                `THIS ACTION WILL SEND AN <span class="text-engage">EMERGENCY ALERT</span> TO THE BUREAU OF FIRE PROTECTION.<br><br>This cannot be undone. False alarms may have serious consequences.<br><br>ARE YOU SURE YOU WANT TO PROCEED?`,
                () => {
                  window.sendBFPAlert();
                  if (btnElement) btnElement.classList.remove('is-active');
                },
                () => { if (btnElement) btnElement.classList.remove('is-active'); }
              );
              // Style the confirm button as danger
              const confirmBtn = document.getElementById('modalConfirm');
              if (confirmBtn) {
                confirmBtn.classList.remove('confirm');
                confirmBtn.classList.add('danger');
              }
            }, 200);
          },
          () => { if (btnElement) btnElement.classList.remove('is-active'); }
        );
      })();
    }
};

// Global function to change BFP number — redirect to settings
window.changeBfpNumber = function() {
    closeModal(document.getElementById('customModal'), () => {
        window.location.href = 'settings.html';
    });
};

// Actual Logic for Alarm/Siren
window.toggleManualAlarm = function() {
    // Check WebSocket connection before toggling — prevent silent failures
    if (typeof isWebSocketReady === 'undefined' || !isWebSocketReady) {
        showToast("Server not connected. Please wait and try again.", "error");
        return;
    }

    manualAlarmActive = !manualAlarmActive;
    const alarmBtn = document.getElementById('manualAlarmBtn');
    const acesId = getDeviceIdFromName(activeDevice.name);
    
    // Check if we're overriding an auto-triggered siren
    const prevSource = localStorage.getItem(`sirenSource_${acesId}`) || 'manual';
    const isOverride = !manualAlarmActive && prevSource === 'auto';
    
    const alarmIconWrap = document.getElementById('alarmBtnIcon');
    const alarmLabel = document.getElementById('alarmBtnLabel');
    if (manualAlarmActive) {
        addDeviceLog("MANUAL OVERRIDE: Siren activated.", "danger", true);
        if(alarmBtn) alarmBtn.classList.add('is-active');
        if(alarmIconWrap) alarmIconWrap.innerHTML = ICONS.ALARM_ON;
        if(alarmLabel) alarmLabel.textContent = 'DEACTIVATE ALARM';
        localStorage.setItem(`sirenSource_${acesId}`, 'manual');
        // Sync siren state to other devices + backend
        if (typeof emitAlarmStateChanged === 'function') {
          emitAlarmStateChanged(activeDevice.name, true, acesId, 'manual');
        }
    } else {
        const logMsg = isOverride 
          ? "USER OVERRIDE: Auto-siren deactivated by user." 
          : "Siren deactivated. Returning to monitoring mode.";
        addDeviceLog(logMsg, "info", true);
        if(alarmBtn) alarmBtn.classList.remove('is-active');
        if(alarmIconWrap) alarmIconWrap.innerHTML = ICONS.ALARM_OFF;
        if(alarmLabel) alarmLabel.textContent = 'ACTIVATE ALARM';
        localStorage.setItem(`sirenSource_${acesId}`, 'manual');
        // Sync siren state to other devices + backend
        if (typeof emitAlarmStateChanged === 'function') {
          emitAlarmStateChanged(activeDevice.name, false, acesId, 'manual');
        }
    }
};

// Actual Logic for BFP
window.sendBFPAlert = function() {
    // Log to device-specific activity log only (NOT system events, to avoid duplication)
    const logList = document.getElementById('deviceLogList');
    if (logList) {
        const dateObj = new Date();
        const dateStr = dateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
        const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        const logEntry = document.createElement('div');
        
        // Store log for reporting
        deviceActivityLogs.push({
            timestamp: `${dateStr} ${timeStr}`,
            message: `DISPATCH: BFP Alert Sent to ${bfpContactNumber} Successfully.`,
            type: 'danger',
            fullTimestamp: new Date().toISOString()
        });
        
        saveActivityLogsToStorage();
        
        logEntry.innerHTML = `
            <div class="log-time-wrapper">
              <span class="log-date">${dateStr}</span>
              <span class="log-time">${timeStr}</span>
            </div>
            <span class="status-dot" style="background: #ef4444; box-shadow: 0 0 10px #ef4444;"></span>
            <span class="log-msg">DISPATCH: BFP Alert Sent to ${bfpContactNumber} Successfully.</span>
        `;
        
        logList.prepend(logEntry);
    }
    
    // Log to system event logs with actual sensor data (BFP dispatch)
    if (activeDevice) {
        // Get current sensor values from the device, default to 0 if not available
        const temp = (activeDevice.temperature != null) ? activeDevice.temperature : 0;
        const hum = (activeDevice.humidity != null) ? activeDevice.humidity : 0;
        const gasVal = (activeDevice.gas != null) ? activeDevice.gas : 0;
        
        addToSystemEventLog(
            `Emergency alert dispatched to Bureau of Fire Protection at ${bfpContactNumber}`,
            'bfp_alert',
            activeDevice.name,
            temp,
            hum,
            gasVal,
            true  // POST to backend - user-initiated action
        );
    }
    
    // Broadcast dispatch to all connected devices (including self)
    if (typeof emitBFPDispatch === 'function') {
        const acesId = getDeviceIdFromName(activeDevice.name);
        emitBFPDispatch(activeDevice.name, bfpContactNumber, acesId);
    }
};

window.clearDeviceLogs = function() {
    const clearDeviceLogsModal = document.getElementById('clearDeviceLogsModal');
    const clearDeviceLogsCancel = document.getElementById('clearDeviceLogsCancel');
    const clearDeviceLogsConfirm = document.getElementById('clearDeviceLogsConfirm');
    
    openModal(clearDeviceLogsModal);
    
    clearDeviceLogsCancel.onclick = () => {
        closeModal(clearDeviceLogsModal);
    };
    
    clearDeviceLogsConfirm.onclick = async () => {
        closeModal(clearDeviceLogsModal);
        
        // ONLY clear device activity logs (localStorage) - do NOT call API or clear system event logs
        deviceActivityLogs = []; // Clear from memory
        
        // Clear device-specific localStorage key
        const deviceId = activeDevice ? getDeviceIdFromName(activeDevice.name) : null;
        if (deviceId) {
            localStorage.removeItem(`deviceActivityLogs_${deviceId}`);
        }
        
        document.getElementById('deviceLogList').innerHTML = `
            <div class="system-clear-msg">
                Console cleared. Monitoring...
            </div>
        `;
    };
    
    clearDeviceLogsModal.addEventListener('click', (e) => {
        if (e.target === clearDeviceLogsModal) {
            closeModal(clearDeviceLogsModal);
        }
    });
};

/* ============================================================
   INLINE DEVICE DETAIL MODE (Desktop Dashboard)
   Supports multiple devices showing detail views simultaneously
   ============================================================ */

// Per-device state for inline mode
const inlineDeviceStates = new Map();

// Helper: Get element within a specific device's inline container
function getInlineEl(acesId, role) {
  const container = document.querySelector(`.device-inline-detail[data-aces-id="${acesId}"]`);
  if (!container) return null;
  return container.querySelector(`[data-role="${role}"]`);
}

// Defensive: Force ALL inline alarm buttons to match their correct per-device state.
// This prevents any cross-device visual leaking (e.g. ACES-2/3 buttons going sunken
// when only ACES-1's siren was toggled).
function syncAllInlineAlarmButtons() {
  if (typeof devices === 'undefined') return;
  devices.forEach(device => {
    const id = device.acesId;
    const state = inlineDeviceStates.get(id);
    const isActive = state ? state.manualAlarmActive : false;
    const btn = getInlineEl(id, 'manualAlarmBtn');
    const icon = getInlineEl(id, 'alarmBtnIcon');
    const label = getInlineEl(id, 'alarmBtnLabel');
    if (btn) {
      if (isActive) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    }
    if (icon && typeof ICONS !== 'undefined') {
      icon.innerHTML = isActive ? ICONS.ALARM_ON : ICONS.ALARM_OFF;
    }
    if (label) {
      label.textContent = isActive ? 'DEACTIVATE ALARM' : 'ACTIVATE ALARM';
    }
  });
}

// Initialize all inline device views (called after renderDevices on desktop)
function initAllInlineDevices() {
  if (typeof devices === 'undefined') return;

  devices.forEach(device => {
    // Determine current alert state from sensor data (prevent false re-logging)
    let initialAlertState = "SAFE";
    const isFire = device.fire === true || device.fire === 1 || device.fire === "true";
    if (isFire) initialAlertState = "FIRE";
    else if (device.temperature >= 42 && device.gas >= 600) initialAlertState = "FIRE";
    else if (device.temperature >= 42) initialAlertState = "HEAT";
    else if (device.gas >= 600) initialAlertState = "GAS_CRITICAL";
    else if (device.temperature >= 38) initialAlertState = "HEAT_WARNING";
    else if (device.gas >= 450) initialAlertState = "GAS_WARNING";
    else if (device.gas >= 300) initialAlertState = "SMOKE_WARNING";

    let savedLogs = [];
    try {
      savedLogs = JSON.parse(localStorage.getItem(`deviceActivityLogs_${device.acesId}`)) || [];
    } catch (e) {
      console.warn(`⚠️ Corrupt activity logs for ${device.acesId}, resetting:`, e.message);
      localStorage.removeItem(`deviceActivityLogs_${device.acesId}`);
    }
    // Preserve existing alarm state if device was already initialized
    // (renderDevices → initAllInlineDevices can be called repeatedly on sensor updates;
    //  we must NOT wipe the alarm state the user just toggled)
    const existingState = inlineDeviceStates.get(device.acesId);
    const state = {
      lastAlertState: existingState ? existingState.lastAlertState : initialAlertState,
      manualAlarmActive: existingState ? existingState.manualAlarmActive : false,
      deviceActivityLogs: existingState ? existingState.deviceActivityLogs : savedLogs
    };
    inlineDeviceStates.set(device.acesId, state);

    // Render saved activity logs
    renderInlineSavedLogs(device.acesId);

    // Set initial alarm button state
    const alarmBtn = getInlineEl(device.acesId, 'manualAlarmBtn');
    const alarmIcon = getInlineEl(device.acesId, 'alarmBtnIcon');
    const alarmLabel = getInlineEl(device.acesId, 'alarmBtnLabel');
    if (alarmBtn && alarmIcon) {
      if (state.manualAlarmActive) {
        alarmBtn.classList.add('is-active');
        alarmIcon.innerHTML = ICONS.ALARM_ON;
        if (alarmLabel) alarmLabel.textContent = 'DEACTIVATE ALARM';
      } else {
        alarmBtn.classList.remove('is-active');
        alarmIcon.innerHTML = ICONS.ALARM_OFF;
        if (alarmLabel) alarmLabel.textContent = 'ACTIVATE ALARM';
      }
    }

    // Set BFP icon
    const bfpIconWrap = getInlineEl(device.acesId, 'bfpBtn');
    if (bfpIconWrap) {
      const wrap = bfpIconWrap.querySelector('.bfp-icon-wrap');
      if (wrap) wrap.innerHTML = ICONS.BFP;
    }

    // Update banner/sensors with current data
    updateInlineDetailUI(device.acesId);
  });
}

// Update inline detail UI for a specific device
function updateInlineDetailUI(acesId) {
  if (typeof devices === 'undefined') return;
  const device = devices.find(d => d.acesId === acesId);
  if (!device) return;

  const banner = getInlineEl(acesId, 'statusBanner');
  const bannerText = getInlineEl(acesId, 'bannerText');
  const bannerIcon = getInlineEl(acesId, 'bannerIcon');
  const tempBox = getInlineEl(acesId, 'tempBox');
  const gasBox = getInlineEl(acesId, 'gasBox');

  if (!banner) return; // Not in inline mode

  const { temperature: temp, humidity: hum, gas, fire } = device;

  banner.classList.remove('banner-safe', 'banner-danger', 'banner-warning', 'banner-gas-warning', 'banner-smoke-warning', 'banner-offline', 'banner-reconnect');
  [tempBox, gasBox].forEach(box => box && box.classList.remove('danger', 'warning'));

  const isFire = fire === true || fire === 1 || fire === "true";

  // OFFLINE STATE — takes priority over all sensor states
  if (!device.online) {
    banner.classList.add('banner-offline');
    bannerText.innerText = "SYSTEM OFFLINE";
    bannerIcon.innerHTML = ICONS.OFFLINE;
  } else if (isFire) {
    banner.classList.add('banner-danger');
    bannerText.innerText = "FIRE DETECTED";
    bannerIcon.innerHTML = ICONS.FIRE;
    if (tempBox) tempBox.classList.add('danger');
    if (gasBox) gasBox.classList.add('danger');
  } else if (temp >= 42 && gas >= 600) {
    banner.classList.add('banner-danger');
    bannerText.innerText = "FIRE DETECTED";
    bannerIcon.innerHTML = ICONS.FIRE;
    if (tempBox) tempBox.classList.add('danger');
    if (gasBox) gasBox.classList.add('danger');
  } else if (gas >= 600) {
    banner.classList.add('banner-danger');
    bannerText.innerText = "CRITICAL GAS LEAK DETECTED";
    bannerIcon.innerHTML = ICONS.SMOKE;
    if (gasBox) gasBox.classList.add('danger');
  } else if (temp >= 42) {
    banner.classList.add('banner-danger');
    bannerText.innerText = "HIGH TEMPERATURE ALERT";
    bannerIcon.innerHTML = ICONS.HEAT;
    if (tempBox) tempBox.classList.add('danger');
  } else if (gas >= 450) {
    banner.classList.add('banner-gas-warning');
    bannerText.innerText = "GAS LEAK WARNING";
    bannerIcon.innerHTML = ICONS.SMOKE_WARN;
    if (gasBox) gasBox.classList.add('warning');
  } else if (temp >= 38) {
    banner.classList.add('banner-warning');
    bannerText.innerText = "ELEVATED TEMPERATURE";
    bannerIcon.innerHTML = ICONS.HEAT_WARN;
    if (tempBox) tempBox.classList.add('warning');
  } else if (gas >= 300) {
    banner.classList.add('banner-smoke-warning');
    bannerText.innerText = "SMOKE WARNING";
    bannerIcon.innerHTML = ICONS.SMOKE_WARN;
    if (gasBox) gasBox.classList.add('warning');
  } else {
    banner.classList.add('banner-safe');
    bannerText.innerText = "SYSTEM SAFE";
    bannerIcon.innerHTML = ICONS.SAFE;
  }

  // Update sensor values
  const detTemp = getInlineEl(acesId, 'detTemp');
  const detHum = getInlineEl(acesId, 'detHum');
  const detGas = getInlineEl(acesId, 'detGas');
  if (detTemp) detTemp.textContent = (temp ?? 0).toFixed(1);
  if (detHum) detHum.textContent = (hum ?? 0).toFixed(1);
  if (detGas) detGas.textContent = (gas ?? 0).toFixed(0);

  // Update status
  const statusEl = getInlineEl(acesId, 'detStatus');
  if (statusEl) {
    statusEl.textContent = device.online ? "ONLINE" : "OFFLINE";
    statusEl.className = `device-status ${device.online ? 'online' : 'offline'}`;
  }

  // Push live data to trend chart (desktop bento view) — only when device is online
  if (typeof window.pushTrendData === 'function' && device.online) {
    window.pushTrendData(acesId, temp ?? 0, hum ?? 0, gas ?? 0);
    window.drawTrendChart(acesId);
  }
}

// Check events for inline device
function checkInlineEvents(acesId, temp, hum, gas, fire) {
  const state = inlineDeviceStates.get(acesId);
  if (!state) return;

  let currentState = "SAFE";
  const isFire = fire === true || fire === 1 || fire === "true";

  if (isFire) currentState = "FIRE";
  else if (temp >= 42 && gas >= 600) currentState = "FIRE";
  else if (temp >= 42) currentState = "HEAT";
  else if (gas >= 600) currentState = "GAS_CRITICAL";
  else if (temp >= 38) currentState = "HEAT_WARNING";
  else if (gas >= 450) currentState = "GAS_WARNING";
  else if (gas >= 300) currentState = "SMOKE_WARNING";

  if (currentState !== state.lastAlertState) {
    if (currentState === "FIRE") {
      addInlineDeviceLog(acesId, "Fire condition detected by flame sensor.", "danger");
    } else if (currentState === "HEAT") {
      addInlineDeviceLog(acesId, `Temperature threshold exceeded. Current value: ${temp.toFixed(1)}°C`, "danger");
    } else if (currentState === "GAS_CRITICAL") {
      addInlineDeviceLog(acesId, `Critical gas leak detected. Current value: ${gas} ppm`, "danger");
    } else if (currentState === "HEAT_WARNING") {
      addInlineDeviceLog(acesId, `High temperature detected. Current value: ${temp.toFixed(1)}°C`, "warning");
    } else if (currentState === "GAS_WARNING") {
      addInlineDeviceLog(acesId, `Gas leak warning. Current value: ${gas} ppm`, "warning");
    } else if (currentState === "SMOKE_WARNING") {
      addInlineDeviceLog(acesId, `Smoke warning. Current value: ${gas} ppm`, "warning");
    } else if (currentState === "SAFE" && state.lastAlertState !== "SAFE") {
      addInlineDeviceLog(acesId, "System returned to normal parameters.", "info");
    }

    state.lastAlertState = currentState;
  }
}

// Add log entry for inline device
function addInlineDeviceLog(acesId, message, type, postToBackend, eventType) {
  if (typeof type === 'undefined') type = 'info';
  if (typeof postToBackend === 'undefined') postToBackend = false;

  const logList = getInlineEl(acesId, 'deviceLogList');
  if (!logList) return;

  const state = inlineDeviceStates.get(acesId);
  if (!state) return;

  const device = (typeof devices !== 'undefined') ? devices.find(d => d.acesId === acesId) : null;

  const dateObj = new Date();
  const dateStr = dateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
  const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  let dotColor = "#3b82f6";
  if (type === 'danger') dotColor = "#ef4444";
  if (type === 'warning') dotColor = "#fcc419";

  // Store log
  state.deviceActivityLogs.push({
    timestamp: `${dateStr} ${timeStr}`,
    message: message,
    type: type,
    fullTimestamp: new Date().toISOString()
  });

  // Save to localStorage
  localStorage.setItem(`deviceActivityLogs_${acesId}`, JSON.stringify(state.deviceActivityLogs));

  // Add to system event log
  if (device && typeof addToSystemEventLog === 'function') {
    const temp = (device.temperature != null) ? device.temperature : 0;
    const hum = (device.humidity != null) ? device.humidity : 0;
    const gasVal = (device.gas != null) ? device.gas : 0;
    addToSystemEventLog(message, eventType || type, device.name, temp, hum, gasVal, postToBackend);
  }

  // Render log entry
  const logEntry = document.createElement('div');
  logEntry.innerHTML = `
    <div class="log-time-wrapper">
      <span class="log-date">${dateStr}</span>
      <span class="log-time">${timeStr}</span>
    </div>
    <span class="status-dot" style="background: ${dotColor}; box-shadow: 0 0 10px ${dotColor};"></span>
    <span class="log-msg">${message}</span>
  `;
  logList.prepend(logEntry);
}

// Render saved activity logs for inline device
function renderInlineSavedLogs(acesId) {
  const logList = getInlineEl(acesId, 'deviceLogList');
  if (!logList) return;

  const state = inlineDeviceStates.get(acesId);
  if (!state) return;

  let html = '';
  [...state.deviceActivityLogs].reverse().forEach(log => {
    let dotColor = "#3b82f6";
    if (log.type === 'danger') dotColor = "#ef4444";
    if (log.type === 'warning') dotColor = "#fcc419";

    const timestampParts = log.timestamp.split(' ');
    const dateStr = timestampParts[0];
    const timeStr = timestampParts[1] + ' ' + timestampParts[2];

    html += `<div>
      <div class="log-time-wrapper">
        <span class="log-date">${dateStr}</span>
        <span class="log-time">${timeStr}</span>
      </div>
      <span class="status-dot" style="background: ${dotColor}; box-shadow: 0 0 10px ${dotColor};"></span>
      <span class="log-msg">${log.message}</span>
    </div>`;
  });

  logList.innerHTML = html;
}

// Trigger validation for inline device (siren/BFP)
window.triggerInlineValidation = function(type, acesId) {
  console.log(`🔧 triggerInlineValidation: type=${type}, acesId='${acesId}'`);
  if (typeof devices === 'undefined') return;
  const device = devices.find(d => d.acesId === acesId);
  if (!device) { console.error(`🔧 triggerInlineValidation BAIL: device not found for '${acesId}'`); return; }

  const alarmBtn = getInlineEl(acesId, 'manualAlarmBtn');
  const bfpBtn = getInlineEl(acesId, 'bfpBtn');
  const numInput = document.getElementById('bfpNumberInput');
  const state = inlineDeviceStates.get(acesId);
  if (!state) { console.error(`🔧 triggerInlineValidation BAIL: no state for '${acesId}'. Map keys:`, [...inlineDeviceStates.keys()]); return; }

  // Apply is-active to the correct button based on type
  const activeBtn = type === 'alarm' ? alarmBtn : bfpBtn;
  if (activeBtn) activeBtn.classList.add('is-active');

  if (type === 'alarm') {
    if (numInput) numInput.style.display = 'none';
    const title = "SYSTEM CONFIRMATION";
    const sirenSource = localStorage.getItem(`sirenSource_${acesId}`) || 'manual';
    const isAutoSiren = state.manualAlarmActive && sirenSource === 'auto';

    let message;
    if (state.manualAlarmActive && isAutoSiren) {
      message = `THE SIREN WAS <span class="text-engage">AUTO-ACTIVATED</span> DUE TO CRITICAL CONDITIONS.<br><br>ARE YOU SURE YOU WANT TO <span class="text-deactivate">OVERRIDE AND DEACTIVATE</span> THE SIREN?`;
    } else if (state.manualAlarmActive) {
      message = `ARE YOU SURE YOU WANT TO <span class="text-deactivate">DEACTIVATE</span> THE SIREN?`;
    } else {
      message = `ARE YOU SURE YOU WANT TO <span class="text-engage">ENGAGE</span> THE LABORATORY SIREN?`;
    }

    setTimeout(() => {
      showCustomModal(title, message,
        () => { toggleInlineManualAlarm(acesId); },
        () => { if (!state.manualAlarmActive && alarmBtn) alarmBtn.classList.remove('is-active'); }
      );
    }, 150);
  } else if (type === 'bfp') {
    // Check system configuration (address + BFP number required)
    (async () => {
      let configOk = true;
      try {
        const configUrl = getApiUrl(API_CONFIG.ENDPOINTS.GET_SYSTEM_CONFIG);
        const resp = await fetch(configUrl);
        const configData = await resp.json();
        if (!configData.success || !configData.configured) configOk = false;
      } catch (err) {
        console.warn('Could not verify system config:', err);
      }

      const globalBfpNumber = localStorage.getItem('globalBFPContactNumber') || '';

      if (!configOk || !globalBfpNumber) {
        if (bfpBtn) bfpBtn.classList.remove('is-active');
        if (numInput) numInput.style.display = 'none';
        const missing = [];
        if (!configOk) missing.push('<span class="text-engage">ADDRESS</span>');
        if (!globalBfpNumber) missing.push('<span class="text-engage">BFP CONTACT NUMBER</span>');
        showCustomModal(
          "SETUP REQUIRED",
          `SYSTEM CONFIGURATION IS NOT COMPLETE.<br><br>PLEASE GO TO <span class='text-engage'>SETTINGS</span> AND CONFIGURE YOUR ${missing.join(' AND ')} BEFORE DISPATCHING BFP ALERTS.`,
          () => { window.location.href = 'settings.html'; },
          () => {}
        );
        return;
      }

      // All configured — show dispatch confirmation
      if (numInput) numInput.style.display = 'none';
      const title = "FIRE DISPATCH";
      const message = `CONFIRM ALERT TO BFP AT:<br>
        <span class="text-engage" style="font-size: 1.2rem; display: block; margin: 10px 0;">${globalBfpNumber}</span>
        <span onclick="window.changeInlineBfpNumber('${acesId}')" class="text-change">
          <span style="font-size: 0.9rem; margin-right: 4px;">✎</span> CHANGE NUMBER
        </span>`;

      showCustomModal(title, message,
        () => {
          // Second confirmation — final warning before dispatch
          setTimeout(() => {
            showCustomModal(
              "⚠️ FINAL CONFIRMATION",
              `THIS ACTION WILL SEND AN <span class="text-engage">EMERGENCY ALERT</span> TO THE BUREAU OF FIRE PROTECTION.<br><br>This cannot be undone. False alarms may have serious consequences.<br><br>ARE YOU SURE YOU WANT TO PROCEED?`,
              () => {
                sendInlineBFPAlert(acesId);
                if (bfpBtn) bfpBtn.classList.remove('is-active');
              },
              () => { if (bfpBtn) bfpBtn.classList.remove('is-active'); }
            );
            // Style the confirm button as danger
            const confirmBtn = document.getElementById('modalConfirm');
            if (confirmBtn) {
              confirmBtn.classList.remove('confirm');
              confirmBtn.classList.add('danger');
            }
          }, 200);
        },
        () => { if (bfpBtn) bfpBtn.classList.remove('is-active'); }
      );
    })();
  }
};

// Change BFP number — redirect to settings
window.changeInlineBfpNumber = function(acesId) {
  closeModal(document.getElementById('customModal'), () => {
    window.location.href = 'settings.html';
  });
};

// Toggle manual alarm for inline device
function toggleInlineManualAlarm(acesId) {
  console.log(`🔧 toggleInlineManualAlarm called for: ${acesId}`);
  if (typeof isWebSocketReady === 'undefined' || !isWebSocketReady) {
    console.warn(`🔧 BAIL: WebSocket not ready (isWebSocketReady=${typeof isWebSocketReady !== 'undefined' ? isWebSocketReady : 'undefined'})`);
    showToast("Server not connected. Please wait and try again.", "error");
    return;
  }

  const state = inlineDeviceStates.get(acesId);
  if (!state) {
    console.error(`🔧 BAIL: No inlineDeviceState for '${acesId}'. Map keys:`, [...inlineDeviceStates.keys()]);
    return;
  }

  const device = (typeof devices !== 'undefined') ? devices.find(d => d.acesId === acesId) : null;
  if (!device) {
    console.error(`🔧 BAIL: No device found for '${acesId}'. Device acesIds:`, devices.map(d => d.acesId));
    return;
  }
  console.log(`🔧 State before toggle: manualAlarmActive=${state.manualAlarmActive}`);

  state.manualAlarmActive = !state.manualAlarmActive;
  const alarmBtn = getInlineEl(acesId, 'manualAlarmBtn');
  const alarmIcon = getInlineEl(acesId, 'alarmBtnIcon');
  const alarmLabel = getInlineEl(acesId, 'alarmBtnLabel');

  const prevSource = localStorage.getItem(`sirenSource_${acesId}`) || 'manual';
  const isOverride = !state.manualAlarmActive && prevSource === 'auto';

  if (state.manualAlarmActive) {
    addInlineDeviceLog(acesId, "MANUAL OVERRIDE: Siren activated.", "danger", true);
    if (alarmBtn) alarmBtn.classList.add('is-active');
    if (alarmIcon) alarmIcon.innerHTML = ICONS.ALARM_ON;
    if (alarmLabel) alarmLabel.textContent = 'DEACTIVATE ALARM';
    localStorage.setItem(`sirenSource_${acesId}`, 'manual');
    if (typeof emitAlarmStateChanged === 'function') {
      emitAlarmStateChanged(device.name, true, acesId, 'manual');
    }
  } else {
    const logMsg = isOverride
      ? "USER OVERRIDE: Auto-siren deactivated by user."
      : "Siren deactivated. Returning to monitoring mode.";
    addInlineDeviceLog(acesId, logMsg, "info", true);
    if (alarmBtn) alarmBtn.classList.remove('is-active');
    if (alarmIcon) alarmIcon.innerHTML = ICONS.ALARM_OFF;
    if (alarmLabel) alarmLabel.textContent = 'ACTIVATE ALARM';
    localStorage.setItem(`sirenSource_${acesId}`, 'manual');
    if (typeof emitAlarmStateChanged === 'function') {
      emitAlarmStateChanged(device.name, false, acesId, 'manual');
    }
  }

  localStorage.setItem(`manualAlarm_${acesId}`, state.manualAlarmActive ? 'true' : 'false');
  console.log(`🔧 Toggle complete: ${acesId} → manualAlarmActive=${state.manualAlarmActive}, btn=${!!alarmBtn}`);

  // Defensive: force ALL buttons to reflect their correct per-device state
  // This prevents other devices' buttons from visually leaking into active state
  syncAllInlineAlarmButtons();
}

// Send BFP alert for inline device
function sendInlineBFPAlert(acesId) {
  const device = (typeof devices !== 'undefined') ? devices.find(d => d.acesId === acesId) : null;
  if (!device) return;

  const bfpNumber = localStorage.getItem('globalBFPContactNumber') || '';
  if (!bfpNumber) return;

  const state = inlineDeviceStates.get(acesId);
  if (!state) return;

  const logList = getInlineEl(acesId, 'deviceLogList');

  // Create timestamp
  const dateObj = new Date();
  const dateStr = dateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
  const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const message = `DISPATCH: BFP Alert Sent to ${bfpNumber} Successfully.`;
  const dotColor = "#ef4444";

  // Store log for device activity (manually, to avoid double system event via addInlineDeviceLog)
  state.deviceActivityLogs.push({
    timestamp: `${dateStr} ${timeStr}`,
    message: message,
    type: 'danger',
    fullTimestamp: new Date().toISOString()
  });
  localStorage.setItem(`deviceActivityLogs_${acesId}`, JSON.stringify(state.deviceActivityLogs));

  // Render log entry in DOM
  if (logList) {
    const logEntry = document.createElement('div');
    logEntry.innerHTML = `
      <div class="log-time-wrapper">
        <span class="log-date">${dateStr}</span>
        <span class="log-time">${timeStr}</span>
      </div>
      <span class="status-dot" style="background: ${dotColor}; box-shadow: 0 0 10px ${dotColor};"></span>
      <span class="log-msg">${message}</span>
    `;
    logList.prepend(logEntry);
  }

  // Log to system event logs (one call only — matches detail page sendBFPAlert pattern)
  const temp = (device.temperature != null) ? device.temperature : 0;
  const hum = (device.humidity != null) ? device.humidity : 0;
  const gasVal = (device.gas != null) ? device.gas : 0;

  if (typeof addToSystemEventLog === 'function') {
    addToSystemEventLog(
      `Emergency alert dispatched to Bureau of Fire Protection at ${bfpNumber}`,
      'bfp_alert',
      device.name,
      temp, hum, gasVal,
      true
    );
  }

  if (typeof emitBFPDispatch === 'function') {
    emitBFPDispatch(device.name, bfpNumber, acesId);
  }
}

// Clear device logs for inline device
window.clearInlineDeviceLogs = function(acesId) {
  const clearModal = document.getElementById('clearDeviceLogsModal');
  if (!clearModal) return;
  const cancelBtn = document.getElementById('clearDeviceLogsCancel');
  const confirmBtn = document.getElementById('clearDeviceLogsConfirm');

  openModal(clearModal);

  cancelBtn.onclick = () => { closeModal(clearModal); };

  confirmBtn.onclick = () => {
    closeModal(clearModal);

    const state = inlineDeviceStates.get(acesId);
    if (state) {
      state.deviceActivityLogs = [];
    }
    localStorage.removeItem(`deviceActivityLogs_${acesId}`);

    const logList = getInlineEl(acesId, 'deviceLogList');
    if (logList) {
      logList.innerHTML = `<div class="system-clear-msg">Console cleared. Monitoring...</div>`;
    }
  };

  clearModal.addEventListener('click', (e) => {
    if (e.target === clearModal) closeModal(clearModal);
  });
};

// Toggle report menu for inline device
window.toggleInlineReportMenu = function(acesId) {
  const menu = getInlineEl(acesId, 'deviceReportMenu');
  if (menu) {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }
};

// Generate report for inline device
window.generateInlineDeviceReport = function(acesId, format) {
  const menu = getInlineEl(acesId, 'deviceReportMenu');
  if (menu) menu.style.display = 'none';

  if (typeof devices === 'undefined') return;
  const device = devices.find(d => d.acesId === acesId);
  if (!device) return;

  const deviceName = device.name;

  // Get logs from the inline device log container
  const logList = getInlineEl(acesId, 'deviceLogList');
  if (!logList) return;

  const logs = [];
  const logEntries = logList.querySelectorAll('div');
  logEntries.forEach(entry => {
    const dateEl = entry.querySelector('.log-date');
    const timeEl = entry.querySelector('.log-time');
    const msgEl = entry.querySelector('.log-msg');
    const dotEl = entry.querySelector('.status-dot');

    if (timeEl && msgEl) {
      const date = dateEl ? dateEl.textContent.trim() : '';
      const time = timeEl.textContent.trim();
      const timestamp = date ? `${date} ${time}` : time;
      const message = msgEl.textContent.trim();

      let type = 'info';
      if (dotEl) {
        const color = dotEl.style.background;
        if (color.includes('ef4444') || color === '#ef4444') type = 'danger';
        else if (color.includes('fcc419') || color === '#fcc419') type = 'warning';
      }

      logs.push({ timestamp, message, type, fullTimestamp: new Date().toISOString() });
    }
  });

  if (!logs || logs.length === 0) {
    showToast('No device activity logs to report', 'warning');
    return;
  }

  const timestamp = new Date().toLocaleString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });

  const filename = `${deviceName.replace(/\s+/g, '_')}_ActivityLog_${new Date().toISOString().split('T')[0]}`;

  if (format === 'pdf' && typeof generateActivityLogPDF === 'function') {
    const content = generateActivityLogPDF(logs, deviceName, timestamp);
    if (typeof downloadPDF === 'function') downloadPDF(content, filename);
  } else if (format === 'txt' && typeof generateActivityLogTXT === 'function') {
    const content = generateActivityLogTXT(logs, deviceName, timestamp);
    if (typeof downloadTXT === 'function') downloadTXT(content, filename);
  } else if (format === 'csv' && typeof generateActivityLogCSV === 'function') {
    const content = generateActivityLogCSV(logs, deviceName, timestamp);
    if (typeof downloadCSV === 'function') downloadCSV(content, filename);
  }
};