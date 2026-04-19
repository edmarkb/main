// ============================================================
// WEBSOCKET CLIENT - Real-time Device Synchronization
// ============================================================

let socket = null;
let isWebSocketReady = false;

// ============================================================
// RECONNECT BANNER — "DEVICE CAME BACK ONLINE" transition
// Shows briefly when a device reconnects, then settles to normal state.
// ============================================================
const RECONNECT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#22c55e"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-692v-148h80v280H520v-80h168q-32-56-87.5-88T480-760q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`;

function showReconnectBanner(acesId, mode) {
  let banner, bannerText, bannerIcon;

  if (mode === 'inline') {
    // Inline (desktop bento) — uses data-role attributes
    const container = document.querySelector(`.device-inline-detail[data-aces-id="${acesId}"]`);
    if (!container) return;
    banner = container.querySelector('[data-role="statusBanner"]');
    bannerText = container.querySelector('[data-role="bannerText"]');
    bannerIcon = container.querySelector('[data-role="bannerIcon"]');
  } else {
    // Detail page (device.html) — uses IDs
    banner = document.getElementById('statusBanner');
    bannerText = document.getElementById('bannerText');
    bannerIcon = document.getElementById('bannerIcon');
  }

  if (!banner || !bannerText || !bannerIcon) return;

  // Show reconnect state
  banner.classList.remove('banner-safe', 'banner-danger', 'banner-warning', 'banner-gas-warning', 'banner-smoke-warning', 'banner-offline');
  banner.classList.add('banner-reconnect');
  bannerText.innerText = "DEVICE BACK ONLINE";
  bannerIcon.innerHTML = RECONNECT_ICON;

  // After 3 seconds, transition back to real state
  setTimeout(() => {
    banner.classList.remove('banner-reconnect');
    if (mode === 'inline') {
      if (typeof updateInlineDetailUI === 'function') updateInlineDetailUI(acesId);
    } else {
      if (typeof updateDetailUI === 'function') updateDetailUI();
    }
  }, 3000);
}

// ============================================================
// SYNC DEVICES FROM REST API (Database is source of truth)
// Reusable: called on connect, reconnect, and app resume
// ============================================================
function syncDevicesFromAPI() {
  if (typeof API_CONFIG === 'undefined' || !API_CONFIG.ENABLE_API) return;
  if (typeof devices === 'undefined') return;

  fetch(getApiUrl(API_CONFIG.ENDPOINTS.GET_DEVICES))
    .then(res => res.ok ? res.json() : Promise.reject('API error'))
    .then(response => {
      const serverDevices = response && response.devices ? response.devices : (Array.isArray(response) ? response : null);
      if (!serverDevices || !Array.isArray(serverDevices)) return;

      let changed = false;
      const serverIds = new Set();

      serverDevices.forEach(sd => {
        const id = sd.acesId || sd.deviceId;
        const name = sd.name || sd.labName;
        if (!id || !name || name === 'undefined' || name === 'null') return;
        serverIds.add(id);

        const local = devices.find(d => d.acesId === id);
        if (local) {
          if (name && local.name !== name) {
            local.name = name;
            changed = true;
          }
          // NOTE: GET /api/devices does NOT return an online field.
          // Online status is managed exclusively by WebSocket events
          // (device-status-changed, sync-devices) so we never reset it here.
          // This prevents the offline→online flicker on page navigation.
        } else {
          const newDev = new Device(id, name, sd.espUrl || '');
          newDev.temperature = sd.temperature;
          newDev.humidity = sd.humidity;
          newDev.gas = sd.gas;
          newDev.fire = sd.fire || sd.flame;
          newDev.online = sd.online || false;
          devices.push(newDev);
          changed = true;
        }
      });

      // Remove local devices not in database (deleted while offline)
      // If server returns an empty list, that means ALL devices were removed
      const before = devices.length;
      devices = devices.filter(d => serverIds.has(d.acesId));
      if (devices.length < before) {
        console.log(`🗑️ Removed ${before - devices.length} device(s) deleted while offline`);
        changed = true;
      }

      if (changed) {
        saveDevices();
        if (typeof renderDevices === 'function') renderDevices();
        console.log('📋 Synced devices from REST API');
      }
      // Always refresh side nav dots to match actual online status
      devices.forEach(d => {
        const dot = document.querySelector(`.side-nav-device-item[data-device-name="${d.name}"] .side-nav-device-dot`);
        if (dot) dot.classList.toggle('online', !!d.online);
      });

      // AFTER syncing from API, share the clean list with the server
      if (socket && isWebSocketReady) {
        const cleanDevices = (typeof devices !== 'undefined' && devices) ? devices : [];
        socket.emit('share-devices', cleanDevices.map(d => ({
          acesId: d.acesId,
          deviceId: d.acesId,
          name: d.name,
          labName: d.name,
          espUrl: d.espUrl,
          temperature: d.temperature,
          humidity: d.humidity,
          gas: d.gas,
          flame: d.flame
          // NOTE: online status NOT sent — watchdog is source of truth
        })));
      }
    })
    .catch(err => console.warn('Could not fetch devices from API:', err));
}

// ============================================================
// SYNC ALERT CONTACTS FROM REST API (Database is source of truth)
// Same pattern as device sync — ensures offline changes propagate
// ============================================================
function syncContactsFromAPI() {
  if (typeof API_CONFIG === 'undefined' || !API_CONFIG.ENABLE_API) return;

  fetch(getApiUrl(API_CONFIG.ENDPOINTS.GET_ALERT_CONTACTS))
    .then(res => res.ok ? res.json() : Promise.reject('API error'))
    .then(response => {
      const serverContacts = response && response.contacts ? response.contacts : null;
      if (!serverContacts || !Array.isArray(serverContacts)) return;

      // Update localStorage with server's authoritative contacts
      localStorage.setItem('alertNumbers', JSON.stringify(serverContacts));

      // Update the global alertNumbers array if it exists
      if (typeof alertNumbers !== 'undefined') {
        alertNumbers.length = 0;
        serverContacts.forEach(num => alertNumbers.push(num));

        // Re-render the numbers list if currently visible
        if (typeof renderNumbers === 'function') {
          renderNumbers();
        }
      }

      console.log(`📞 Synced ${serverContacts.length} alert contacts from REST API`);

      // After syncing from API, also request via WebSocket for real-time state
      if (socket && isWebSocketReady) {
        socket.emit('request-alert-contacts');
      }
    })
    .catch(err => console.warn('Could not fetch alert contacts from API:', err));
}

// Initialize WebSocket connection
function initWebSocket() {
  // Check if Socket.IO library is loaded
  if (typeof io === 'undefined') {
    console.warn('Socket.IO library not loaded yet, retrying in 1s...');
    setTimeout(initWebSocket, 1000);
    return;
  }

  socket = io(window.location.origin, {
    reconnection: true,
    reconnectionDelay: 2000,        // Increased from 1000ms
    reconnectionDelayMax: 10000,    // Increased from 5000ms - less aggressive
    reconnectionAttempts: 3,        // Reduced from 5 - give up sooner
    transports: ['websocket'],      // Only WebSocket, no polling (battery drain)
    forceNew: false,                // Reuse existing connection
    autoConnect: true
  });

  // Connection established
  socket.on('connect', () => {
    console.log('✅ WebSocket connected');
    isWebSocketReady = true;
    
    // Sync from REST API (source of truth) then share clean list with server
    syncDevicesFromAPI();
    
    // Sync alert contacts from REST API (same pattern)
    syncContactsFromAPI();

    // Request current siren states from server
    socket.emit('request-siren-state');

    // Request current BFP number from server
    socket.emit('request-bfp-number');
  });

  // Receive synced device list from server (for multi-user sync)
  // Server is the source of truth — update names, add missing, remove deleted
  socket.on('sync-devices', (deviceList) => {
    if (!deviceList || typeof devices === 'undefined') return;
    
    console.log(`📋 Received ${deviceList.length} devices from server`);
    
    let structureChanged = false; // Device added/removed/renamed — needs full re-render
    let sensorUpdated = false;    // Only sensor values changed — update in-place
    
    // Build a set of server device IDs to detect locally-deleted devices
    const serverIds = new Set();
    
    deviceList.forEach(serverDevice => {
      const id = serverDevice.acesId || serverDevice.deviceId;
      const name = serverDevice.name || serverDevice.labName;
      if (!id || !name || name === 'undefined' || name === 'null') return;
      
      serverIds.add(id);
      
      const localDevice = devices.find(d => d.acesId === id);
      if (localDevice) {
        // Update sensor data and status for devices we already have
        if (serverDevice.temperature != null) localDevice.temperature = serverDevice.temperature;
        if (serverDevice.humidity != null) localDevice.humidity = serverDevice.humidity;
        if (serverDevice.gas != null) localDevice.gas = serverDevice.gas;
        if (serverDevice.flame != null) localDevice.flame = serverDevice.flame;
        if (serverDevice.online != null) {
          localDevice.online = serverDevice.online;
          // Zero sensor values when device is offline
          if (!serverDevice.online) {
            localDevice.temperature = 0;
            localDevice.humidity = 0;
            localDevice.gas = 0;
            localDevice.fire = false;
          }
        }
        // Update name if server has a different (authoritative) name
        if (name && localDevice.name !== name) {
          console.log(`✏️ Server renamed ${localDevice.name} → ${name}`);
          localDevice.name = name;
          structureChanged = true; // Rename needs full re-render
        }
        sensorUpdated = true;
      } else {
        // Device exists on server but not locally — add it
        const newDev = new Device(id, name, serverDevice.espUrl || '');
        newDev.temperature = serverDevice.temperature;
        newDev.humidity = serverDevice.humidity;
        newDev.gas = serverDevice.gas;
        newDev.fire = serverDevice.fire || serverDevice.flame;
        newDev.online = serverDevice.online || false;
        devices.push(newDev);
        structureChanged = true; // New device needs full re-render
        console.log(`➕ Added missing device from server: ${name} (${id})`);
      }
    });
    
    // Remove local devices that no longer exist on the server
    // (they were removed by another user while we were offline)
    // If server sends empty list, all devices were removed — clear local too
    const before = devices.length;
    devices = devices.filter(d => serverIds.has(d.acesId));
    if (devices.length < before) {
      console.log(`🗑️ Removed ${before - devices.length} local device(s) not on server`);
      structureChanged = true; // Removed device needs full re-render
    }
    
    if (structureChanged || sensorUpdated) {
      saveDevices();
    }

    if (structureChanged) {
      // Full re-render only when device list structure changed (add/remove/rename)
      if (typeof renderDevices === 'function') {
        renderDevices();
      }
    } else if (sensorUpdated) {
      // Sensor-only updates: update in-place WITHOUT destroying the DOM.
      // This prevents the siren button from being rebuilt (which could confuse users
      // who just toggled the siren and are waiting for the physical response).
      const isDesktop = window.innerWidth >= 768;
      devices.forEach(d => {
        if (isDesktop && typeof updateInlineDetailUI === 'function') {
          updateInlineDetailUI(d.acesId);
        } else {
          // Mobile: find existing tile and update sensor values + status
          const tile = document.querySelector(`.device-tile[data-name="${d.name}"]`);
          if (tile) {
            if (typeof updateSensorValues === 'function') {
              updateSensorValues(tile, d);
            }
            // Update online/offline badge on mobile tile
            const statusEl = tile.querySelector('.device-status');
            if (statusEl) {
              statusEl.textContent = d.online ? 'Online' : 'Offline';
              statusEl.className = `device-status ${d.online ? 'online' : 'offline'}`;
            }
          }
        }
      });
    }
    // Always refresh side nav dots after sync
    devices.forEach(d => {
      const dot = document.querySelector(`.side-nav-device-item[data-device-name="${d.name}"] .side-nav-device-dot`);
      if (dot) dot.classList.toggle('online', !!d.online);
    });
  });

  // Connection lost
  socket.on('disconnect', () => {
    console.log('❌ WebSocket disconnected');
    isWebSocketReady = false;
  });

  // ============================================================
  // LISTEN FOR DEVICE CHANGES
  // ============================================================

  // Device added by another user
  socket.on('device-added', (device) => {
    if (typeof devices === 'undefined') return;
    
    // Backend sends deviceId/labName, frontend uses acesId/name
    const id = device.acesId || device.deviceId;
    const name = device.name || device.labName;
    
    // Check if device already exists locally (match by acesId)
    const exists = devices.some(d => d.acesId === id);
    if (!exists) {
      // Add device locally
      const newDev = new Device(id, name, device.espUrl);
      newDev.temperature = device.temperature;
      newDev.humidity = device.humidity;
      newDev.gas = device.gas;
      newDev.flame = device.flame;
      newDev.online = device.online || false;
      
      devices.push(newDev);
      saveDevices();
      
      if (typeof renderDevices === 'function') {
        renderDevices();
      }
      if (typeof populateSideNavDevices === 'function') {
        populateSideNavDevices();
      }
      
      showToast(`${name} added by another user`, 'info');
    }
  });

  // Device removed by another user
  socket.on('device-removed', (deviceName) => {
    if (typeof devices === 'undefined') return;
    
    console.log('🗑️  Device removed:', deviceName);
    
    const deviceIndex = devices.findIndex(d => d.name === deviceName);
    if (deviceIndex !== -1) {
      // Clear localStorage for this device using acesId
      const device = devices[deviceIndex];
      
      localStorage.removeItem(`deviceActivityLogs_${device.acesId}`);
      localStorage.removeItem(`bfpContactNumber_${device.acesId}`);
      
      // Remove from devices array
      devices.splice(deviceIndex, 1);
      saveDevices();
      
      if (typeof renderDevices === 'function') {
        renderDevices();
      }
      
      showToast(`${deviceName} removed by another user`, 'warning');
    }
  });

  // Device renamed by another user
  socket.on('device-renamed', (data) => {
    if (typeof devices === 'undefined') return;
    
    console.log('✏️  Device renamed:', data.oldName, '→', data.newName);
    
    const device = devices.find(d => d.name === data.oldName);
    if (device) {
      device.name = data.newName;
      saveDevices();
      
      if (typeof renderDevices === 'function') {
        renderDevices();
      }
      
      showToast(`${data.oldName} renamed to ${data.newName}`, 'info');
    }
  });

  // Device status changed (backend determines online/offline)
  socket.on('device-status-changed', (data) => {
    if (typeof devices === 'undefined') return;
    
    // Backend may send deviceName as acesId (e.g., "ACES-1") or as deviceId
    const targetId = data.deviceId || data.deviceName;
    const device = devices.find(d => d.acesId === targetId || d.name === data.deviceName);
    if (device) {
      const wasOnline = device.online;
      device.online = data.status === 'online';
      // Zero out sensor values when device goes offline
      if (!device.online) {
        device.temperature = 0;
        device.humidity = 0;
        device.gas = 0;
        device.fire = false;
      }
      saveDevices();

      // Update side nav dot directly
      const sideNavDot = document.querySelector(`.side-nav-device-item[data-device-name="${device.name}"] .side-nav-device-dot`);
      if (sideNavDot) {
        sideNavDot.classList.toggle('online', device.online);
      }
      
      // Check if inline detail mode (desktop)
      const inlineContainer = document.querySelector(`.device-inline-detail[data-aces-id="${device.acesId}"]`);
      if (inlineContainer) {
        // Show reconnect transition banner if device came back online
        if (!wasOnline && device.online) {
          showReconnectBanner(device.acesId, 'inline');
        } else {
          if (typeof updateInlineDetailUI === 'function') {
            updateInlineDetailUI(device.acesId);
          }
        }
        // Log status change in inline activity log
        if (wasOnline !== device.online) {
          if (typeof addInlineDeviceLog === 'function') {
            if (device.online) {
              addInlineDeviceLog(device.acesId, "Device came back online", "info");
            } else {
              addInlineDeviceLog(device.acesId, "Device connection lost", "danger");
            }
          }
        }
      } else if (typeof renderDevices === 'function') {
        // Mobile: re-render tiles
        renderDevices();
      }

      // Update side nav dot
      if (typeof updateSideNavDeviceStatus === 'function') {
        updateSideNavDeviceStatus(device.name, device.online);
      }
      
      // Update device detail page if viewing this device (device.html)
      if (typeof activeDevice !== 'undefined' && activeDevice && activeDevice.acesId === device.acesId) {
        // Show reconnect transition banner if device came back online
        if (!wasOnline && device.online) {
          showReconnectBanner(device.acesId, 'detail');
        } else {
          if (typeof updateDetailUI === 'function') {
            updateDetailUI();
          }
        }
        // Log status change in device activity log
        if (wasOnline !== device.online) {
          if (typeof addDeviceLog === 'function') {
            if (device.online) {
              addDeviceLog("Device came back online", "info");
            } else {
              addDeviceLog("Device connection lost", "danger");
            }
          }
        }
      }
    }
  });

  // Active clients count
  socket.on('active-clients', (count) => {
    console.log(`👥 Active users: ${count}`);
  });

  // Siren/alarm state changed by another user or auto-triggered by critical conditions
  socket.on('alarm-state-changed', (data) => {
    const acesId = data.acesId;
    const source = data.source || 'manual';
    if (!acesId) { console.warn('alarm-state-changed: missing acesId', data); return; }

    // Update UI if on device detail page AND this event is for the device we're viewing
    // (Without this guard, activating ACES-1 would visually activate the button on ACES-2/3 pages too)
    const currentDeviceAcesId = (typeof activeDevice !== 'undefined' && activeDevice)
      ? (activeDevice.acesId || '') : '';
    const isCurrentDevice = currentDeviceAcesId && currentDeviceAcesId === acesId;

    const alarmBtn = document.getElementById('manualAlarmBtn');
    if (alarmBtn && isCurrentDevice) {
      console.log(`🔔 Siren update for ${data.deviceName}: ${data.isActive ? 'ACTIVE' : 'INACTIVE'} [${source}]`);
      if (data.isActive) {
        alarmBtn.classList.add('is-active');
      } else {
        alarmBtn.classList.remove('is-active');
      }

      // Update the alarm icon
      const alarmIconWrap = document.getElementById('alarmBtnIcon');
      if (alarmIconWrap && typeof ICONS !== 'undefined') {
        alarmIconWrap.innerHTML = data.isActive ? ICONS.ALARM_ON : ICONS.ALARM_OFF;
      }

      // Update the alarm label text
      const alarmLabelEl = document.getElementById('alarmBtnLabel');
      if (alarmLabelEl) {
        alarmLabelEl.textContent = data.isActive ? 'DEACTIVATE ALARM' : 'ACTIVATE ALARM';
      }

      // Update the manualAlarmActive variable
      if (typeof manualAlarmActive !== 'undefined') {
        manualAlarmActive = data.isActive;
      }
    }

    // Save to localStorage
    localStorage.setItem(`manualAlarm_${acesId}`, data.isActive ? 'true' : 'false');
    localStorage.setItem(`sirenSource_${acesId}`, source);

    // Handle countdown timer data
    // cooldownStartedAt = when conditions returned to safe (countdown begins)
    // cooldownCancelled = critical condition returned, hide countdown
    // IMPORTANT: Only use cooldownStartedAt, NOT activatedAt - countdown only shows during cooldown period
    const countdownTime = data.cooldownStartedAt;

    if (data.cooldownCancelled) {
      // Critical condition returned during cooldown - hide countdown
      localStorage.removeItem(`sirenActivatedAt_${acesId}`);
      localStorage.removeItem(`sirenCooldownMs_${acesId}`);
    } else if (source === 'auto' && data.isActive && countdownTime) {
      // Cooldown started - store the countdown start time
      localStorage.setItem(`sirenActivatedAt_${acesId}`, countdownTime.toString());
      localStorage.setItem(`sirenCooldownMs_${acesId}`, (data.cooldownMs || 30000).toString());
    } else if (!data.isActive) {
      // Clear countdown data when siren is deactivated
      localStorage.removeItem(`sirenActivatedAt_${acesId}`);
      localStorage.removeItem(`sirenCooldownMs_${acesId}`);
    }

    // Trigger countdown timer update (mobile detail page)
    // Pass null for countdownTime if cooldown was cancelled or not started yet (hides countdown)
    // Note: No isCurrentDevice check - the function checks for DOM elements that only exist on detail page
    if (typeof updateSirenCountdown === 'function') {
      const effectiveTime = data.cooldownCancelled ? null : countdownTime;
      console.log(`🎯 alarm-state-changed: Calling updateSirenCountdown with effectiveTime=${effectiveTime}, serverNow=${data.serverNow}`);
      updateSirenCountdown(acesId, source, data.isActive, effectiveTime, data.cooldownMs, data.serverNow);
    }

    // Trigger countdown timer update (desktop inline view)
    if (typeof updateInlineSirenCountdown === 'function') {
      const effectiveTime = data.cooldownCancelled ? null : countdownTime;
      console.log(`🎯 alarm-state-changed: Calling updateInlineSirenCountdown with effectiveTime=${effectiveTime}, serverNow=${data.serverNow}`);
      updateInlineSirenCountdown(acesId, source, data.isActive, effectiveTime, data.cooldownMs, data.serverNow);
    }

    // Update inline alarm button (desktop dashboard)
    if (typeof getInlineEl === 'function') {
      const inlineAlarmBtn = getInlineEl(acesId, 'manualAlarmBtn');
      const inlineAlarmIcon = getInlineEl(acesId, 'alarmBtnIcon');
      const inlineAlarmLabel = getInlineEl(acesId, 'alarmBtnLabel');
      if (inlineAlarmBtn) {
        if (data.isActive) {
          inlineAlarmBtn.classList.add('is-active');
        } else {
          inlineAlarmBtn.classList.remove('is-active');
        }
        if (inlineAlarmIcon && typeof ICONS !== 'undefined') {
          inlineAlarmIcon.innerHTML = data.isActive ? ICONS.ALARM_ON : ICONS.ALARM_OFF;
        }
        if (inlineAlarmLabel) {
          inlineAlarmLabel.textContent = data.isActive ? 'DEACTIVATE ALARM' : 'ACTIVATE ALARM';
        }
      }
      // Update inline state
      if (typeof inlineDeviceStates !== 'undefined') {
        const state = inlineDeviceStates.get(acesId);
        if (state) state.manualAlarmActive = data.isActive;
      }
    }

    // Defensive: force ALL inline alarm buttons to match their correct state
    // Prevents cross-device button state leaking
    if (typeof syncAllInlineAlarmButtons === 'function') {
      syncAllInlineAlarmButtons();
    }

    // Show toast with appropriate message
    if (data.cooldownCancelled) {
      // Critical conditions returned during cooldown - siren stays on
      showToast(`${data.deviceName} critical conditions re-detected`, 'danger');
    } else if (data.cooldownStartedAt && data.isActive) {
      // Cooldown started - conditions returned to safe, countdown begins
      showToast(`${data.deviceName} conditions safe — siren will auto-off in 30s`, 'warning');
    } else if (source === 'auto' && data.isActive && !data.cooldownStartedAt) {
      // Initial auto-activation
      showToast(`${data.deviceName} siren auto-activated (critical condition)`, 'danger');
    } else if (source === 'auto' && !data.isActive) {
      // Siren deactivated (either after cooldown or manually)
      showToast(`${data.deviceName} conditions safe — returning to monitoring mode`, 'success');
    } else if (source !== 'auto') {
      // Manual activation/deactivation
      showToast(`${data.deviceName} siren ${data.isActive ? 'activated' : 'deactivated'}`, 'warning');
    }
  });

  // Sync siren states for all devices on connect/reconnect (server is source of truth)
  socket.on('sync-siren-state', (payload) => {
    if (!payload) return;
    // Handle new structure: { states, cooldownMs, serverNow } or legacy: just states object
    const states = payload.states || payload;
    const cooldownMs = payload.cooldownMs || 30000;
    const serverNow = payload.serverNow || Date.now();  // Fallback for legacy servers
    console.log('🔔 Received siren states from server:', states, 'cooldownMs:', cooldownMs, 'serverNow:', serverNow);

    for (const [deviceId, state] of Object.entries(states)) {
      localStorage.setItem(`manualAlarm_${deviceId}`, state.isActive ? 'true' : 'false');
      localStorage.setItem(`sirenSource_${deviceId}`, state.source || 'manual');

      // Use cooldownStartedAt if available (countdown only shows during cooldown period)
      const countdownTime = state.cooldownStartedAt || state.activatedAt;

      // Store siren countdown data for auto-activated sirens in cooldown
      if (state.source === 'auto' && state.isActive && state.cooldownStartedAt) {
        localStorage.setItem(`sirenActivatedAt_${deviceId}`, state.cooldownStartedAt.toString());
        localStorage.setItem(`sirenCooldownMs_${deviceId}`, cooldownMs.toString());
      } else if (!state.isActive || !state.cooldownStartedAt) {
        // No countdown if siren is off OR cooldown hasn't started yet
        localStorage.removeItem(`sirenActivatedAt_${deviceId}`);
        localStorage.removeItem(`sirenCooldownMs_${deviceId}`);
      }

      // Trigger countdown timer update (desktop inline view)
      // Only show countdown if cooldownStartedAt is set (conditions returned to safe)
      if (typeof updateInlineSirenCountdown === 'function') {
        console.log(`🎯 sync-siren-state: Calling updateInlineSirenCountdown with cooldownStartedAt=${state.cooldownStartedAt}, serverNow=${serverNow}`);
        updateInlineSirenCountdown(deviceId, state.source || 'manual', state.isActive, state.cooldownStartedAt, cooldownMs, serverNow);
      }

      // Update inline alarm buttons on desktop dashboard
      if (typeof getInlineEl === 'function') {
        const inlineBtn = getInlineEl(deviceId, 'manualAlarmBtn');
        const inlineIcon = getInlineEl(deviceId, 'alarmBtnIcon');
        const inlineLabel = getInlineEl(deviceId, 'alarmBtnLabel');
        if (inlineBtn) {
          if (state.isActive) inlineBtn.classList.add('is-active');
          else inlineBtn.classList.remove('is-active');
          if (inlineIcon && typeof ICONS !== 'undefined') {
            inlineIcon.innerHTML = state.isActive ? ICONS.ALARM_ON : ICONS.ALARM_OFF;
          }
          if (inlineLabel) {
            inlineLabel.textContent = state.isActive ? 'DEACTIVATE ALARM' : 'ACTIVATE ALARM';
          }
        }
        if (typeof inlineDeviceStates !== 'undefined') {
          const inlineState = inlineDeviceStates.get(deviceId);
          if (inlineState) inlineState.manualAlarmActive = state.isActive;
        }
      }
    }

    // Defensive: force ALL inline buttons to correct state after full sync
    if (typeof syncAllInlineAlarmButtons === 'function') {
      syncAllInlineAlarmButtons();
    }

    // If on device detail page, update the button to match server state
    const alarmBtn = document.getElementById('manualAlarmBtn');
    const alarmIconWrap = document.getElementById('alarmBtnIcon');
    const alarmLabelEl = document.getElementById('alarmBtnLabel');
    if (alarmBtn && typeof activeDevice !== 'undefined' && activeDevice) {
      const currentId = activeDevice.acesId || '';
      const deviceState = states[currentId];
      if (deviceState) {
        if (deviceState.isActive) {
          alarmBtn.classList.add('is-active');
        } else {
          alarmBtn.classList.remove('is-active');
        }
        if (alarmIconWrap && typeof ICONS !== 'undefined') {
          alarmIconWrap.innerHTML = deviceState.isActive ? ICONS.ALARM_ON : ICONS.ALARM_OFF;
        }
        if (alarmLabelEl) {
          alarmLabelEl.textContent = deviceState.isActive ? 'DEACTIVATE ALARM' : 'ACTIVATE ALARM';
        }
        if (typeof manualAlarmActive !== 'undefined') {
          manualAlarmActive = deviceState.isActive;
        }
        // Trigger countdown timer update (mobile detail page)
        // Only show countdown if cooldownStartedAt is set (conditions returned to safe)
        if (typeof updateSirenCountdown === 'function') {
          console.log(`🎯 sync-siren-state: Calling updateSirenCountdown with cooldownStartedAt=${deviceState.cooldownStartedAt}, serverNow=${serverNow}`);
          updateSirenCountdown(currentId, deviceState.source || 'manual', deviceState.isActive, deviceState.cooldownStartedAt, cooldownMs, serverNow);
        }
      }
    }
  });

  // BFP numbers updated by another user (DEPRECATED - now using global sync)
  socket.on('bfp-numbers-changed', (data) => {
    // Legacy handler - keeping for backwards compatibility
    console.log('📱 Legacy BFP numbers update received (use global-bfp-number-changed instead)');
  });

  // GLOBAL BFP number synced across ALL devices
  socket.on('global-bfp-number-changed', (data) => {
    console.log('📱 Global BFP number synced:', data.number);
    
    // Update localStorage with global BFP number
    localStorage.setItem('globalBFPContactNumber', data.number || '');
    
    // Update the bfpContactNumber variable if on device detail page
    if (typeof updateBFPNumberFromSync === 'function') {
      updateBFPNumberFromSync(data.number || '');
    }
    
    if (data.number) {
      showToast('BFP contact number synced: ' + data.number, 'info');
    } else {
      showToast('BFP contact number cleared', 'info');
    }
    updateSettingsIndicator();
  });

  // Receive authoritative BFP number from server on connect
  socket.on('sync-bfp-number', (data) => {
    const num = data.number || '';
    console.log('📞 Synced BFP number from server:', num || '(none)');
    localStorage.setItem('globalBFPContactNumber', num);
    if (typeof updateBFPNumberFromSync === 'function') {
      updateBFPNumberFromSync(num);
    }
    updateSettingsIndicator();
  });

  // BFP dispatch notification for all devices
  socket.on('bfp-dispatch', (data) => {
    console.log('🚨 BFP Dispatch received:', data.deviceName, 'at', data.phoneNumber);
    showToast(`${data.deviceName} - Emergency dispatched to BFP at ${data.phoneNumber}`, 'success', 4000);
  });

  // Alert contacts updated by another user (real-time broadcast)
  socket.on('alert-contacts-changed', (data) => {
    console.log('📞 Alert contacts updated:', data.contacts);
    
    // Update localStorage
    localStorage.setItem('alertNumbers', JSON.stringify(data.contacts));
    
    // Update the global alertNumbers variable if it exists
    if (typeof alertNumbers !== 'undefined') {
      alertNumbers.length = 0;
      data.contacts.forEach(num => alertNumbers.push(num));
      
      // Re-render the numbers list if the function exists
      if (typeof renderNumbers === 'function') {
        renderNumbers();
      }
    }
    
    showToast('Alert contacts updated', 'info');
    updateSettingsIndicator();
  });

  // Receive authoritative alert contacts from server on connect/reconnect
  // Same pattern as sync-devices — server is source of truth
  socket.on('sync-alert-contacts', (data) => {
    if (!data || !data.contacts) return;
    
    console.log(`📞 Received ${data.contacts.length} alert contacts from server`);
    
    // Update localStorage with server's authoritative list
    localStorage.setItem('alertNumbers', JSON.stringify(data.contacts));
    
    // Update the global alertNumbers array if it exists
    if (typeof alertNumbers !== 'undefined') {
      alertNumbers.length = 0;
      data.contacts.forEach(num => alertNumbers.push(num));
      
      // Re-render the numbers list if currently visible
      if (typeof renderNumbers === 'function') {
        renderNumbers();
      }
    }
    updateSettingsIndicator();
  });

  // ============================================================
  // ESP32 SENSOR DATA - Real-time updates from hardware
  // ============================================================
  
  // Receive sensor data from ESP32 (via backend)
  // Throttled save for sensor-data updates (avoid blocking UI on every 1-2s update)
  let _sensorSaveTimer = null;
  function throttledSaveDevices() {
    if (_sensorSaveTimer) return;
    _sensorSaveTimer = setTimeout(() => {
      saveDevices();
      _sensorSaveTimer = null;
    }, 800);
  }

  // Track previous alert states to detect transitions (safe → fire)
  const _prevAlertState = {};
  
  // Debounce toast notifications per device to prevent duplicates
  const _lastToastTime = {};
  const TOAST_DEBOUNCE_MS = 5000; // Don't show another toast for same device within 5s
  
  function showAlertToast(deviceId, message, type, duration) {
    const now = Date.now();
    const lastTime = _lastToastTime[deviceId] || 0;
    if (now - lastTime < TOAST_DEBOUNCE_MS) {
      console.log(`[TOAST] Skipped duplicate for ${deviceId} (${now - lastTime}ms since last)`);
      return;
    }
    _lastToastTime[deviceId] = now;
    showToast(message, type, duration);
  }

  socket.on('sensor-data', (data) => {
    // data format: { deviceId: 'ACES-1', temperature: 25.5, humidity: 60, gas: 150, flame: false }
    if (typeof devices === 'undefined') return;
    
    // Match by acesId (hardware ID), not by user's custom name
    const device = devices.find(d => d.acesId === data.deviceId);
    if (device) {
      // Capture previous state before updating
      const prevFire = device.fire;
      const prevTemp = device.temperature;
      const prevGas = device.gas;
      
      // Check if we WERE in a critical/warning state
      const wasCritical = (prevFire === true || prevFire === 1 || prevFire === "true") ||
                          (prevTemp >= 38) || (prevGas >= 450);
      
      device.updateSensorData(data);
      
      // Check if we ARE now safe
      const isFire = device.fire === true || device.fire === 1 || device.fire === "true";
      const isNowSafe = !isFire && device.temperature < 38 && device.gas < 450;
      
      // Detect state transitions and show toast on NEW critical conditions
      const wasFire = prevFire === true || prevFire === 1 || prevFire === "true";
      const isHeatCritical = device.temperature >= 42;
      const wasHeatCritical = prevTemp >= 42;
      const isGasCritical = device.gas >= 700;
      const wasGasCritical = prevGas >= 700;
      
      // Show toast on state CHANGE (not on every update)
      if (isFire && !wasFire) {
        showAlertToast(data.deviceId, `FIRE DETECTED on ${device.name}!`, 'danger', 5000);
      } else if (isHeatCritical && !wasHeatCritical && !isFire) {
        showAlertToast(data.deviceId, `HEAT DETECTED on ${device.name}! Temperature: ${device.temperature.toFixed(1)}°C`, 'danger', 5000);
      } else if (isGasCritical && !wasGasCritical && !isFire && !isHeatCritical) {
        showAlertToast(data.deviceId, `GAS DETECTED on ${device.name}! Gas level: ${device.gas} ppm`, 'danger', 5000);
      }
      
      // Update UI FIRST, save to localStorage later (non-blocking)
      // If we're on the device detail page, update UI and check for fire immediately
      if (typeof activeDevice !== 'undefined' && activeDevice && activeDevice.acesId === data.deviceId) {
        if (typeof updateDetailUI === 'function') {
          updateDetailUI();
        }
        // Check for fire/alerts immediately when sensor data arrives
        if (typeof checkEvents === 'function') {
          checkEvents(device.temperature, device.humidity, device.gas, device.fire);
        }
      }
      
      // If we're on the dashboard, update the device tile immediately
      if (typeof renderDevices === 'function') {
        const tile = document.querySelector(`.device-tile[data-name="${device.name}"]`);
        if (tile) {
          if (tile.classList.contains('device-inline-detail')) {
            // Desktop inline mode - use specialized update functions
            if (typeof updateInlineDetailUI === 'function') {
              updateInlineDetailUI(data.deviceId);
            }
            if (typeof checkInlineEvents === 'function') {
              checkInlineEvents(data.deviceId, device.temperature, device.humidity, device.gas, device.fire);
            }
          } else {
            // Mobile tile mode
            if (typeof updateSensorValues === 'function') {
              updateSensorValues(tile, device);
            }
            // Update online status on tile
            const statusEl = tile.querySelector('.device-status');
            if (statusEl) {
              statusEl.textContent = device.online ? 'Online' : 'Offline';
              statusEl.className = `device-status ${device.online ? 'online' : 'offline'}`;
            }
          }
        } else {
          // Not on dashboard page, that's fine
        }
      }

      // Update side nav dot — if sensor data is arriving, device is online
      const sideNavDot = document.querySelector(`.side-nav-device-item[data-device-name="${device.name}"] .side-nav-device-dot`);
      if (sideNavDot) {
        sideNavDot.classList.toggle('online', !!device.online);
      }
      
      // If transitioning from critical/warning → safe, save immediately (skip throttle)
      // so a page refresh won't show stale danger state
      if (wasCritical && isNowSafe) {
        if (_sensorSaveTimer) {
          clearTimeout(_sensorSaveTimer);
          _sensorSaveTimer = null;
        }
        saveDevices();
      } else {
        // Throttled save — don't block UI with localStorage writes on every update
        throttledSaveDevices();
      }
    }
  });

  // ============================================================
  // CRITICAL ALERT - Immediate push from ESP32 for any emergency
  // ============================================================
  socket.on('critical-alert', (data) => {
    // data format: { deviceId: 'ACES-1', type: 'fire'|'heat'|'gas', temperature: 45.0, humidity: 30, gas: 800, fire: false }
    if (typeof devices === 'undefined') return;
    
    console.log('🚨 [CRITICAL-ALERT] Received:', data);
    const device = devices.find(d => d.acesId === data.deviceId);
    if (device) {
      // Update device state immediately
      console.log(`✅ [CRITICAL-ALERT] Updating device ${device.acesId}`);
      device.temperature = data.temperature ?? device.temperature;
      device.humidity = data.humidity ?? device.humidity;
      device.gas = data.gas ?? device.gas;
      device.fire = data.fire ?? data.flame ?? device.fire;
      saveDevices();
      
      console.log(`📊 [CRITICAL-ALERT] New state - Temp: ${device.temperature}, Gas: ${device.gas}, Fire: ${device.fire}`);
      
      let alertType = data.type?.toUpperCase() || 'CRITICAL';
      
      console.log(`${alertType} ALERT from ${device.acesId} (${device.name})`);
      
      // Device detail page - update UI and trigger alert
      if (typeof activeDevice !== 'undefined' && activeDevice && activeDevice.acesId === data.deviceId) {
        console.log('📋 [CRITICAL-ALERT] Updating device detail page UI');
        if (typeof updateDetailUI === 'function') updateDetailUI();
        if (typeof checkEvents === 'function') {
          checkEvents(device.temperature, device.humidity, device.gas, device.fire);
        }
      }
      
      // Dashboard - update tile to show emergency state
      const tile = document.querySelector(`.device-tile[data-name="${device.name}"]`);
      if (tile) {
        if (tile.classList.contains('device-inline-detail')) {
          // Desktop inline mode
          console.log('🎨 [CRITICAL-ALERT] Updating inline detail view');
          if (typeof updateInlineDetailUI === 'function') updateInlineDetailUI(data.deviceId);
          if (typeof checkInlineEvents === 'function') {
            checkInlineEvents(data.deviceId, device.temperature, device.humidity, device.gas, device.fire);
          }
        } else {
          // Mobile tile mode
          console.log('🎨 [CRITICAL-ALERT] Updating dashboard tile with red border class');
          tile.classList.add('emergency-active');
          if (typeof updateSensorValues === 'function') {
            updateSensorValues(tile, device);
          }
        }
      } else {
        // Debug: Log all existing tiles to help identify the mismatch
        const allTiles = document.querySelectorAll('.device-tile');
        if (allTiles.length > 0) {
          const tileNames = Array.from(allTiles).map(t => t.getAttribute('data-name')).join(', ');
          console.warn(`⚠️ [CRITICAL-ALERT] Tile not found for "${device.name}"\n   Expected data-name: "${device.name}"\n   Tiles on dashboard: [${tileNames}]`);
        } else {
          console.info('ℹ️ [CRITICAL-ALERT] No tiles on current page (you may be on the detail page - that\'s OK, alert was still captured)');
        }
      }
      
      // Show toast notification on any page
      let message = '';
      if (data.type === 'heat') message = `HIGH TEMPERATURE on ${device.name}! ${data.temperature.toFixed(1)}°C`;
      else if (data.type === 'gas') message = `CRITICAL GAS LEAK on ${device.name}! ${data.gas} ppm`;
      else if (data.type === 'fire') message = `FIRE DETECTED on ${device.name}!`;
      else message = `${alertType} DETECTED on ${device.name}!`;
      
      showAlertToast(data.deviceId, message, 'danger', 5000);
    } else {
      console.warn('⚠️ [CRITICAL-ALERT] Device not found with acesId:', data.deviceId);
    }
  });

  // ============================================================
  // WARNING ALERT - Push from ESP32 for elevated conditions
  // ============================================================
  socket.on('warning-alert', (data) => {
    // data format: { deviceId: 'ACES-1', type: 'heat-warning'|'gas-warning', temperature: 39.0, humidity: 65, gas: 480, fire: false }
    if (typeof devices === 'undefined') return;
    
    console.log('⚠️ [WARNING-ALERT] Received:', data);
    const device = devices.find(d => d.acesId === data.deviceId);
    if (device) {
      // Update device state immediately
      console.log(`✅ [WARNING-ALERT] Updating device ${device.acesId}`);
      device.temperature = data.temperature ?? device.temperature;
      device.humidity = data.humidity ?? device.humidity;
      device.gas = data.gas ?? device.gas;
      device.fire = data.fire ?? data.flame ?? device.fire;
      saveDevices();
      
      console.log(`📊 [WARNING-ALERT] New state - Temp: ${device.temperature}, Gas: ${device.gas}`);
      
      console.log(`WARNING from ${device.acesId} (${device.name}): ${data.type}`);
      
      // Device detail page - update UI and trigger alert check
      if (typeof activeDevice !== 'undefined' && activeDevice && activeDevice.acesId === data.deviceId) {
        console.log('📋 [WARNING-ALERT] Updating device detail page UI');
        if (typeof updateDetailUI === 'function') updateDetailUI();
        if (typeof checkEvents === 'function') {
          checkEvents(device.temperature, device.humidity, device.gas, device.fire);
        }
      }
      
      // Dashboard - update tile to show warning state
      const tile = document.querySelector(`.device-tile[data-name="${device.name}"]`);
      if (tile) {
        if (tile.classList.contains('device-inline-detail')) {
          // Desktop inline mode
          console.log('🎨 [WARNING-ALERT] Updating inline detail view');
          if (typeof updateInlineDetailUI === 'function') updateInlineDetailUI(data.deviceId);
          if (typeof checkInlineEvents === 'function') {
            checkInlineEvents(data.deviceId, device.temperature, device.humidity, device.gas, device.fire);
          }
        } else {
          // Mobile tile mode
          console.log('🎨 [WARNING-ALERT] Updating dashboard tile with warning class');
          if (typeof updateSensorValues === 'function') {
            updateSensorValues(tile, device);
          }
        }
      } else {
        // Debug: Log all existing tiles to help identify the mismatch
        const allTiles = document.querySelectorAll('.device-tile');
        if (allTiles.length > 0) {
          const tileNames = Array.from(allTiles).map(t => t.getAttribute('data-name')).join(', ');
          console.warn(`⚠️ [WARNING-ALERT] Tile not found for "${device.name}"\n   Expected data-name: "${device.name}"\n   Tiles on dashboard: [${tileNames}]`);
        } else {
          console.info('ℹ️ [WARNING-ALERT] No tiles on current page (you may be on the detail page - that\'s OK, warning was still captured)');
        }
      }
      
      // Show toast notification on any page
      let message = '';
      if (data.type === 'heat-warning') {
        message = `High temperature on ${device.name}: ${data.temperature.toFixed(1)}°C`;
      } else if (data.type === 'smoke-warning') {
        message = `Smoke warning on ${device.name}: ${data.gas} ppm`;
      } else if (data.type === 'gas-warning') {
        message = `Gas leak warning on ${device.name}: ${data.gas} ppm`;
      } else {
        message = `Warning on ${device.name}: ${data.type}`;
      }
      
      showAlertToast(data.deviceId, message, 'warning', 4000);
    } else {
      console.warn('⚠️ [WARNING-ALERT] Device not found with acesId:', data.deviceId);
    }
  });

  // Error handling
  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}

// ============================================================
// EMIT DEVICE CHANGES TO OTHER USERS
// ============================================================

// Call this when a device is added
function emitDeviceAdded(device) {
  if (socket && isWebSocketReady) {
    socket.emit('device-added', {
      acesId: device.acesId,
      name: device.name,
      espUrl: device.espUrl,
      temperature: device.temperature,
      humidity: device.humidity,
      gas: device.gas,
      flame: device.flame,
      online: device.online
    });
  }
}

// Call this when a device is removed
function emitDeviceRemoved(deviceName) {
  if (socket && isWebSocketReady) {
    socket.emit('device-removed', deviceName);
  }
}

// Call this when a device is renamed
function emitDeviceRenamed(oldName, newName) {
  if (socket && isWebSocketReady) {
    socket.emit('device-renamed', {
      oldName: oldName,
      newName: newName
    });
  }
}

// Call this when device status changes
function emitDeviceStatusChanged(deviceName, status) {
  if (socket && isWebSocketReady) {
    socket.emit('device-status-changed', {
      deviceName: deviceName,
      status: status
    });
  }
}

// Call this when manual alarm/siren state changes
// Uses Socket.IO acknowledgment + auto-retry to handle WiFi hiccups.
function emitAlarmStateChanged(deviceName, isActive, acesId, source) {
  console.log(`🔧 emitAlarmStateChanged: device=${deviceName}, active=${isActive}, acesId=${acesId}, source=${source}, socketOk=${!!(socket && isWebSocketReady)}`);
  if (socket && isWebSocketReady) {
    const payload = {
      deviceName: deviceName,
      isActive: isActive,
      acesId: acesId,
      source: source || 'manual'
    };

    let acked = false;

    // Emit with Socket.IO ack callback — server confirms receipt
    socket.emit('alarm-state-changed', payload, function(response) {
      acked = true;
      if (response && response.success) {
        console.log(`✅ alarm-state-changed ACK from server for ${acesId} (isActive=${response.isActive})`);
      } else {
        console.warn(`⚠️ alarm-state-changed: server returned error for ${acesId}:`, response);
      }
    });

    // Auto-retry after 2s if no ack (covers WiFi micro-drops / socket buffer delays)
    setTimeout(function() {
      if (!acked && socket && isWebSocketReady) {
        console.warn(`⚠️ alarm-state-changed: No ACK within 2s — retrying for ${acesId}`);
        socket.emit('alarm-state-changed', payload);
      }
    }, 2000);

    console.log(`🔧 alarm-state-changed emitted to server (awaiting ACK) ✓`);
  } else {
    console.error(`🔧 FAILED: socket=${!!socket}, isWebSocketReady=${isWebSocketReady}`);
  }
}

// Call this when BFP numbers are saved (DEPRECATED - use emitGlobalBFPNumberChanged)
function emitBFPNumbersChanged(deviceName, numbers) {
  if (socket && isWebSocketReady) {
    socket.emit('bfp-numbers-changed', {
      deviceName: deviceName,
      numbers: numbers
    });
  }
}

// Call this when global BFP number is set/changed (syncs to ALL devices)
function emitGlobalBFPNumberChanged(number) {
  if (socket && isWebSocketReady) {
    console.log('📱 Emitting global BFP number:', number);
    socket.emit('global-bfp-number-changed', {
      number: number
    });
  }
}

// Call this when BFP dispatch is triggered
function emitBFPDispatch(deviceName, phoneNumber, acesId) {
  if (socket && isWebSocketReady) {
    socket.emit('bfp-dispatch', {
      deviceName: deviceName,
      phoneNumber: phoneNumber,
      acesId: acesId
    });
  }
}

// Call this when alert contacts are added/removed
function emitAlertContactsChanged(contacts) {
  if (socket && isWebSocketReady) {
    // Convert 09XXXXXXXXX format to +639XXXXXXXXX for GSM module
    const formattedContacts = contacts.map(num => {
      // Remove any spaces or dashes
      let cleaned = num.replace(/[\s\-]/g, '');
      
      // Convert 09 prefix to +639
      if (cleaned.startsWith('09') && cleaned.length === 11) {
        return '+63' + cleaned.substring(1); // 09XXXXXXXXX → +639XXXXXXXXX
      }
      // Already in international format
      if (cleaned.startsWith('+63')) {
        return cleaned;
      }
      // Already in 63 format (no +)
      if (cleaned.startsWith('63') && cleaned.length === 12) {
        return '+' + cleaned;
      }
      
      return cleaned; // Return as-is if unknown format
    });
    
    console.log('📱 Sending alert contacts to ESP32:', formattedContacts);
    
    socket.emit('alert-contacts-changed', {
      contacts: contacts,           // Original format for other frontends
      contactsFormatted: formattedContacts  // +63 format for ESP32
    });
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Small delay to ensure Socket.IO library is loaded
  setTimeout(initWebSocket, 100);
});

// ============================================================
// SETTINGS NAV INDICATOR — Shows dot when setup incomplete
// Runs on ALL pages (this file loads globally)
// ============================================================
function updateSettingsIndicator() {
  // Check BFP number
  const hasBfp = !!(localStorage.getItem('globalBFPContactNumber') || '').trim();
  
  // Check alert contacts
  let hasContacts = false;
  try {
    const contacts = JSON.parse(localStorage.getItem('alertNumbers') || '[]');
    hasContacts = Array.isArray(contacts) && contacts.length > 0;
  } catch (e) { hasContacts = false; }
  
  // Check address (async — fetch from API)
  if (typeof API_CONFIG !== 'undefined' && API_CONFIG.ENABLE_API) {
    fetch(getApiUrl('/api/system-config'))
      .then(r => r.ok ? r.json() : { success: false })
      .then(data => {
        const hasAddress = !!(data.success && data.configured && data.config && data.config.fullAddress);
        const complete = hasAddress && hasBfp && hasContacts;
        toggleSettingsDots(!complete);
      })
      .catch(() => {
        // If API fails, assume address not set
        toggleSettingsDots(true);
      });
  } else {
    // No API — just check local items
    toggleSettingsDots(!hasBfp || !hasContacts);
  }
}

function toggleSettingsDots(show) {
  document.querySelectorAll('.settings-alert-dot').forEach(dot => {
    dot.style.display = show ? 'block' : 'none';
  });
}

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
  updateSettingsIndicator();
});

// ============================================================
// APP RESUME SYNC — Handles mobile tab switch / app reopen
// When user leaves and returns, sync from the database to catch
// any changes made while they were away (e.g. device removed)
// ============================================================
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.log('📱 App resumed — syncing devices from server...');
    // Re-sync from database (source of truth)
    syncDevicesFromAPI();
    // Refresh settings indicator
    updateSettingsIndicator();
    // If WebSocket disconnected while in background, reconnect
    if (socket && !socket.connected) {
      console.log('🔄 WebSocket disconnected while in background, reconnecting...');
      socket.connect();
    }
  }
});

// Also handle bfcache restoration (iOS Safari back-forward cache)
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    console.log('📱 Page restored from bfcache — syncing devices...');
    syncDevicesFromAPI();
    if (socket && !socket.connected) {
      socket.connect();
    }
  }
});


