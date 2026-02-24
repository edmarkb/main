// ============================================
// REPORT GENERATION MODULE
// Supports PDF, TXT, and CSV formats
// ============================================

// Load logs from API with fallback to sample data
async function loadLogsFromAPI() {
  // If API is disabled in config, use sample data immediately
  if (!API_CONFIG.ENABLE_API || !API_CONFIG.USE_FALLBACK) {
    return sampleLogs;
  }
  
  try {
    const data = await apiCall('GET', API_CONFIG.ENDPOINTS.GET_LOGS);
    if (data && Array.isArray(data.logs) && data.logs.length > 0) {
      return data.logs;
    }
  } catch (error) {
    console.error('Failed to load logs from API:', error);
  }
  
  // Fallback to sample data if API is unavailable or returns empty
  return sampleLogs;
}

// Toggle report dropdown menu
function toggleReportMenu(menuId) {
  const menu = document.getElementById(menuId);
  if (menu) {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }
}

// Close report menu when clicking elsewhere
document.addEventListener('click', function(event) {
  const reportDropdowns = document.querySelectorAll('.report-dropdown');
  reportDropdowns.forEach(dropdown => {
    const menu = dropdown.querySelector('.report-menu');
    if (menu && !dropdown.contains(event.target)) {
      menu.style.display = 'none';
    }
  });
});

// Setup report button listeners
document.addEventListener('DOMContentLoaded', function() {
  const generateReportBtn = document.getElementById('generateReportBtn');
  if (generateReportBtn) {
    generateReportBtn.addEventListener('click', function() {
      toggleReportMenu('reportMenu');
    });
  }

  const deviceReportBtn = document.getElementById('deviceReportBtn');
  if (deviceReportBtn) {
    deviceReportBtn.addEventListener('click', function() {
      toggleReportMenu('deviceReportMenu');
    });
  }
});

// ============================================
// LOGS PAGE REPORT GENERATION
// ============================================
async function generateReport(format) {
  // Close dropdown
  const menu = document.getElementById('reportMenu');
  if (menu) menu.style.display = 'none';

  try {
    // Get the currently visible logs from the page (filtered by device, critical toggle, and clear time)
    let logs = [];
    
    // First, load all logs and apply the same filters as the UI
    const allLogs = await loadLogsFromAPI();
    
    if (!allLogs || allLogs.length === 0) {
      showToast('No logs available to generate report', 'warning');
      return;
    }
    
    // Apply clear time filter (only logs after clear timestamp)
    const logsClearedTime = localStorage.getItem('acesLogsClearedTime');
    if (logsClearedTime) {
      const clearedTimestamp = parseInt(logsClearedTime);
      logs = allLogs.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime > clearedTimestamp;
      });
    } else {
      logs = allLogs;
    }
    
    // Apply device filter (if selected)
    const deviceFilter = document.getElementById('deviceFilter');
    if (deviceFilter && deviceFilter.value !== 'all') {
      const deviceMap = {
        'aces1': 'ACES-1',
        'aces2': 'ACES-2',
        'aces3': 'ACES-3'
      };
      const targetDeviceId = deviceMap[deviceFilter.value];
      logs = logs.filter(log => log.deviceId === targetDeviceId);
    }
    
    // Apply status filter (if set)
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter && statusFilter.value !== 'all') {
      const selectedStatus = statusFilter.value;
      logs = logs.filter(log => {
        const status = getEventStatus(log.eventType);
        return status === selectedStatus;
      });
    }
    
    if (logs.length === 0) {
      showToast('No logs to generate report (all filtered out)', 'warning');
      return;
    }

    const timestamp = new Date().toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    let content = '';
    let filename = `ACES_IoT_Logs_Report_${new Date().toISOString().split('T')[0]}`;

    if (format === 'pdf') {
      content = generatePDFReport(logs, timestamp);
      downloadPDF(content, filename);
    } else if (format === 'txt') {
      content = generateTXTReport(logs, timestamp);
      downloadTXT(content, filename);
    } else if (format === 'csv') {
      content = generateCSVReport(logs);
      downloadCSV(content, filename);
    }
  } catch (error) {
    console.error('Error generating report:', error);
    showToast('Failed to generate report', 'error');
  }
}

// ============================================
// DEVICE ACTIVITY LOG REPORT GENERATORS
// ============================================

function generateActivityLogPDF(logs, deviceName, timestamp) {
  let html = '';
  html += '<!DOCTYPE html><html><head>';
  html += '<style>';
  html += 'body { font-family: Arial, sans-serif; margin: 20px; }';
  html += 'h1 { text-align: center; color: #333; }';
  html += 'table { width: 100%; border-collapse: collapse; margin-top: 20px; }';
  html += 'th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }';
  html += 'th { background-color: #4CAF50; color: white; }';
  html += '.summary { margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #4CAF50; }';
  html += '.timestamp { text-align: center; color: #666; margin-bottom: 20px; }';
  html += '.info-row { background-color: #e3f2fd !important; }';
  html += '.warning-row { background-color: #fff3e0 !important; }';
  html += '.danger-row { background-color: #ffebee !important; }';
  html += '</style>';
  html += '</head><body>';

  html += `<h1>Device Activity Log - ${deviceName}</h1>`;
  html += `<div class="timestamp">Generated: ${timestamp}</div>`;

  // Summary
  const typeCounts = {
    info: 0,
    warning: 0,
    danger: 0
  };

  logs.forEach(log => {
    if (typeCounts.hasOwnProperty(log.type)) {
      typeCounts[log.type]++;
    }
  });

  html += '<div class="summary">';
  html += '<strong>Summary:</strong><br>';
  html += `Total Entries: ${logs.length}<br>`;
  html += `Info: ${typeCounts.info} | Warnings: ${typeCounts.warning} | Critical: ${typeCounts.danger}`;
  html += '</div>';

  // Table
  html += '<table>';
  html += '<tr><th>Timestamp</th><th>Message</th><th>Type</th></tr>';

  logs.forEach(log => {
    let rowClass = 'info-row';
    if (log.type === 'danger') {
      rowClass = 'danger-row';
    } else if (log.type === 'warning') {
      rowClass = 'warning-row';
    }
    
    html += `<tr class="${rowClass}">`;
    html += `<td>${log.timestamp}</td>`;
    html += `<td>${log.message}</td>`;
    html += `<td>${log.type.toUpperCase()}</td>`;
    html += '</tr>';
  });

  html += '</table>';
  html += '</body></html>';

  return html;
}

function generateActivityLogTXT(logs, deviceName, timestamp) {
  let report = '';
  report += '╔════════════════════════════════════════════════════════════╗\n';
  report += `║         Device Activity Log - ${deviceName.padEnd(27)}║\n`;
  report += '╚════════════════════════════════════════════════════════════╝\n\n';
  
  report += `Generated: ${timestamp}\n`;
  report += `Total Entries: ${logs.length}\n\n`;

  logs.forEach(log => {
    report += `[${log.timestamp}] (${log.type.toUpperCase()}) ${log.message}\n`;
  });

  return report;
}

function generateActivityLogCSV(logs, deviceName, timestamp) {
  let csv = `Generated: ${timestamp}\nDevice Activity Log\n\n`;
  csv += `Device,Timestamp,Message,Type\n`;

  logs.forEach(log => {
    csv += `"${deviceName}","${log.timestamp}","${log.message}","${log.type}"\n`;
  });

  return csv;
}

// ============================================
// DEVICE ACTIVITY LOG REPORT GENERATION
// ============================================
async function generateActivityLogReport(format) {
  // Close dropdown
  const menu = document.getElementById('deviceReportMenu');
  if (menu) menu.style.display = 'none';

  try {
    const deviceName = document.getElementById('detDeviceName').textContent;
    
    // Get logs from DOM
    let logsToReport = getActivityLogsFromDOM();
    
    if (!logsToReport || logsToReport.length === 0) {
      showToast('No device activity logs to report', 'warning');
      return;
    }

    const timestamp = new Date().toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    let content = '';
    let filename = `${deviceName.replace(/\s+/g, '_')}_ActivityLog_${new Date().toISOString().split('T')[0]}`;

    if (format === 'pdf') {
      content = generateActivityLogPDF(logsToReport, deviceName, timestamp);
      downloadPDF(content, filename);
    } else if (format === 'txt') {
      content = generateActivityLogTXT(logsToReport, deviceName, timestamp);
      downloadTXT(content, filename);
    } else if (format === 'csv') {
      content = generateActivityLogCSV(logsToReport, deviceName, timestamp);
      downloadCSV(content, filename);
    }
  } catch (error) {
    console.error('Error generating device activity report:', error);
    showToast('Failed to generate report', 'error');
  }
}

// Helper function to extract device activity logs from DOM
function getActivityLogsFromDOM() {
  const logList = document.getElementById('deviceLogList');
  if (!logList) return [];
  
  const logs = [];
  const logEntries = logList.querySelectorAll('div');
  
  logEntries.forEach(entry => {
    const dateEl = entry.querySelector('.log-date');
    const timeEl = entry.querySelector('.log-time');
    const msgEl = entry.querySelector('.log-msg');
    const dotEl = entry.querySelector('.status-dot');
    
    if (timeEl && msgEl) {
      // Combine date and time, or use time only if date is not available
      const date = dateEl ? dateEl.textContent.trim() : '';
      const time = timeEl.textContent.trim();
      const timestamp = date ? `${date} ${time}` : time;
      const message = msgEl.textContent.trim();
      
      // Determine type from dot color
      let type = 'info';
      if (dotEl) {
        const color = dotEl.style.background;
        if (color.includes('ef4444') || color === '#ef4444') type = 'danger';
        else if (color.includes('fcc419') || color === '#fcc419') type = 'warning';
      }
      
      logs.push({
        timestamp: timestamp,
        message: message,
        type: type,
        fullTimestamp: new Date().toISOString()
      });
    }
  });
  
  return logs;
}

// Keep old generateDeviceReport for backward compatibility (if needed)
async function generateDeviceReport(format) {
  return generateActivityLogReport(format);
}

// Helper function to get device ID from name
function getDeviceIdFromName(name) {
  if (name.includes('Computer Laboratory 1')) return 'ACES-1';
  if (name.includes('Computer Laboratory 2')) return 'ACES-2';
  if (name.includes('Food Laboratory')) return 'ACES-3';
  return '';
}

// ============================================
// REPORT FORMAT GENERATORS
// ============================================

function generateTXTReport(logs, timestamp, deviceFilter = null) {
  let report = '';
  report += '╔════════════════════════════════════════════════════════════╗\n';
  report += '║           ACES IoT - Event Logs Report (TXT)              ║\n';
  report += '╚════════════════════════════════════════════════════════════╝\n\n';
  
  report += `Generated: ${timestamp}\n`;
  report += `Total Events: ${logs.length}\n`;
  report += `────────────────────────────────────────────────────────────\n\n`;

  // Count event types
  const eventCounts = {
    warning: 0,
    critical: 0,
    gas_critical: 0,
    gas_warning: 0,
    smoke_warning: 0,
    device_online: 0,
    device_offline: 0,
    manual_alarm_on: 0,
    manual_alarm_off: 0,
    bfp_alert: 0
  };

  logs.forEach(log => {
    if (eventCounts.hasOwnProperty(log.eventType)) {
      eventCounts[log.eventType]++;
    }
  });

  report += 'EVENT SUMMARY:\n';
  report += `  Smoke Warnings: ${eventCounts.smoke_warning}\n`;
  report += `  Gas Warnings: ${eventCounts.gas_warning}\n`;
  report += `  Gas Critical: ${eventCounts.gas_critical}\n`;
  report += `  Heat/Other Warnings: ${eventCounts.warning}\n`;
  report += `  Critical: ${eventCounts.critical}\n`;
  report += `  BFP Alerts: ${eventCounts.bfp_alert}\n`;
  report += `  Device Online: ${eventCounts.device_online}\n`;
  report += `  Device Offline: ${eventCounts.device_offline}\n`;
  report += `  Manual Alarm On: ${eventCounts.manual_alarm_on}\n`;
  report += `  Manual Alarm Off: ${eventCounts.manual_alarm_off}\n`;
  report += '────────────────────────────────────────────────────────────\n\n';

  report += 'EVENT LOG ENTRIES:\n';
  report += '────────────────────────────────────────────────────────────\n\n';

  logs.forEach((log, index) => {
    report += `${index + 1}. ${log.labName} (${log.deviceId})\n`;
    report += `   Date: ${log.timestamp}\n`;
    report += `   Event: ${log.eventType.replace(/_/g, ' ').toUpperCase()}\n`;
    report += `   Message: ${log.alertMessage}\n`;
    report += `   Sensors:\n`;
    report += `     • Temperature: ${log.temperature}°C\n`;
    report += `     • Humidity: ${log.humidity}%\n`;
    report += `     • Gas: ${log.gas} ppm\n\n`;
  });

  report += '────────────────────────────────────────────────────────────\n';
  report += 'End of Report\n';

  return report;
}

function generatePDFReport(logs, timestamp, deviceFilter = null) {
  // Helper function to get color for event type
  function getEventColor(eventType) {
    if (eventType === 'critical' || eventType === 'gas_critical' || eventType === 'bfp_alert') {
      return '#ffebee'; // Light red for critical
    }
    if (eventType === 'warning' || eventType === 'gas_warning' || eventType === 'smoke_warning' || eventType === 'manual_alarm_on' || eventType === 'device_offline') {
      return '#fff3e0'; // Light orange for warning
    }
    return '#f1f8e9'; // Light green for safe
  }

  // Note: This requires a PDF library. For now, we'll use html2pdf
  // The actual PDF generation will be handled by downloading as HTML
  // and converting on the server side, or using a library like jsPDF
  
  let html = '';
  html += '<!DOCTYPE html><html><head>';
  html += '<style>';
  html += 'body { font-family: Arial, sans-serif; margin: 20px; }';
  html += 'h1 { text-align: center; color: #333; }';
  html += 'table { width: 100%; border-collapse: collapse; margin-top: 20px; }';
  html += 'th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }';
  html += 'th { background-color: #4CAF50; color: white; }';
  html += '.summary { margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #4CAF50; }';
  html += '.timestamp { text-align: center; color: #666; margin-bottom: 20px; }';
  html += '.critical-row { background-color: #ffebee !important; }';
  html += '.warning-row { background-color: #fff3e0 !important; }';
  html += '.safe-row { background-color: #f1f8e9 !important; }';
  html += '</style>';
  html += '</head><body>';

  html += '<h1>ACES IoT - Event Logs Report</h1>';
  html += `<div class="timestamp">Generated: ${timestamp}</div>`;

  // Summary
  const eventCounts = {
    warning: 0,
    critical: 0,
    gas_critical: 0,
    gas_warning: 0,
    smoke_warning: 0,
    device_online: 0,
    device_offline: 0,
    manual_alarm_on: 0,
    manual_alarm_off: 0,
    bfp_alert: 0
  };

  logs.forEach(log => {
    if (eventCounts.hasOwnProperty(log.eventType)) {
      eventCounts[log.eventType]++;
    }
  });

  html += '<div class="summary">';
  html += '<strong>Summary:</strong><br>';
  html += `Total Events: ${logs.length}<br>`;
  html += `Smoke Warnings: ${eventCounts.smoke_warning} | `;
  html += `Gas Warnings: ${eventCounts.gas_warning} | `;
  html += `Gas Critical: ${eventCounts.gas_critical} | `;
  html += `Heat/Other Warnings: ${eventCounts.warning} | `;
  html += `Critical: ${eventCounts.critical} | `;
  html += `BFP Alerts: ${eventCounts.bfp_alert}`;
  html += '</div>';

  // Table
  html += '<table>';
  html += '<tr><th>Lab Name</th><th>Device ID</th><th>Timestamp</th><th>Event</th><th>Message</th><th>Temp</th><th>Humidity</th><th>Gas</th></tr>';

  logs.forEach(log => {
    let rowClass = 'safe-row';
    if (log.eventType === 'critical' || log.eventType === 'gas_critical' || log.eventType === 'bfp_alert') {
      rowClass = 'critical-row';
    } else if (log.eventType === 'warning' || log.eventType === 'gas_warning' || log.eventType === 'smoke_warning' || log.eventType === 'manual_alarm_on' || log.eventType === 'device_offline') {
      rowClass = 'warning-row';
    }
    
    html += `<tr class="${rowClass}">`;
    html += `<td>${log.labName}</td>`;
    html += `<td>${log.deviceId}</td>`;
    html += `<td>${log.timestamp}</td>`;
    html += `<td>${log.eventType.replace(/_/g, ' ').toUpperCase()}</td>`;
    html += `<td>${log.alertMessage}</td>`;
    html += `<td>${log.temperature}°C</td>`;
    html += `<td>${log.humidity}%</td>`;
    html += `<td>${log.gas} ppm</td>`;
    html += '</tr>';
  });

  html += '</table>';
  html += '</body></html>';

  return html;
}

function generateCSVReport(logs) {
  let csv = 'Lab Name,Device ID,Timestamp,Event Type,Alert Message,Temperature (°C),Humidity (%),Gas (ppm),Severity\n';

  logs.forEach(log => {
    let severity = 'INFO';
    if (log.eventType === 'critical' || log.eventType === 'gas_critical' || log.eventType === 'bfp_alert') {
      severity = 'CRITICAL';
    } else if (log.eventType === 'warning' || log.eventType === 'gas_warning' || log.eventType === 'smoke_warning' || log.eventType === 'manual_alarm_on' || log.eventType === 'device_offline') {
      severity = 'WARNING';
    }
    
    csv += `"${log.labName}","${log.deviceId}","${log.timestamp}","${log.eventType}","${log.alertMessage}",${log.temperature},${log.humidity},${log.gas},"${severity}"\n`;
  });

  return csv;
}

// ============================================
// FILE DOWNLOAD FUNCTIONS
// ============================================

function downloadTXT(content, filename) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
  element.setAttribute('download', filename + '.txt');
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

function downloadCSV(content, filename) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(content));
  element.setAttribute('download', filename + '.csv');
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

function downloadPDF(htmlContent, filename) {
  // For PDF, we'll download as HTML and let browser's print-to-PDF feature work
  // Or use a library like jsPDF for better control
  
  // For now, save as HTML (user can print to PDF using browser)
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
  element.setAttribute('download', filename + '.html');
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  
  // Note: For better PDF generation, you can integrate:
  // - jsPDF library (lightweight)
  // - html2pdf library (converts HTML to PDF)
  // - Backend PDF generation (more professional)
}
