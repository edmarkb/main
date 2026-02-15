// Backend API Configuration
// Change this when deploying to production or different server

const API_CONFIG = {
  // Backend server URL - dynamically uses current host
  BASE_URL: `${window.location.protocol}//${window.location.host}`,
  
  // API Endpoints
  ENDPOINTS: {
    // Logs endpoints
    GET_LOGS: '/api/logs',
    CREATE_LOG: '/api/logs',
    DELETE_LOG: '/api/logs/:id',
    CLEAR_LOGS: '/api/logs/clear',
    
    // Device endpoints
    GET_DEVICES: '/api/devices',
    GET_ACTIVE_DEVICES: '/api/devices/active',
    UPDATE_DEVICE: '/api/devices/:id',
    
    // Sensor data endpoints
    GET_SENSOR_READINGS: '/api/sensor-data/readings',
    GET_THRESHOLDS: '/api/sensor-data/thresholds',
    
    // Alert contacts endpoints
    GET_ALERT_CONTACTS: '/api/alert-contacts',
    UPDATE_ALERT_CONTACTS: '/api/alert-contacts',

    // Events endpoints (backend handles logging automatically)
    LOG_EVENT: '/api/events',
  },
  
  // Timeout for API calls (ms)
  TIMEOUT: 5000,
  
  // Enable/disable API calls (for development)
  ENABLE_API: true,
  
  // Use sample data as fallback if API is down
  USE_FALLBACK: true
};

// Helper function to construct full API URL
function getApiUrl(endpoint) {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}

// Helper function to make API calls with error handling
async function apiCall(method, endpoint, data = null) {
  try {
    if (!API_CONFIG.ENABLE_API) {
      console.warn('API calls are disabled in config');
      return null;
    }

    const url = getApiUrl(endpoint);
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API call failed (${method} ${endpoint}):`, error.message);
    
    if (API_CONFIG.USE_FALLBACK) {
      console.warn('Using fallback data...');
      return null;
    }
    
    throw error;
  }
}

// ============================================================
// TOAST NOTIFICATION SYSTEM (Mobile-Friendly)
// ============================================================

// Create toast container if it doesn't exist
function ensureToastContainer() {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

// Show toast notification
// type: 'success', 'error', 'warning', 'info'
function showToast(message, type = 'info', duration = 3000) {
  const container = ensureToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  // Click to dismiss
  toast.addEventListener('click', () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  });
  
  container.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // Auto dismiss
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
  
  return toast;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API_CONFIG, getApiUrl, apiCall, showToast };
}
