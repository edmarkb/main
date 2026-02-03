// ============================================================
// WEBSOCKET CLIENT - Real-time Device Synchronization
// ============================================================

let socket = null;
let isWebSocketReady = false;

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
    
    // Request current device list from server (only on pages with device management)
    if (typeof devices !== 'undefined') {
      socket.emit('request-devices');
    
      // If we have devices, share them with server (first client becomes source of truth)
      if (devices && devices.length > 0) {
        socket.emit('share-devices', devices.map(d => ({
        name: d.name,
        espUrl: d.espUrl,
        simulate: d.simulate,
        temperature: d.temperature,
        humidity: d.humidity,
        gas: d.gas,
        online: d.online
      })));
      }
    }
  });

  // Receive synced device list from server (for new clients or reconnections)
  socket.on('sync-devices', (deviceList) => {
    if (!deviceList || typeof devices === 'undefined') return;
    
    console.log(`📋 Syncing ${deviceList.length} devices from server`);
    
    // Merge server devices with local devices
    // For each device from server, check if it exists locally
    let updatedCount = 0;
    deviceList.forEach(serverDevice => {
      const localIndex = devices.findIndex(d => d.name === serverDevice.name && d.espUrl === serverDevice.espUrl);
      if (localIndex === -1) {
        // New device from server - add it
        const newDev = new Device(serverDevice.name, serverDevice.espUrl, serverDevice.simulate);
        newDev.temperature = serverDevice.temperature || null;
        newDev.humidity = serverDevice.humidity || null;
        newDev.gas = serverDevice.gas || null;
        newDev.online = serverDevice.online || false;
        devices.push(newDev);
        updatedCount++;
      }
    });
    
    // Remove local devices that don't exist on server (they were deleted on other devices)
    devices = devices.filter(localDevice => 
      deviceList.some(serverDevice => serverDevice.name === localDevice.name && serverDevice.espUrl === localDevice.espUrl)
    );
    
    if (updatedCount > 0 || devices.length !== deviceList.length) {
      saveDevices();
      renderDevices();
      if (updatedCount > 0) {
        showToast(`Synced ${updatedCount} new device(s) from network`, 'info');
      }
    }
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
    
    // Check if device already exists locally
    const exists = devices.some(d => d.name === device.name && d.espUrl === device.espUrl);
    if (!exists) {
      // Add device locally
      const newDev = new Device(device.name, device.espUrl, device.simulate);
      newDev.temperature = device.temperature || 0;
      newDev.humidity = device.humidity || 0;
      newDev.gas = device.gas || 0;
      newDev.online = device.online || false;
      
      devices.push(newDev);
      saveDevices();
      
      if (typeof renderDevices === 'function') {
        renderDevices();
      }
      
      showToast(`${device.name} added by another user`, 'info');
    }
  });

  // Device removed by another user
  socket.on('device-removed', (deviceName) => {
    if (typeof devices === 'undefined') return;
    
    console.log('🗑️  Device removed:', deviceName);
    
    const deviceIndex = devices.findIndex(d => d.name === deviceName);
    if (deviceIndex !== -1) {
      // Clear localStorage for this device
      const device = devices[deviceIndex];
      let acesId = 'ACES-1';
      if (device.espUrl.includes('192.168.100.70')) acesId = 'ACES-1';
      else if (device.espUrl.includes('192.168.100.71')) acesId = 'ACES-2';
      else if (device.espUrl.includes('192.168.100.72')) acesId = 'ACES-3';
      
      localStorage.removeItem(`deviceActivityLogs_${acesId}`);
      localStorage.removeItem(`bfpContactNumber_${acesId}`);
      
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

  // Device status changed
  socket.on('device-status-changed', (data) => {
    if (typeof devices === 'undefined') return;
    
    const device = devices.find(d => d.name === data.deviceName);
    if (device) {
      device.online = data.status === 'online';
      
      if (typeof renderDevices === 'function') {
        renderDevices();
      }
    }
  });

  // Active clients count
  socket.on('active-clients', (count) => {
    console.log(`👥 Active users: ${count}`);
  });

  // Manual alarm state changed by another user
  socket.on('alarm-state-changed', (data) => {
    // Update UI if on device detail page for this device
    const alarmBtn = document.getElementById('manualAlarmBtn');
    if (alarmBtn) {
      console.log(`🔔 Updating alarm button for ${data.deviceName}: ${data.isActive ? 'ACTIVE' : 'INACTIVE'}`);
      if (data.isActive) {
        alarmBtn.classList.add('is-active');
      } else {
        alarmBtn.classList.remove('is-active');
      }
    }
    
    // Always save to localStorage using the acesId from the event data
    // This works even on pages without the devices array (like logs page)
    const acesId = data.acesId || 'ACES-1';
    localStorage.setItem(`manualAlarm_${acesId}`, data.isActive ? 'true' : 'false');
    
    showToast(`${data.deviceName} alarm ${data.isActive ? 'activated' : 'deactivated'}`, 'warning');
  });

  // BFP numbers updated by another user
  socket.on('bfp-numbers-changed', (data) => {
    if (typeof devices === 'undefined') {
      showToast(`${data.deviceName} BFP numbers updated`, 'info');
      return;
    }
    
    const device = devices.find(d => d.name === data.deviceName);
    if (device) {
      // Update local storage for BFP numbers
      let acesId = 'ACES-1';
      if (device.espUrl.includes('192.168.100.70')) acesId = 'ACES-1';
      else if (device.espUrl.includes('192.168.100.71')) acesId = 'ACES-2';
      else if (device.espUrl.includes('192.168.100.72')) acesId = 'ACES-3';
      
      localStorage.setItem(`bfpContactNumber_${acesId}`, JSON.stringify(data.numbers));
      showToast(`${data.deviceName} BFP numbers updated`, 'info');
    }
  });

  // BFP dispatch notification for all devices
  socket.on('bfp-dispatch', (data) => {
    console.log('🚨 BFP Dispatch received:', data.deviceName, 'at', data.phoneNumber);
    showToast(`${data.deviceName} - Emergency dispatched to BFP at ${data.phoneNumber}`, 'success', 4000);
  });

  // Alert contacts updated by another user
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
      name: device.name,
      espUrl: device.espUrl,
      simulate: device.simulate,
      temperature: device.temperature,
      humidity: device.humidity,
      gas: device.gas,
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

// Call this when manual alarm state changes
function emitAlarmStateChanged(deviceName, isActive, acesId) {
  if (socket && isWebSocketReady) {
    socket.emit('alarm-state-changed', {
      deviceName: deviceName,
      isActive: isActive,
      acesId: acesId || 'ACES-1'
    });
  }
}

// Call this when BFP numbers are saved
function emitBFPNumbersChanged(deviceName, numbers) {
  if (socket && isWebSocketReady) {
    socket.emit('bfp-numbers-changed', {
      deviceName: deviceName,
      numbers: numbers
    });
  }
}

// Call this when BFP dispatch is triggered
function emitBFPDispatch(deviceName, phoneNumber) {
  if (socket && isWebSocketReady) {
    socket.emit('bfp-dispatch', {
      deviceName: deviceName,
      phoneNumber: phoneNumber
    });
  }
}

// Call this when alert contacts are added/removed
function emitAlertContactsChanged(contacts) {
  if (socket && isWebSocketReady) {
    socket.emit('alert-contacts-changed', {
      contacts: contacts
    });
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Small delay to ensure Socket.IO library is loaded
  setTimeout(initWebSocket, 100);
});


