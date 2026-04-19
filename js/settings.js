// ================================================================
// SETTINGS PAGE — System Configuration + SMS Preview
// ================================================================

// Collapsible section headers
document.querySelectorAll('.settings-section-header[data-collapsible]').forEach(header => {
  header.addEventListener('click', () => {
    header.classList.toggle('expanded');
  });
});

// DOM Elements
const addressInput = document.getElementById('fullAddress');
const bfpInput = document.getElementById('bfpNumber');
const saveBtn = document.getElementById('saveConfigBtn');
const saveStatus = document.getElementById('saveStatus');
const setupBanner = document.getElementById('setupBanner');
const smsPreview = document.getElementById('smsPreview');
const settingsThemeToggle = document.getElementById('settingsThemeToggle');

// Track original values to detect changes
let originalAddress = '';
let originalBfpNumber = '';

// ================================================================
// SETUP COMPLETENESS CHECK
// ================================================================
function isSetupComplete() {
  const hasAddress = !!addressInput.value.trim();
  const hasBfp = !!(bfpInput.value.replace(/\D/g, ''));
  const hasContacts = alertNumbers.length > 0;
  return { hasAddress, hasBfp, hasContacts, complete: hasAddress && hasBfp && hasContacts };
}

function updateSetupBanner() {
  const { hasAddress, hasBfp, hasContacts, complete } = isSetupComplete();
  if (complete) {
    setupBanner.style.display = 'none';
  } else {
    const missing = [];
    if (!hasAddress) missing.push('system address');
    if (!hasBfp) missing.push('BFP contact number');
    if (!hasContacts) missing.push('alert contacts');
    const bannerMsg = setupBanner.querySelector('p');
    if (bannerMsg) {
      bannerMsg.textContent = `Please configure your ${missing.join(', ')} to enable emergency SMS alerts and BFP dispatch.`;
    }
    setupBanner.style.display = 'flex';
  }
  // Update nav indicators on all pages
  if (typeof toggleSettingsDots === 'function') {
    toggleSettingsDots(!complete);
  }
}

// ================================================================
// FETCH SYSTEM CONFIG ON LOAD
// ================================================================
async function loadSystemConfig() {
  try {
    const url = getApiUrl(API_CONFIG.ENDPOINTS.GET_SYSTEM_CONFIG);
    const res = await fetch(url);
    const data = await res.json();

    if (data.success && data.config) {
      addressInput.value = data.config.fullAddress || '';
      originalAddress = addressInput.value;
    }
  } catch (err) {
    console.warn('Could not load system config:', err);
  }

  // Load BFP number from localStorage (synced via WebSocket)
  const savedBfp = localStorage.getItem('globalBFPContactNumber') || '';
  bfpInput.value = savedBfp;
  originalBfpNumber = savedBfp;

  updateSetupBanner();
  updateSaveBtn();
  updateSMSPreview();
  updateCharCounters();
}

// ================================================================
// SAVE SYSTEM CONFIG
// ================================================================
async function saveSystemConfig() {
  const address = addressInput.value.trim();
  const bfpNum = bfpInput.value.replace(/\D/g, '');

  // Validate address — no special characters (SMS safe)
  if (address && ADDRESS_STRIP.test(address)) {
    showSaveStatus('Address contains special characters. Remove them first.', 'error');
    return;
  }

  // Validate BFP number if provided — must be 7-11 digits
  if (bfpNum && (bfpNum.length < 7 || bfpNum.length > 11)) {
    showSaveStatus('BFP number must be 7-11 digits', 'error');
    return;
  }

  const addrChanged = address !== originalAddress;
  const bfpChanged = bfpNum !== originalBfpNumber;

  // Build a summary of what's changing
  const changes = [];
  if (addrChanged) changes.push(address ? 'address' : 'clear address');
  if (bfpChanged) changes.push(bfpNum ? 'BFP number' : 'clear BFP number');

  // If clearing everything, show danger confirm
  if (!address && !bfpNum && (addrChanged || bfpChanged)) {
    const confirmed = await showSettingsConfirm(
      'Clear Configuration?',
      'This will remove the saved address and BFP number. Emergency SMS alerts will be disabled until reconfigured.',
      'Clear All',
      'danger'
    );
    if (!confirmed) return;
  } else {
    // Normal save confirmation
    let msg = 'Save the current configuration?';
    if (addrChanged && address) msg = `Save "<strong>${escapeHTML(address)}</strong>" as the system address?`;
    if (bfpChanged && bfpNum && !addrChanged) msg = `Save <strong>${bfpNum}</strong> as the BFP contact number?`;
    if (addrChanged && bfpChanged) msg = 'Save the updated address and BFP contact number?';

    const confirmed = await showSettingsConfirm(
      'Save Configuration?',
      msg,
      'Save',
      'primary'
    );
    if (!confirmed) return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  // Save address to backend
  try {
    const url = getApiUrl(API_CONFIG.ENDPOINTS.UPDATE_SYSTEM_CONFIG);
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullAddress: address
      })
    });

    const data = await res.json();

    if (data.success) {
      originalAddress = address;
    } else {
      showSaveStatus(data.message || 'Save failed', 'error');
      updateSaveBtn();
      restoreSaveBtnLabel();
      return;
    }
  } catch (err) {
    console.error('Save error:', err);
    showSaveStatus('Network error — could not save', 'error');
    updateSaveBtn();
    restoreSaveBtnLabel();
    return;
  }

  // Save BFP number to localStorage + sync via WebSocket
  if (bfpChanged) {
    localStorage.setItem('globalBFPContactNumber', bfpNum);
    originalBfpNumber = bfpNum;
    if (typeof emitGlobalBFPNumberChanged === 'function') {
      emitGlobalBFPNumberChanged(bfpNum);
    }
  }

  showSaveStatus('Configuration saved successfully', 'success');
  updateSetupBanner();
  updateSaveBtn();
  updateSMSPreview();
  restoreSaveBtnLabel();
}

function showSaveStatus(msg, type) {
  saveStatus.textContent = msg;
  saveStatus.className = 'settings-save-status ' + (type === 'error' ? 'status-error' : 'status-success');
  clearTimeout(saveStatus._timer);
  saveStatus._timer = setTimeout(() => {
    saveStatus.textContent = '';
    saveStatus.className = 'settings-save-status';
  }, 4000);
}

function restoreSaveBtnLabel() {
  setTimeout(() => {
    saveBtn.innerHTML = `<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M840-680v480q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h480l160 160Zm-80 34L646-760H200v560h560v-446ZM480-240q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35ZM240-560h360v-160H240v160Zm-40-86v446-560 114Z"/></svg> Save Configuration`;
  }, 300);
}

// ================================================================
// ENABLE/DISABLE SAVE BUTTON (only when values changed & valid)
// ================================================================
function updateSaveBtn() {
  const addr = addressInput.value.trim();
  const bfp = bfpInput.value.replace(/\D/g, '');
  const hasChanged = addr !== originalAddress || bfp !== originalBfpNumber;
  saveBtn.disabled = !hasChanged;
}

// ================================================================
// CHARACTER COUNTER
// ================================================================
const addrCharCount = document.getElementById('addrCharCount');
const bfpCharCount = document.getElementById('bfpCharCount');

function updateCharCounters() {
  const addrLen = addressInput.value.length;
  const addrMax = parseInt(addressInput.maxLength) || 60;
  if (addrCharCount) {
    addrCharCount.textContent = `${addrLen} / ${addrMax}`;
    addrCharCount.classList.toggle('char-count-warn', addrLen >= addrMax);
  }
  const bfpLen = bfpInput.value.replace(/\D/g, '').length;
  if (bfpCharCount) {
    bfpCharCount.textContent = `${bfpLen} / 11`;
    bfpCharCount.classList.toggle('char-count-warn', bfpLen > 0 && bfpLen < 7);
  }
}

// ================================================================
// LIVE SMS PREVIEW
// ================================================================
function updateSMSPreview() {
  const addr = addressInput.value.trim();

  if (!addr) {
    smsPreview.innerHTML = '<span class="sms-preview-placeholder">Enter an address above to see a preview.</span>';
    return;
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const sampleDevice = 'Sample Lab';

  // --- Compute raw SMS lengths (matching backend \r\n join) ---
  // Alert SMS: worst-case single alert = "FIRE"
  const alertRaw = [
    'ACES ALERT: FIRE',
    `Loc: ${sampleDevice}`,
    `Addr: ${addr}`,
    `Time: ${timeStr}`,
    'Respond immediately.'
  ].join('\r\n');
  const alertLen = alertRaw.length;

  // BFP Dispatch SMS
  const bfpRaw = [
    'ACES FIRE ALERT',
    `Loc: ${sampleDevice}`,
    `Addr: ${addr}`,
    `Time: ${timeStr}`,
    'BFP dispatch requested. Respond immediately.'
  ].join('\r\n');
  const bfpLen = bfpRaw.length;

  const maxSMS = 160;
  function charBadge(len) {
    const cls = len > maxSMS ? 'sms-char-badge over' : len > maxSMS - 20 ? 'sms-char-badge warn' : 'sms-char-badge ok';
    return `<span class="${cls}">${len} / ${maxSMS} chars</span>`;
  }

  // Alert SMS preview
  const alertLines = [
    '<strong>ACES ALERT: FIRE</strong>',
    `Loc: ${sampleDevice}`,
    `Addr: ${addr}`,
    `Time: ${timeStr}`,
    'Respond immediately.'
  ].join('<br>');

  // BFP Dispatch SMS preview
  const bfpLines = [
    '<strong>ACES FIRE ALERT</strong>',
    `Loc: ${sampleDevice}`,
    `Addr: ${addr}`,
    `Time: ${timeStr}`,
    'BFP dispatch requested. Respond immediately.'
  ].join('<br>');

  smsPreview.innerHTML =
    `<div class="sms-line sms-label">Alert SMS to Contacts: ${charBadge(alertLen)}</div>` +
    `<div class="sms-line sms-msg">${alertLines}</div>` +
    `<div class="sms-line sms-divider"></div>` +
    `<div class="sms-line sms-label">BFP Dispatch SMS: ${charBadge(bfpLen)}</div>` +
    `<div class="sms-line sms-msg">${bfpLines}</div>`;
}

// ================================================================
// ADDRESS VALIDATION — GSM 7-bit safe characters only (SIM800L)
// The SIM800L uses GSM 03.38 encoding: 160 chars/SMS.
// ANY character outside this charset forces UCS-2 = only 70 chars/SMS.
// Allowlist: common address characters that are in the GSM 7-bit table.
//   Letters, digits, space, . , - ' # / ( ) ñ Ñ
// ================================================================
const ADDRESS_ALLOWED = /^[a-zA-Z0-9\s.,\-'#\/ñÑ()]*$/;
const ADDRESS_STRIP = /[^a-zA-Z0-9\s.,\-'#\/ñÑ()]/g;
const addrWarning = document.getElementById('addrValidationWarn');

function validateAddress() {
  const raw = addressInput.value;
  const stripped = raw.replace(ADDRESS_STRIP, '');
  if (raw !== stripped) {
    // Replace with cleaned value, preserving cursor
    const pos = addressInput.selectionStart - (raw.length - stripped.length);
    addressInput.value = stripped;
    addressInput.setSelectionRange(Math.max(0, pos), Math.max(0, pos));
    // Flash warning
    if (addrWarning) {
      addrWarning.textContent = 'Special characters are not allowed (SMS limit).';
      addrWarning.style.display = 'block';
      clearTimeout(addrWarning._hideTimer);
      addrWarning._hideTimer = setTimeout(() => { addrWarning.style.display = 'none'; }, 3000);
    }
  }
}

// ================================================================
// INPUT LISTENERS
// ================================================================
addressInput.addEventListener('input', () => {
  validateAddress();
  updateSaveBtn();
  updateSMSPreview();
  updateCharCounters();
});

// Also block on paste
addressInput.addEventListener('paste', () => {
  setTimeout(() => {
    validateAddress();
    updateSaveBtn();
    updateSMSPreview();
    updateCharCounters();
  }, 0);
});

// BFP input: restrict to digits only, max 11
bfpInput.addEventListener('input', () => {
  bfpInput.value = bfpInput.value.replace(/\D/g, '').substring(0, 11);
  updateSaveBtn();
  updateCharCounters();
});

saveBtn.addEventListener('click', saveSystemConfig);

// ================================================================
// APPEARANCE — THEME TOGGLE (icon-based)
// ================================================================
const sunSVG = '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M440-760v-160h80v160h-80Zm266 110-55-55 112-115 56 57-113 113Zm54 210v-80h160v80H760ZM440-40v-160h80v160h-80ZM254-652 140-763l57-56 113 113-56 54Zm508 512L651-255l54-54 114 110-57 59ZM40-440v-80h160v80H40Zm157 300-56-57 112-112 29 27 29 28-114 114Zm283-100q-100 0-170-70t-70-170q0-100 70-170t170-70q100 0 170 70t70 170q0 100-70 170t-170 70Z"/></svg>';
const moonSVG = '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M483-80q-84 0-157.5-32t-128-86.5Q143-253 111-326.5T79-484q0-146 93-257.5T409-880q-18 99 11 193.5T520-521q71 71 165.5 100T879-410q-26 144-138 237T483-80Z"/></svg>';

function updateSettingsThemeIcon() {
  const isDark = document.documentElement.classList.contains('dark-mode');
  const iconEl = document.getElementById('settingsThemeIcon');
  if (iconEl) {
    iconEl.innerHTML = isDark ? sunSVG : moonSVG;
  }
}

if (settingsThemeToggle) {
  settingsThemeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark-mode');
    if (isDark) {
      document.documentElement.classList.remove('dark-mode');
      document.body.classList.remove('dark-mode');
      localStorage.setItem('acesTheme', 'light');
    } else {
      document.documentElement.classList.add('dark-mode');
      document.body.classList.add('dark-mode');
      localStorage.setItem('acesTheme', 'dark');
    }
    updateSettingsThemeIcon();
  });
}

// ================================================================
// ALERT CONTACTS (inline settings section)
// ================================================================
let alertNumbers = JSON.parse(localStorage.getItem('alertNumbers')) || [];

function renderNumbers() {
  const list = document.getElementById('numbersList');
  if (!list) return;
  list.innerHTML = '';
  if (alertNumbers.length === 0) {
    list.innerHTML = '<li class="settings-contacts-empty">No alert contacts added yet.</li>';
    return;
  }
  alertNumbers.forEach((num, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="number-display">${num}</span>
      <button class="delete-btn-modal" onclick="removeNumber(${i})">Delete</button>
    `;
    list.appendChild(li);
  });
}

window.removeNumber = async function(i) {
  const num = alertNumbers[i];
  const confirmed = await showSettingsConfirm(
    'Remove Contact?',
    `Remove <strong>${num}</strong> from alert contacts? They will no longer receive emergency SMS.`,
    'Remove',
    'danger'
  );
  if (!confirmed) return;
  alertNumbers.splice(i, 1);
  localStorage.setItem('alertNumbers', JSON.stringify(alertNumbers));
  renderNumbers();
  updateSetupBanner();
  if (typeof showToast === 'function') showToast('Contact removed', 'success');
  if (typeof emitAlertContactsChanged === 'function') emitAlertContactsChanged(alertNumbers);
};

const addNumberBtn = document.getElementById('addNumberBtn');
const newNumberInput = document.getElementById('newNumber');

if (addNumberBtn) {
  addNumberBtn.addEventListener('click', async () => {
    let val = newNumberInput.value.replace(/\D/g, '');
    if (val.length !== 11) return showToast ? showToast('Please enter a valid 11-digit phone number', 'error') : alert('Please enter a valid 11-digit phone number');
    if (alertNumbers.includes(val)) return showToast ? showToast('Number already exists', 'warning') : alert('Number already exists');
    if (alertNumbers.length >= 5) return showToast ? showToast('Max 5 contacts allowed', 'warning') : alert('Max 5 contacts allowed');

    const confirmed = await showSettingsConfirm(
      'Add Contact?',
      `Add <strong>${val}</strong> as an alert contact?<br><br>` +
      `This number will receive SMS notifications for:<br><br>` +
      `<span style="text-align:left;display:inline-block;line-height:1.7;">` +
      `&bull; Fire detection<br>` +
      `&bull; Siren activation or deactivation<br>` +
      `&bull; Critical conditions (smoke, gas leaks, and high temperature)</span>`,
      'Add Contact',
      'primary'
    );
    if (!confirmed) return;

    alertNumbers.push(val);
    localStorage.setItem('alertNumbers', JSON.stringify(alertNumbers));
    newNumberInput.value = '';
    renderNumbers();
    updateSetupBanner();
    if (typeof showToast === 'function') showToast('Contact added successfully', 'success');
    if (typeof emitAlertContactsChanged === 'function') emitAlertContactsChanged(alertNumbers);
  });
}

if (newNumberInput) {
  newNumberInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 11);
  });
}

// ================================================================
// CONFIRMATION DIALOG
// ================================================================
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showSettingsConfirm(title, message, confirmLabel = 'Confirm', type = 'primary') {
  return new Promise(resolve => {
    // Remove any existing dialog
    const existing = document.getElementById('settingsConfirmOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'settingsConfirmOverlay';
    overlay.className = 'settings-confirm-overlay';

    const isDanger = type === 'danger';
    overlay.innerHTML = `
      <div class="settings-confirm-dialog">
        <div class="settings-confirm-icon ${isDanger ? 'danger' : 'primary'}">
          ${isDanger
            ? '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="m40-120 440-760 440 760H40Zm138-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm-40-120h80v-200h-80v200Zm40-100Z"/></svg>'
            : '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/></svg>'
          }
        </div>
        <h3 class="settings-confirm-title">${title}</h3>
        <p class="settings-confirm-msg">${message}</p>
        <div class="settings-confirm-actions">
          <button class="settings-confirm-btn cancel" id="settingsConfirmCancel">Cancel</button>
          <button class="settings-confirm-btn ${isDanger ? 'danger' : 'confirm'}" id="settingsConfirmOk">${confirmLabel}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => overlay.classList.add('visible'));

    function close(result) {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    }

    overlay.querySelector('#settingsConfirmCancel').addEventListener('click', () => close(false));
    overlay.querySelector('#settingsConfirmOk').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });

    // Keyboard: Enter = confirm, Escape = cancel
    function onKey(e) {
      if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', onKey); }
      if (e.key === 'Enter') { close(true); document.removeEventListener('keydown', onKey); }
    }
    document.addEventListener('keydown', onKey);
  });
}

// ================================================================
// SETTINGS SUBMENU - ACTIVE SECTION HIGHLIGHTING & POP-OUT
// ================================================================
const settingsItems = document.querySelectorAll('.side-nav-settings-item');
const settingsSections = document.querySelectorAll('.settings-section[id]');
let lastClickedSectionId = null;
let clickTimestamp = null;

// Pop-out animation function
function triggerPopOutAnimation(section) {
  if (section) {
    // Remove animation class if it exists
    section.classList.remove('pop-out-animation');
    // Trigger reflow to restart animation
    void section.offsetWidth;
    // Add animation class
    section.classList.add('pop-out-animation');
  }
}

// Smooth scroll to section when clicking items
settingsItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const sectionId = item.getAttribute('data-section');
    const section = document.getElementById(sectionId);
    
    if (section) {
      // Track the click to prevent scroll updates from overriding it
      lastClickedSectionId = sectionId;
      clickTimestamp = Date.now();
      
      // Update active state
      settingsItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      // Trigger pop-out animation
      triggerPopOutAnimation(section);
      
      // Smooth scroll to center the section
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
});

// Update active item based on which section is most visible
function updateActiveSectionByViewport() {
  // Don't override active state for 1 second after a click
  const timeSinceClick = Date.now() - (clickTimestamp || 0);
  if (timeSinceClick < 1000) {
    return;
  }
  
  let closestSection = null;
  let closestDistance = Infinity;
  
  settingsSections.forEach(section => {
    const sectionTop = section.offsetTop;
    const sectionHeight = section.offsetHeight;
    const viewportMid = window.scrollY + window.innerHeight / 2;
    
    // Calculate distance from viewport center to section center
    const sectionMid = sectionTop + sectionHeight / 2;
    const distance = Math.abs(sectionMid - viewportMid);
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestSection = section.id;
    }
  });
  
  if (closestSection) {
    settingsItems.forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-section') === closestSection) {
        item.classList.add('active');
      }
    });
  }
}

window.addEventListener('scroll', () => {
  updateActiveSectionByViewport();
}, { passive: true });

// Initial update
updateActiveSectionByViewport();

// ================================================================
// INIT
// ================================================================
updateSettingsThemeIcon();
updateCharCounters();
renderNumbers();
loadSystemConfig();
