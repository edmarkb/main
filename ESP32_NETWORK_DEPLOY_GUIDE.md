# ESP32 Network Deployment Guide — Huawei Pocket WiFi

## Overview

This guide covers the network configuration required to deploy the ACES IoT system on a **Huawei pocket WiFi router** in a closed LAN environment. Because the Huawei router does not support DHCP reservation, the backend server uses a **static IP address** to ensure stable communication.

### Network Architecture

```
┌──────────────┐         ┌──────────────────────┐         ┌──────────────┐
│   ESP32(s)   │────────▶│  Backend Server       │◀────────│   Frontend   │
│  DHCP (auto) │  POST   │  192.168.8.10:3000    │  WebSocket│ (Browser)  │
│  192.168.8.x │◀────────│  Static IP            │────────▶│  192.168.8.x │
│              │ Response │  Windows Laptop       │         │  Phone/PC    │
└──────────────┘         └──────────────────────┘         └──────────────┘
        │                         │
        │    ┌────────────────────┘
        │    │
        ▼    ▼
   ┌──────────────┐
   │ Huawei Pocket │
   │ WiFi Router   │
   │ 192.168.8.1   │
   │ DHCP: .100+   │
   └──────────────┘
```

**Key principle:** Only the backend server has a static IP. Everything else (ESP32 devices, phones, other laptops) uses DHCP.

---

## 1. Backend Server — Static IP Setup (Already Done)

The Windows laptop running the backend server has been configured with:

| Setting | Value |
|---------|-------|
| **IP Address** | `192.168.8.10` |
| **Subnet Mask** | `255.255.255.0` (Prefix: 24) |
| **Default Gateway** | `192.168.8.1` |
| **Preferred DNS** | `192.168.8.1` |
| **Alternate DNS** | `8.8.8.8` |

> **Why 192.168.8.10?** It's outside the Huawei DHCP range (typically `192.168.8.100`–`192.168.8.254`), so it will never conflict with automatically assigned addresses.

The backend binds to all network interfaces:

```javascript
server.listen(3000, '0.0.0.0');
```

### Verify It's Working

After starting the backend, you should see:

```
✅ ACES IoT Backend running on http://localhost:3000
📡 API available at http://192.168.8.10:3000/api
```

From any device on the same WiFi, test:

```
http://192.168.8.10:3000/api/health
```

Expected response:
```json
{ "success": true, "message": "Backend is running" }
```

---

## 2. ESP32 Configuration

### WiFi Settings

Connect the ESP32 to the Huawei pocket WiFi. The ESP32 uses DHCP (automatic IP) — **no static IP needed**.

```cpp
#define WIFI_SSID "YourHuaweiWiFiName"
#define WIFI_PASS "YourHuaweiPassword"
```

### Backend Server URL

**This is the most important setting.** Point all HTTP requests to the backend's static IP:

```cpp
#define SERVER_URL "http://192.168.8.10:3000/api/sensor-data"
```

If using SSE for instant siren response:

```cpp
const char* serverHost = "192.168.8.10";
const int serverPort = 3000;
```

### Device ID

Each ESP32 must have a unique device ID. Set this in the firmware:

```cpp
#define DEVICE_ID "ACES-1"   // Board #1
// #define DEVICE_ID "ACES-2"   // Board #2
// #define DEVICE_ID "ACES-3"   // Board #3
```

> See [ESP32_DEVICE_ID_GUIDE.md](ESP32_DEVICE_ID_GUIDE.md) for detailed instructions.

### Complete WiFi + Server Config Block

```cpp
// ============================================
// NETWORK CONFIGURATION — Huawei Pocket WiFi
// ============================================

// WiFi credentials (Huawei pocket WiFi)
#define WIFI_SSID     "YourHuaweiWiFiName"
#define WIFI_PASS     "YourHuaweiPassword"

// Backend server static IP (do NOT use mDNS or localhost)
#define SERVER_URL    "http://192.168.8.10:3000/api/sensor-data"
#define SERVER_HOST   "192.168.8.10"
#define SERVER_PORT   3000

// Device identity
#define DEVICE_ID     "ACES-1"

// POST intervals (dual interval for responsive siren)
#define POST_INTERVAL_NORMAL 2000   // 2s when idle
#define POST_INTERVAL_FAST   500    // 0.5s when siren active

// Siren GPIO
#define SIREN_PIN     25
```

### WiFi Connection with Retry

```cpp
void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  WiFi.setAutoReconnect(true);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("✅ WiFi connected");
    Serial.print("   IP: ");
    Serial.println(WiFi.localIP());    // Will be 192.168.8.1xx (DHCP)
    Serial.print("   Gateway: ");
    Serial.println(WiFi.gatewayIP());  // Should be 192.168.8.1
    Serial.print("   Server: ");
    Serial.println(SERVER_HOST);       // 192.168.8.10
  } else {
    Serial.println("\n❌ WiFi failed — restarting...");
    ESP.restart();
  }
}
```

---

## 3. Frontend Configuration

The frontend **automatically** connects to the correct backend because it uses the current page URL:

```javascript
// config.js — already dynamic, no change needed
BASE_URL: `${window.location.protocol}//${window.location.host}`

// websocket-client.js — already dynamic
socket = io(window.location.origin, { ... });
```

**How to access the dashboard:**

| Device | URL |
|--------|-----|
| Laptop (backend host) | `http://localhost:3000` or `http://192.168.8.10:3000` |
| Phone / Other device | `http://192.168.8.10:3000` |
| mDNS (if supported) | `http://aces-iot.local:3000` (optional fallback) |

> **Tip:** Bookmark `http://192.168.8.10:3000` on your phone for quick access.

---

## 4. Communication Flow Summary

### ESP32 → Backend (Sensor Data)

```
ESP32 POSTs to http://192.168.8.10:3000/api/sensor-data every 2s
Backend responds with { sirenCommand: true/false }
```

The ESP32 initiates all communication. The backend never needs to reach the ESP32 by IP (except through SSE, which the ESP32 also initiates).

### Frontend → Backend (Dashboard)

```
Browser loads http://192.168.8.10:3000 (serves static files)
Browser opens WebSocket to ws://192.168.8.10:3000 (real-time updates)
Browser makes API calls to http://192.168.8.10:3000/api/* (REST)
```

### Backend → ESP32 (Siren Commands)

Two channels, both **initiated by the ESP32**:

1. **POST response** — Siren command is embedded in the sensor data response (polling, 0.5–2s delay)
2. **SSE stream** — ESP32 opens persistent connection to `GET /api/siren-stream/ACES-X`, server pushes commands instantly

> See [ESP32_SIREN_GUIDE.md](ESP32_SIREN_GUIDE.md) and [ESP32_DUAL_INTERVAL_GUIDE.md](ESP32_DUAL_INTERVAL_GUIDE.md) for siren implementation details.

---

## 5. What Happens After Router Restart?

| Component | After Restart | Action Needed |
|-----------|---------------|---------------|
| **Backend server** | Keeps `192.168.8.10` (static IP) | None — just restart the Node.js server if laptop rebooted |
| **ESP32** | Gets new DHCP IP (e.g., `192.168.8.105`) | None — it connects to the backend by IP, not the other way around |
| **Phone/Browser** | Gets new DHCP IP (e.g., `192.168.8.110`) | None — just navigate to `http://192.168.8.10:3000` |
| **mDNS** | May take a few seconds to re-broadcast | Not relied upon |

**No disruption.** The only fixed address in the system is the backend (`192.168.8.10`), and that's a static IP that doesn't change.

---

## 6. Troubleshooting

### ESP32 can't connect to server

1. **Check WiFi** — Is the ESP32 on the same Huawei WiFi network?
   ```cpp
   Serial.println(WiFi.localIP());    // Should be 192.168.8.xxx
   Serial.println(WiFi.gatewayIP());  // Should be 192.168.8.1
   ```

2. **Ping the server** — From Serial Monitor, verify the IP is reachable:
   ```cpp
   // Add to setup() for debugging
   if (WiFi.status() == WL_CONNECTED) {
     HTTPClient http;
     http.begin("http://192.168.8.10:3000/api/health");
     int code = http.GET();
     Serial.println("Health check: " + String(code));  // Should be 200
     http.end();
   }
   ```

3. **Check firewall** — Windows Firewall may block port 3000. Allow Node.js through:
   - Windows Settings → Firewall → Allow an app → Add `node.exe`
   - Or run in admin PowerShell: `New-NetFirewallRule -DisplayName "ACES Backend" -Direction Inbound -Port 3000 -Protocol TCP -Action Allow`

4. **Check server is running** — On the laptop, verify:
   ```
   http://localhost:3000/api/health
   ```

### Phone can't load dashboard

1. **Same WiFi?** — Phone must be connected to the Huawei pocket WiFi.
2. **Correct URL?** — Use `http://192.168.8.10:3000` (not `https`, not `localhost`).
3. **Firewall** — Same as above, ensure port 3000 is open.

### ESP32 shows "connection refused" or timeout

- The backend server is likely not running. Start it:
  ```
  cd C:\Users\azly jhad\Downloads\ACES THESIS CODE\acesiot---backend-main\acesiot---backend-main
  node server.js
  ```

### Data not showing on dashboard

1. Check the backend console — you should see POST requests from ESP32:
   ```
   📥 POST /api/sensor-data received at ...
      Device: ACES-1, Temp: 31.8°C, Humidity: 68.5%, Gas: 0 ppm, Flame: false
   ```
2. If no POSTs are showing, the ESP32 isn't reaching the server (see above).
3. If POSTs show but dashboard is empty, check the device ID matches what's registered on the dashboard.

### mDNS (aces-iot.local) not working

This is expected on some devices. mDNS is a convenience feature, not the primary access method. Always use `http://192.168.8.10:3000`.

---

## 7. Quick Checklist Before Deployment

- [ ] Backend laptop WiFi adapter set to static IP `192.168.8.10`
- [ ] Backend server starts with `server.listen(3000, '0.0.0.0')`
- [ ] `http://192.168.8.10:3000/api/health` responds from another device
- [ ] Windows Firewall allows port 3000 (TCP inbound)
- [ ] ESP32 firmware has `SERVER_URL = "http://192.168.8.10:3000/api/sensor-data"`
- [ ] ESP32 firmware has correct `DEVICE_ID` (`ACES-1`, `ACES-2`, or `ACES-3`)
- [ ] ESP32 firmware has correct WiFi credentials for Huawei pocket WiFi
- [ ] ESP32(s) flashed and connecting (check Serial Monitor)
- [ ] Dashboard accessible from phone at `http://192.168.8.10:3000`
- [ ] Sensor data appearing on dashboard in real-time

---

## 8. Network Summary Table

| Component | IP Address | Type | Connects To |
|-----------|-----------|------|-------------|
| Huawei Router | `192.168.8.1` | Gateway | — |
| Backend Server | `192.168.8.10` | **Static** | PostgreSQL (Railway cloud) |
| ESP32 ACES-1 | `192.168.8.1xx` | DHCP | `192.168.8.10:3000` |
| ESP32 ACES-2 | `192.168.8.1xx` | DHCP | `192.168.8.10:3000` |
| ESP32 ACES-3 | `192.168.8.1xx` | DHCP | `192.168.8.10:3000` |
| Phone/Browser | `192.168.8.1xx` | DHCP | `192.168.8.10:3000` |

> All DHCP addresses are assigned by the Huawei router from its pool (typically `.100`–`.254`). They may change after router restarts — this is fine because only the backend needs a stable IP.

---

## Related Guides

- [ESP32_DEVICE_ID_GUIDE.md](ESP32_DEVICE_ID_GUIDE.md) — How to set unique device IDs per board
- [ESP32_SIREN_GUIDE.md](ESP32_SIREN_GUIDE.md) — Siren control via POST response + SSE
- [ESP32_DUAL_INTERVAL_GUIDE.md](ESP32_DUAL_INTERVAL_GUIDE.md) — Faster siren response with dual POST intervals
