/* ============================================================
    DEVICE DETAIL LOGIC (js/device.js)
   ============================================================ */

// THEME: Apply saved dark/light mode from localStorage
(function applySavedTheme() {
    const savedTheme = localStorage.getItem("acesTheme");
    if (savedTheme === "dark") {
        document.documentElement.classList.add("dark-mode");
    } else {
        document.documentElement.classList.remove("dark-mode");
    }
})();

// 1. ICON LIBRARY (SVG Paths)
const ICONS = {
    SAFE: `<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="currentColor"><path d="m438-338 226-226-57-57-169 169-84-84-57 57 141 141Zm42 258q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-84q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Zm0-316Z"/></svg>`,
    FIRE: `<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="currentColor"><path d="M200-400q0 52 21 98.5t60 81.5q-1-5-1-9v-9q0-32 12-60t35-51l113-111 113 111q23 23 35 51t12 60v9q0 4-1 9 39-35 60-81.5t21-98.5q0-50-18.5-94.5T608-574q-20 13-42 19.5t-45 6.5q-62 0-107.5-41T361-690q-39 33-69 68.5t-50.5 72Q221-513 210.5-475T200-400Zm240 52-57 56q-11 11-17 25t-6 29q0 32 23.5 55t56.5 23q33 0 56.5-23t23.5-55q0-16-6-29.5T497-292l-57-56Zm0-492v132q0 34 23.5 57t57.5 23q18 0 33.5-7.5T582-658l18-22q74 42 117 117t43 163q0 134-93 227T440-80q-134 0-227-93t-93-227q0-129 86.5-245T440-840Zm400 320q-17 0-28.5-11.5T800-560q0-17 11.5-28.5T840-600q17 0 28.5 11.5T880-560q0 17-11.5 28.5T840-520Zm-40-120v-200h80v200h-80Z"/></svg>`,
    HEAT: `<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="currentColor"><path d="M320-120q-83 0-141.5-58.5T120-320q0-48 21-89.5t59-70.5v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q38 29 59 70.5t21 89.5q0 83-58.5 141.5T320-120Zm0-80q50 0 85-35t35-85q0-29-12.5-54T392-416l-32-24v-280q0-17-11.5-28.5T320-760q-17 0-28.5 11.5T280-720v280l-32 24q-23 17-35.5 42T200-320q0 50 35 85t85 35Zm0-120Zm400-200q-17 0-28.5-11.5T680-560q0-17 11.5-28.5T720-600q17 0 28.5 11.5T760-560q0 17-11.5 28.5T720-520Zm-40-120v-200h80v200h-80Z"/></svg>`,
    SMOKE: `<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="currentColor"><path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H260Zm0-80h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41Zm220-240Zm0 160q17 0 28.5-11.5T520-360q0-17-11.5-28.5T480-400q-17 0-28.5 11.5T440-360q0 17 11.5 28.5T480-320Zm-40-140h80v-180h-80v180Z"/></svg>`,
    POWER: `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-84 31.5-156.5T197-763l56 56q-44 44-68.5 102T160-480q0 134 93 227t227 93q134 0 227-93t93-227q0-67-24.5-125T707-707l56-56q54 54 85.5 126.5T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-40-360v-440h80v440h-80Z"/></svg>`,
    BFP: `<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M280-120q-50 0-85-35t-35-85h-40q-33 0-56.5-23.5T40-320v-200h440v-160q0-33 23.5-56.5T560-760h80v-40q0-17 11.5-28.5T680-840h40q17 0 28.5 11.5T760-800v40h22q26 0 47 15t29 40l58 172q2 6 3 12.5t1 13.5v267H800q0 50-35 85t-85 35q-50 0-85-35t-35-85H400q0 50-35 85t-85 35Zm0-80q17 0-28.5-11.5T320-240q0-17-11.5-28.5T280-280q-17 0-28.5 11.5T240-240q0 17 11.5 28.5T280-200Zm400 0q17 0-28.5-11.5T720-240q0-17-11.5-28.5T680-280q-17 0-28.5 11.5T640-240q0 17 11.5 28.5T680-200ZM120-440v120h71q17-19 40-29.5t49-10.5q26 0 49 10.5t40 29.5h111v-120H120Zm440 120h31q17-19 40-29.5t49-10.5q26 0 49 10.5t40 29.5h71v-120H560v120Zm0-200h276l-54-160H560v160ZM40-560v-60h40v-80H40v-60h400v60h-40v80h40v60H40Zm100-60h70v-80h-70v80Zm130 0h70v-80h-70v80Zm210 180H120h360Zm80 0h280-280Z"/></svg>`
};

let activeDevice = null;
let manualAlarmActive = false;
let lastAlertState = "SAFE";
// Store device activity logs for reporting - load from localStorage if available (device-specific)
let deviceActivityLogs = [];
let currentDeviceId = null; // Track which device we're viewing

// Helper function to get localStorage key for current device
function getDeviceLogsKey() {
    return `deviceActivityLogs_${currentDeviceId}`;
}

// Helper function to get localStorage key for BFP number
function getDeviceBFPKey() {
    return `bfpContactNumber_${currentDeviceId}`;
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
function addDeviceLog(message, type = 'info') {
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

    // Also add to global system event logs
    addToSystemEventLog(message, type, activeDevice ? activeDevice.name : 'Unknown Device');

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
async function addToSystemEventLog(message, type, deviceName) {
    const eventTypeMap = {
        'danger': 'critical',
        'warning': 'warning',
        'info': 'device_online'
    };

    const eventType = eventTypeMap[type] || type;
    const deviceId = getDeviceIdFromName(deviceName);
    
    const systemEvent = {
        id: window.systemEventLogs.length + 1,
        deviceId: deviceId,
        labName: deviceName,
        timestamp: new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
        eventType: eventType,
        alertMessage: message,
        temperature: 0,
        humidity: 0,
        gas: 0
    };
    
    window.systemEventLogs.unshift(systemEvent);
    
    // Post to API if enabled
    if (API_CONFIG.ENABLE_API) {
        try {
            const apiPayload = {
                deviceId: deviceId,
                labName: deviceName,
                eventType: eventType,
                alertMessage: message,
                temperature: 0,
                humidity: 0,
                gas: 0,
                timestamp: new Date().toISOString()
            };
            
            await apiCall('POST', API_CONFIG.ENDPOINTS.CREATE_LOG, apiPayload);
            console.log('Log posted to API:', apiPayload);
        } catch (error) {
            console.error('Failed to post log to API:', error);
        }
    }
}

// Helper function to get device ID from name
function getDeviceIdFromName(name) {
    // Find the device by name from the global devices array
    if (!name || typeof name !== 'string') return 'ACES-1';
    
    // Access the devices array from main.js (it's global)
    if (typeof devices !== 'undefined' && Array.isArray(devices)) {
        const device = devices.find(d => d.name === name);
        if (device) {
            // Map ESP URL to ACES ID
            if (device.espUrl.includes('192.168.100.70')) return 'ACES-1';
            if (device.espUrl.includes('192.168.100.71')) return 'ACES-2';
            if (device.espUrl.includes('192.168.100.72')) return 'ACES-3';
        }
    }
    
    // Fallback to name matching (for backward compatibility)
    if (name.includes('Computer Laboratory 1')) return 'ACES-1';
    if (name.includes('Computer Laboratory 2')) return 'ACES-2';
    if (name.includes('Food Laboratory')) return 'ACES-3';
    
    return 'ACES-1'; // Default fallback
}

// 3. EVENT MONITORING
function checkEvents(temp, hum, gas) {
    let currentState = "SAFE";
    if (temp >= 42 && gas >= 600) currentState = "FIRE";
    else if (temp >= 42) currentState = "HEAT";
    else if (gas >= 600) currentState = "GAS";

    if (currentState !== lastAlertState) {
        if (currentState === "FIRE") addDeviceLog("CRITICAL: Potential Fire detected (Heat + Smoke)", "danger");
        else if (currentState === "HEAT") addDeviceLog(`High Temperature Warning: ${temp.toFixed(1)}°C`, "warning");
        else if (currentState === "GAS") addDeviceLog(`High Gas/Smoke Levels: ${gas} PPM`, "warning");
        else if (currentState === "SAFE" && lastAlertState !== "SAFE") addDeviceLog("System returned to normal parameters.", "info");
        
        lastAlertState = currentState;
    }
}

// 4. UI UPDATE LOGIC
function updateDetailUI() {
    if (!activeDevice) return;

    const { temperature: temp, humidity: hum, gas } = activeDevice;
    const banner = document.getElementById('statusBanner');
    const bannerText = document.getElementById('bannerText');
    const bannerIcon = document.getElementById('bannerIcon');
    const tempBox = document.getElementById('tempBox');
    const gasBox = document.getElementById('gasBox');

    banner.classList.remove('banner-safe', 'banner-danger');
    [tempBox, gasBox].forEach(box => box && box.classList.remove('danger'));

    let isEmergency = false;

    // Threshold Checks with Icon Swapping
    if (temp >= 42 && gas >= 600) {
        banner.classList.add('banner-danger');
        bannerText.innerText = "FIRE ALERT DETECTED";
        bannerIcon.innerHTML = ICONS.FIRE;
        if(tempBox) tempBox.classList.add('danger');
        if(gasBox) gasBox.classList.add('danger');
        isEmergency = true;
    } else if (temp >= 42) {
        banner.classList.add('banner-danger');
        bannerText.innerText = "CRITICAL TEMPERATURE";
        bannerIcon.innerHTML = ICONS.HEAT;
        if(tempBox) tempBox.classList.add('danger');
        isEmergency = true;
    } else if (gas >= 600) {
        banner.classList.add('banner-danger');
        bannerText.innerText = "GAS / SMOKE DETECTED";
        bannerIcon.innerHTML = ICONS.SMOKE;
        if(gasBox) gasBox.classList.add('danger');
        isEmergency = true;
    } else {
        banner.classList.add('banner-safe');
        bannerText.innerText = "SYSTEM SAFE";
        bannerIcon.innerHTML = ICONS.SAFE;
    }

    // Alarm Override Visually
    banner.style.opacity = (manualAlarmActive && isEmergency) ? "0.7" : "1";
    if (manualAlarmActive && isEmergency) bannerText.innerText += " (MUTED)";

    // Update Values
    document.getElementById('detTemp').textContent = temp.toFixed(1);
    document.getElementById('detHum').textContent = hum.toFixed(1);
    document.getElementById('detGas').textContent = gas.toFixed(0);

    const statusEl = document.getElementById('detStatus');
    if (statusEl) {
        statusEl.textContent = activeDevice.online ? "ONLINE" : "OFFLINE";
        statusEl.className = `device-status ${activeDevice.online ? 'online' : 'offline'}`;
    }
}

// Global variable to store BFP contact for the session - load from localStorage if available (device-specific)
let bfpContactNumber = "";

// Helper function to load BFP number for specific device
function loadBFPNumberForDevice(deviceId) {
    bfpContactNumber = localStorage.getItem(getDeviceBFPKey()) || "";
}

// Helper function to save BFP number to localStorage (device-specific)
function saveBFPNumberToStorage() {
    localStorage.setItem(getDeviceBFPKey(), bfpContactNumber);
    // Sync BFP numbers to other devices
    if (typeof emitBFPNumbersChanged === 'function' && activeDevice) {
      emitBFPNumbersChanged(activeDevice.name, bfpContactNumber);
    }
} 

// 5. BOOTSTRAP / INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const deviceName = params.get('name');
    activeDevice = devices.find(d => d.name === deviceName);

    if (activeDevice) {
        // Load device-specific data from localStorage
        const deviceId = getDeviceIdFromName(activeDevice.name);
        loadActivityLogsForDevice(deviceId);
        loadBFPNumberForDevice(deviceId);
        
        // Load saved alarm state from localStorage
        const savedAlarmState = localStorage.getItem(`manualAlarm_${deviceId}`);
        if (savedAlarmState === 'true') {
          manualAlarmActive = true;
        }
        
        document.getElementById('detDeviceName').textContent = activeDevice.name;
        
        // Display the ACES device ID
        const deviceIdBadge = document.getElementById('detDeviceId');
        if (deviceIdBadge) {
            deviceIdBadge.textContent = deviceId;
        }
        
        const alarmIconWrap = document.getElementById('alarmBtnIcon');
        const bfpIconWrap = document.querySelector('.bfp-icon-wrap');

        if(alarmIconWrap) alarmIconWrap.innerHTML = ICONS.POWER; 
        if(bfpIconWrap) bfpIconWrap.innerHTML = ICONS.BFP;

        const alarmBtn = document.getElementById('manualAlarmBtn');
        const bfpBtn = document.getElementById('bfpBtn');
        
        if(alarmBtn) {
            manualAlarmActive ? alarmBtn.classList.add('is-active') : alarmBtn.classList.remove('is-active');
        }
        if(bfpBtn) bfpBtn.classList.remove('is-active'); 

        updateDetailUI();
        // TODO: Uncomment this when ESP32 is integrated to log on actual connection
        // addDeviceLog(`Connected to ${activeDevice.name}. Monitoring active.`, "info");
        
        // Render saved logs from localStorage
        renderSavedActivityLogs();
        
        setInterval(async () => {
            await activeDevice.fetchData();
            updateDetailUI();
            checkEvents(activeDevice.temperature, activeDevice.humidity, activeDevice.gas);
        }, 1000); 
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
    modal.style.display = 'flex';

    confirmBtn.onclick = () => {
        onConfirm();
        modal.style.display = 'none';
    };

    cancelBtn.onclick = () => {
        if (onCancel) onCancel();
        modal.style.display = 'none';
    };
}

// 6. WINDOW ACTIONS (The Security Layer)

window.triggerValidation = function(type) {
    const btnId = type === 'alarm' ? 'manualAlarmBtn' : 'bfpBtn';
    const btnElement = document.getElementById(btnId);
    const numInput = document.getElementById('bfpNumberInput');
    
    if(btnElement) btnElement.classList.add('is-active');

    // --- CASE: MANUAL ALARM ---
    if (type === 'alarm') {
        if(numInput) numInput.style.display = 'none'; // Hide phone input
        const title = "SYSTEM CONFIRMATION";
        const message = manualAlarmActive 
            ? `ARE YOU SURE YOU WANT TO <span class="text-deactivate">DEACTIVATE</span> THE MANUAL ALARM?` 
            : `ARE YOU SURE YOU WANT TO <span class="text-engage">ENGAGE</span> THE LABORATORY ALARM SYSTEM?`;

        setTimeout(() => {
            showCustomModal(title, message, 
                () => { window.toggleManualAlarm(); }, 
                () => { if (!manualAlarmActive && btnElement) btnElement.classList.remove('is-active'); }
            );
        }, 150);
    } 
    
  // --- CASE: BFP DISPATCH (Two-Step Setup & Confirmation) ---
    else if (type === 'bfp') {
        if (!bfpContactNumber) {
            if(numInput) {
                numInput.style.display = 'block';
                numInput.value = "";
                numInput.focus();
                
                // Real-time restriction: prevent letters and limit to 11 chars
                numInput.oninput = function() {
                    this.value = this.value.replace(/[^0-9]/g, '').slice(0, 11);
                };
            }
            
            setTimeout(() => {
                showCustomModal("BFP SETUP", "ENTER LOCAL BFP CONTACT NUMBER (NUMBERS ONLY, MAX 11):", 
                () => { // ON SAVE
                    const val = numInput.value.trim();
                    // Validation: Must be at least 7 digits to be a real number
                    if (val && val.length >= 7) { 
                        bfpContactNumber = val;
                        saveBFPNumberToStorage(); // Save to localStorage
                        numInput.style.display = 'none';
                        window.triggerValidation('bfp'); 
                    } else {
                        showToast("Please enter a valid phone number (7-11 digits)", "error");
                        // We don't hide the modal so they can fix it
                        if(btnElement) btnElement.classList.remove('is-active');
                    }
                }, 
                () => { // ON CANCEL
                    if(numInput) numInput.style.display = 'none';
                    if(btnElement) btnElement.classList.remove('is-active');
                });
            }, 150);
        } 
        // ... rest of Step 2 logic remains the same
        // STEP 2: Final Validation with Change Number Option
        else {
    if(numInput) numInput.style.display = 'none';
    const title = "FIRE DISPATCH";
    // Added a small Pencil Icon (✎) and removed underline style
    const message = `CONFIRM ALERT TO BFP AT:<br>
                     <span class="text-engage" style="font-size: 1.2rem; display: block; margin: 10px 0;">${bfpContactNumber}</span>
                     <span onclick="window.changeBfpNumber()" class="text-change">
                        <span style="font-size: 0.9rem; margin-right: 4px;">✎</span> CHANGE NUMBER
                     </span>`;
    
    setTimeout(() => {
        showCustomModal(title, message, 
        () => { 
            window.sendBFPAlert();
            if(btnElement) btnElement.classList.remove('is-active');
        }, 
        () => { if(btnElement) btnElement.classList.remove('is-active'); });
    }, 150);
        }
    }
};

// Global function to reset BFP number and restart setup
window.changeBfpNumber = function() {
    bfpContactNumber = "";
    localStorage.removeItem('bfpContactNumber'); // Clear from storage
    document.getElementById('customModal').style.display = 'none';
    window.triggerValidation('bfp');
};

// Actual Logic for Alarm
window.toggleManualAlarm = function() {
    manualAlarmActive = !manualAlarmActive;
    const alarmBtn = document.getElementById('manualAlarmBtn');
    const acesId = getDeviceIdFromName(activeDevice.name);
    
    if (manualAlarmActive) {
        addDeviceLog("MANUAL OVERRIDE: Alarm activated.", "danger");
        if(alarmBtn) alarmBtn.classList.add('is-active');
        // Sync alarm state to other devices
        if (typeof emitAlarmStateChanged === 'function') {
          emitAlarmStateChanged(activeDevice.name, true, acesId);
        }
    } else {
        addDeviceLog("Manual alarm reset to monitoring mode.", "info");
        if(alarmBtn) alarmBtn.classList.remove('is-active');
        // Sync alarm state to other devices
        if (typeof emitAlarmStateChanged === 'function') {
          emitAlarmStateChanged(activeDevice.name, false, acesId);
        }
    }
};

// Actual Logic for BFP
window.sendBFPAlert = function() {
    addDeviceLog(`DISPATCH: BFP Alert Sent to ${bfpContactNumber} Successfully.`, "danger");
    
    // Broadcast dispatch to all connected devices (including self)
    if (typeof emitBFPDispatch === 'function') {
        emitBFPDispatch(activeDevice.name, bfpContactNumber);
    }
};

window.clearDeviceLogs = function() {
    const clearDeviceLogsModal = document.getElementById('clearDeviceLogsModal');
    const clearDeviceLogsCancel = document.getElementById('clearDeviceLogsCancel');
    const clearDeviceLogsConfirm = document.getElementById('clearDeviceLogsConfirm');
    
    clearDeviceLogsModal.style.display = 'flex';
    
    clearDeviceLogsCancel.onclick = () => {
        clearDeviceLogsModal.style.display = 'none';
    };
    
    clearDeviceLogsConfirm.onclick = async () => {
        clearDeviceLogsModal.style.display = 'none';
        
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
            clearDeviceLogsModal.style.display = 'none';
        }
    });
};