# ESP32 Siren Control — Integration Guide

## Overview

The backend now controls the siren/buzzer through the HTTP response to `POST /api/sensor-data`. The ESP32 no longer decides on its own when to turn the siren on — it reads the `sirenCommand` field from the server response and acts accordingly.

This supports two modes:
- **Manual** — A user on the web dashboard toggles the siren ON/OFF
- **Automatic** — The backend detects a critical condition (fire, high temp ≥42°C, gas ≥600 ppm) and auto-activates the siren

In both cases, the ESP32 simply obeys `sirenCommand`.

---

## What Changed in the Backend Response

### Before (old response)

```json
{
  "success": true,
  "message": "Sensor data received",
  "sensorData": { ... },
  "alerts": 0
}
```

### After (new response)

```json
{
  "success": true,
  "message": "Sensor data received",
  "sensorData": { ... },
  "alerts": 0,
  "sirenCommand": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `sirenCommand` | `boolean` | `true` = turn siren ON, `false` = turn siren OFF |

---

## ESP32 Implementation

### 1. Parse `sirenCommand` from Response

After the existing `POST /api/sensor-data`, parse the new field:

```cpp
#include <ArduinoJson.h>

#define SIREN_PIN 25  // Change to your actual siren/buzzer GPIO pin

bool sirenActive = false;  // Track current siren state

void postSensorData(float temp, float hum, int gas, bool flame) {
  // ... existing HTTP POST code ...

  HTTPClient http;
  http.begin(serverUrl);  // e.g. "http://192.168.1.100:3000/api/sensor-data"
  http.addHeader("Content-Type", "application/json");

  // Build JSON payload (same as before)
  String payload = "{";
  payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"temperature\":" + String(temp) + ",";
  payload += "\"humidity\":" + String(hum) + ",";
  payload += "\"gas\":" + String(gas) + ",";
  payload += "\"flame\":" + String(flame ? "true" : "false");
  payload += "}";

  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    String response = http.getString();

    // Parse the JSON response
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, response);

    if (!error) {
      // *** NEW: Read siren command from server ***
      bool serverSirenCommand = doc["sirenCommand"] | false;
      handleSirenCommand(serverSirenCommand);
    }
  }

  http.end();
}
```

### 2. Siren Control Function

```cpp
void handleSirenCommand(bool shouldBeActive) {
  if (shouldBeActive && !sirenActive) {
    // Turn siren ON
    digitalWrite(SIREN_PIN, HIGH);
    sirenActive = true;
    Serial.println("🔔 SIREN ON (server command)");
  } 
  else if (!shouldBeActive && sirenActive) {
    // Turn siren OFF
    digitalWrite(SIREN_PIN, LOW);
    sirenActive = false;
    Serial.println("🔕 SIREN OFF (server command)");
  }
  // If state already matches, do nothing
}
```

### 3. Setup

```cpp
void setup() {
  // ... existing setup code ...
  
  pinMode(SIREN_PIN, OUTPUT);
  digitalWrite(SIREN_PIN, LOW);  // Start with siren OFF
}
```

---

## Complete Flow Diagrams

### Manual Siren (User Toggles ON)

```
User clicks siren button on web dashboard
    ↓
Frontend sends WebSocket event: alarm-state-changed { isActive: true, source: 'manual' }
    ↓
Backend saves state to database + broadcasts to all clients
    ↓
ESP32 does its next POST /api/sensor-data
    ↓
Backend responds with { ..., "sirenCommand": true }
    ↓
ESP32 reads sirenCommand → turns siren ON
```

### Automatic Siren (Critical Condition)

```
ESP32 detects fire/heat/gas → POSTs sensor data to backend
    ↓
Backend detects critical condition (fire, temp ≥42°C, gas ≥600 ppm)
    ↓
Backend auto-activates siren in database + broadcasts to all web clients
    ↓
Backend responds to THIS SAME POST with { ..., "sirenCommand": true }
    ↓
ESP32 reads sirenCommand → turns siren ON
    ↓
All web dashboards show the siren button as active (sunken/pressed state)
```

### User Override (Turn Off Auto-Siren)

```
Siren is ON (auto-activated due to critical condition)
    ↓
User clicks siren button → sees "auto-activated" warning → confirms deactivation
    ↓
Frontend sends: alarm-state-changed { isActive: false, source: 'manual' }
    ↓
Backend saves state (OFF) to database
    ↓
ESP32 does its next POST
    ↓
Backend responds with { ..., "sirenCommand": false }
    ↓
ESP32 reads sirenCommand → turns siren OFF
```

---

## Important Notes

1. **ESP32 does NOT decide when to activate the siren.** The server is the source of truth. The ESP32 only obeys `sirenCommand`.

2. **Siren state persists across ESP32 reboots.** The backend stores the state in the database. When the ESP32 boots up and sends its first POST, it receives the current siren state.

3. **Response time depends on POST interval.** If ESP32 posts every 2 seconds, the siren responds within 2 seconds of a user toggle. Faster POST interval = faster siren response.

4. **No additional endpoints needed.** The siren command is embedded in the existing `POST /api/sensor-data` response — no extra HTTP calls required.

5. **The ESP32 should NOT independently activate the siren based on its own sensor readings anymore.** Remove any local fire → buzzer logic. Let the backend handle the decision.

6. **Auto-siren cooldown.** When the backend auto-activates the siren due to critical conditions, it stays ON for 30 seconds (testing) / 3 minutes (production) after conditions return to safe. During this cooldown, users can still override and turn it off manually from the dashboard. If critical conditions re-appear during cooldown, the timer resets.

---

## ⚡ INSTANT Siren Response — SSE (Server-Sent Events)

**This is the recommended approach for instant siren control.** Instead of waiting for the next POST poll, the ESP32 opens a persistent SSE connection to the server. When a siren command changes, the server **pushes** it instantly — zero polling delay.

> The regular `POST /api/sensor-data` polling continues as-is for sensor data. SSE is an **additional** channel used **only** for siren commands.

### How It Works

```
User toggles siren on web dashboard
    ↓
Backend saves siren state
    ↓
Backend pushes SSE event to ESP32 (INSTANT — no waiting for next POST)
    ↓
ESP32 receives event → activates/deactivates siren immediately
```

### SSE Endpoint

```
GET http://<server-ip>:3000/api/siren-stream/ACES-1
```

The ESP32 connects once on boot. The connection stays open. The server pushes JSON events:

```
data: {"sirenCommand":true}

data: {"sirenCommand":false}
```

A heartbeat comment (`: heartbeat`) is sent every 30 seconds to keep the connection alive.

### ESP32 Implementation

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define SIREN_PIN 25
#define DEVICE_ID "ACES-1"

// SSE connection
WiFiClient sseClient;
String sseBuffer = "";
bool sseConnected = false;
unsigned long lastSSEAttempt = 0;
const unsigned long SSE_RECONNECT_INTERVAL = 3000;  // Retry every 3s if disconnected

const char* serverHost = "192.168.100.129";  // Your server IP
const int serverPort = 3000;

bool sirenActive = false;

void setup() {
  Serial.begin(115200);
  pinMode(SIREN_PIN, OUTPUT);
  digitalWrite(SIREN_PIN, LOW);

  // ... WiFi connect code ...

  connectSSE();  // Open SSE connection on boot
}

void connectSSE() {
  if (sseClient.connected()) return;

  Serial.println("📡 Connecting to SSE siren stream...");

  if (sseClient.connect(serverHost, serverPort)) {
    // Send HTTP GET request for SSE
    sseClient.println("GET /api/siren-stream/" DEVICE_ID " HTTP/1.1");
    sseClient.println("Host: " + String(serverHost));
    sseClient.println("Accept: text/event-stream");
    sseClient.println("Connection: keep-alive");
    sseClient.println();

    sseConnected = true;
    sseBuffer = "";
    Serial.println("✅ SSE connected — listening for siren commands");
  } else {
    sseConnected = false;
    Serial.println("❌ SSE connection failed");
  }
}

void handleSSE() {
  // Reconnect if disconnected
  if (!sseClient.connected()) {
    sseConnected = false;
    unsigned long now = millis();
    if (now - lastSSEAttempt >= SSE_RECONNECT_INTERVAL) {
      lastSSEAttempt = now;
      connectSSE();
    }
    return;
  }

  // Read incoming SSE data
  while (sseClient.available()) {
    char c = sseClient.read();
    sseBuffer += c;

    // SSE events end with double newline
    if (sseBuffer.endsWith("\n\n")) {
      processSSEEvent(sseBuffer);
      sseBuffer = "";
    }
  }
}

void processSSEEvent(String event) {
  // Skip heartbeat comments (lines starting with ':')
  if (event.startsWith(":")) return;

  // Skip HTTP headers on first response
  if (event.indexOf("HTTP/1.1") >= 0) return;

  // Find "data: " prefix
  int dataIndex = event.indexOf("data: ");
  if (dataIndex < 0) return;

  String jsonStr = event.substring(dataIndex + 6);
  jsonStr.trim();

  // Parse JSON
  StaticJsonDocument<128> doc;
  DeserializationError error = deserializeJson(doc, jsonStr);

  if (!error && doc.containsKey("sirenCommand")) {
    bool command = doc["sirenCommand"];
    handleSirenCommand(command);
    Serial.println("📡 SSE siren command: " + String(command ? "ON" : "OFF"));
  }
}

void handleSirenCommand(bool shouldBeActive) {
  if (shouldBeActive && !sirenActive) {
    digitalWrite(SIREN_PIN, HIGH);
    sirenActive = true;
    Serial.println("🔔 SIREN ON");
  } else if (!shouldBeActive && sirenActive) {
    digitalWrite(SIREN_PIN, LOW);
    sirenActive = false;
    Serial.println("🔕 SIREN OFF");
  }
}

void loop() {
  handleSSE();  // Check for siren commands (non-blocking)

  // ... existing sensor reading + POST code ...
  // POST still sends sensor data and reads sirenCommand as a fallback
}
```

### Key Points

1. **SSE runs in `loop()` — non-blocking.** It checks for data every iteration without delay.
2. **Auto-reconnects** every 3 seconds if the connection drops.
3. **POST response is a fallback.** Even without SSE, the siren still works via the `sirenCommand` in the POST response (just with polling delay).
4. **Initial state on connect.** The server sends the current siren state immediately when the ESP32 connects to SSE — so it syncs on boot.
5. **Heartbeat keeps connection alive.** The server sends a heartbeat comment every 30 seconds.

### Architecture Diagram

```
ESP32                          Server (:3000)
  |                                |
  |--- POST /api/sensor-data ---->| (sensor data, every 2s)
  |<--- { sirenCommand } ---------|
  |                                |
  |--- GET /api/siren-stream ---->| (SSE connection, persistent)
  |<--- data: {sirenCommand} -----|  ← INSTANT push on siren change
  |<--- : heartbeat -------------|  ← every 30s keepalive
  |                                |
```

---

## Reducing Siren Response Delay (Polling Fallback)

When a user toggles the siren from the web dashboard, the ESP32 only picks up the new `sirenCommand` on its **next POST**. This means delay = POST interval.

### Problem
If your POST interval is 2 seconds, the siren takes 2-4 seconds to respond after a user toggle. This feels sluggish.

### Solution: Reduce POST Interval

Change the POST interval from 2000ms to 1000ms:

```cpp
// ❌ Before (2-second interval = 2-4s siren delay)
#define POST_INTERVAL 2000

// ✅ After (1-second interval = 1-2s siren delay)
#define POST_INTERVAL 1000
```

### Alternative: Dual Interval (Recommended)

Use a fast interval when the siren is active (for responsive control), and a normal interval otherwise (to save bandwidth):

```cpp
#define POST_INTERVAL_NORMAL 2000   // 2 seconds when idle
#define POST_INTERVAL_FAST   500    // 0.5 seconds when siren is active

unsigned long getPostInterval() {
  return sirenActive ? POST_INTERVAL_FAST : POST_INTERVAL_NORMAL;
}

void loop() {
  unsigned long now = millis();

  if (now - lastPost >= getPostInterval()) {
    postSensorData(temp, hum, gas, flame);
    lastPost = now;
  }

  // ... rest of loop
}
```

This gives near-instant siren response (0.5s) when the siren is active, while keeping normal 2-second intervals during idle operation to reduce server load.

### Tradeoff Table

| POST Interval | Siren Delay | Server Load |
|---------------|-------------|-------------|
| 2000ms        | 2-4 seconds | Low         |
| 1000ms        | 1-2 seconds | Medium      |
| 500ms         | 0.5-1 second| Higher      |
| Dual mode     | 0.5s active, 2s idle | Best balance |

---

## 📱 SMS Alerts via SIM800L GSM Module

Each ESP32 has its own SIM800L module. SMS is sent **only by the device that detects the critical condition** — no duplicate SMS across devices.

### How It Works

1. **Alert contacts + BFP number** are set by the user on the web dashboard (shared globally)
2. Backend includes them in every `POST /api/sensor-data` response so ESP32 always has the latest list
3. When critical conditions are detected, backend sets `sendSMS: true` with a pre-built message
4. **10-second cooldown** — if critical persists, ESP32 gets `sendSMS: true` again after 10 seconds
5. **BFP dispatch** (manual, from dashboard) is pushed instantly via SSE

### Updated POST Response

```json
{
  "success": true,
  "sirenCommand": true,
  "sendSMS": true,
  "smsMessage": "ACES IOT ALERT: FIRE DETECTED, HIGH TEMPERATURE at Computer Lab 1! Respond immediately.",
  "alertContacts": ["+639171234567", "+639181234567"],
  "bfpNumber": "+639191234567"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `sendSMS` | `boolean` | `true` = send SMS now, `false` = skip (cooldown active or no alert) |
| `smsMessage` | `string` | Pre-built alert message (only populated when `sendSMS` is true) |
| `alertContacts` | `string[]` | Phone numbers to send alert SMS to |
| `bfpNumber` | `string` | BFP fire dept number (for reference — BFP dispatch uses SSE) |

### SMS Trigger Logic (Server-Side)

The SMS message now specifies exactly which conditions triggered:
- `FIRE DETECTED` — Flame sensor triggered
- `HIGH TEMPERATURE` — Temp ≥42°C
- `GAS/SMOKE DETECTED` — Gas ≥600 ppm
- Multiple conditions combined: `FIRE DETECTED, HIGH TEMPERATURE`

```
Critical condition detected → first POST → sendSMS: true   ← SEND
Still critical 2s later     → next POST  → sendSMS: false  ← skip (within 10s)
Still critical 10s later    → next POST  → sendSMS: true   ← SEND AGAIN
Condition clears            → cooldown resets
New critical event          → next POST  → sendSMS: true   ← SEND IMMEDIATELY
```

### ESP32 Implementation — Parse SMS Fields

```cpp
// In your POST response handler, after parsing sirenCommand:

if (doc["sendSMS"] | false) {
  String smsMessage = doc["smsMessage"].as<String>();

  // Queue SMS to all alert contacts (non-blocking — processed in loop())
  JsonArray contacts = doc["alertContacts"];
  for (JsonVariant contact : contacts) {
    queueSMS(contact.as<String>(), smsMessage);
  }

  Serial.println("📱 Queued SMS for " + String(contacts.size()) + " contacts");
}
```

### ESP32 Implementation — Non-Blocking SMS Queue + SIM800L

SMS sending is **non-blocking**. Numbers are added to a queue, and `processSMSQueue()` sends one SMS per `loop()` iteration. This ensures siren commands (SSE) are never blocked while SMS is sending.

```cpp
#include <SoftwareSerial.h>

#define SIM800L_TX 17  // ESP32 TX → SIM800L RX
#define SIM800L_RX 16  // ESP32 RX → SIM800L TX
#define SMS_QUEUE_SIZE 10  // Max queued SMS (increase if needed)

SoftwareSerial sim800l(SIM800L_RX, SIM800L_TX);

// ---- SMS Queue ----
struct SMSItem {
  String phoneNumber;
  String message;
};

SMSItem smsQueue[SMS_QUEUE_SIZE];
int smsQueueHead = 0;   // Next item to send
int smsQueueTail = 0;   // Next free slot
int smsQueueCount = 0;  // Items in queue

// SMS sending state machine
enum SMSState { SMS_IDLE, SMS_SET_MODE, SMS_WAIT_MODE, SMS_SET_NUMBER, SMS_WAIT_PROMPT, SMS_SEND_BODY, SMS_WAIT_OK, SMS_COOLDOWN };
SMSState smsState = SMS_IDLE;
unsigned long smsStepStart = 0;
String smsResponse = "";

void setupGSM() {
  sim800l.begin(9600);
  delay(1000);

  sim800l.println("AT");
  delay(500);
  sim800l.println("AT+CMGF=1");  // Set SMS text mode
  delay(500);

  // Flush any leftover data
  while (sim800l.available()) sim800l.read();

  Serial.println("📱 GSM module initialized");
}

// Add SMS to the queue (non-blocking, returns immediately)
void queueSMS(String phoneNumber, String message) {
  if (smsQueueCount >= SMS_QUEUE_SIZE) {
    Serial.println("⚠️ SMS queue full — dropping: " + phoneNumber);
    return;
  }
  smsQueue[smsQueueTail].phoneNumber = phoneNumber;
  smsQueue[smsQueueTail].message = message;
  smsQueueTail = (smsQueueTail + 1) % SMS_QUEUE_SIZE;
  smsQueueCount++;
  Serial.println("📱 Queued SMS to: " + phoneNumber + " (" + String(smsQueueCount) + " in queue)");
}

// Call this in loop() — processes one SMS at a time without blocking
void processSMSQueue() {
  unsigned long now = millis();

  // Read any available SIM800L data into smsResponse
  while (sim800l.available()) {
    char c = sim800l.read();
    smsResponse += c;
  }

  switch (smsState) {

    case SMS_IDLE:
      // Nothing to send?
      if (smsQueueCount == 0) return;

      // Start sending next SMS
      Serial.println("📱 Sending SMS to: " + smsQueue[smsQueueHead].phoneNumber);
      smsResponse = "";
      sim800l.println("AT+CMGF=1");
      smsStepStart = now;
      smsState = SMS_WAIT_MODE;
      break;

    case SMS_WAIT_MODE:
      if (smsResponse.indexOf("OK") >= 0 || now - smsStepStart > 2000) {
        smsResponse = "";
        sim800l.println("AT+CMGS=\"" + smsQueue[smsQueueHead].phoneNumber + "\"");
        smsStepStart = now;
        smsState = SMS_WAIT_PROMPT;
      }
      break;

    case SMS_WAIT_PROMPT:
      if (smsResponse.indexOf(">") >= 0 || now - smsStepStart > 3000) {
        smsResponse = "";
        sim800l.print(smsQueue[smsQueueHead].message);
        delay(100);  // Brief pause before Ctrl+Z (required by SIM800L)
        sim800l.write(26);  // Ctrl+Z to send
        smsStepStart = now;
        smsState = SMS_WAIT_OK;
      }
      break;

    case SMS_WAIT_OK:
      if (smsResponse.indexOf("OK") >= 0) {
        Serial.println("✅ SMS sent to " + smsQueue[smsQueueHead].phoneNumber);
        smsStepStart = now;
        smsState = SMS_COOLDOWN;
      } else if (smsResponse.indexOf("ERROR") >= 0 || now - smsStepStart > 10000) {
        Serial.println("❌ SMS failed to " + smsQueue[smsQueueHead].phoneNumber + " | " + smsResponse);
        smsStepStart = now;
        smsState = SMS_COOLDOWN;
      }
      break;

    case SMS_COOLDOWN:
      // 2s gap between SMS — SIM800L needs recovery time
      if (now - smsStepStart >= 2000) {
        // Dequeue the sent item
        smsQueueHead = (smsQueueHead + 1) % SMS_QUEUE_SIZE;
        smsQueueCount--;
        smsResponse = "";
        smsState = SMS_IDLE;  // Will pick up next item on next loop()

        if (smsQueueCount > 0) {
          Serial.println("📱 " + String(smsQueueCount) + " SMS remaining in queue");
        } else {
          Serial.println("📱 All SMS sent");
        }
      }
      break;
  }
}
```

> **Why a state machine?** Each `case` runs in microseconds and returns control to `loop()`. Between SMS steps, `handleSSE()` keeps running — so siren ON/OFF commands are **never blocked** by SMS sending. The user can turn the siren OFF at any time, even while SMS is mid-send.

### loop() Integration

```cpp
void loop() {
  handleSSE();        // ← Always responsive to siren commands
  processSMSQueue();  // ← Sends one SMS step per iteration (non-blocking)

  // ... existing sensor reading + POST code ...
}
```

### BFP Dispatch via SSE (Manual from Dashboard)

When the user clicks "Dispatch BFP" on the dashboard, the server pushes a command directly to the ESP32 via SSE:

```json
{"type":"bfp-dispatch","phoneNumber":"+639191234567","deviceName":"Computer Lab 1","message":"ACES IOT ALERT: Fire emergency at Computer Lab 1! BFP dispatch requested. Please respond immediately."}
```

**ESP32 handles this in `processSSEEvent()`:**

```cpp
void processSSEEvent(String event) {
  // ... existing siren handling ...

  int dataIndex = event.indexOf("data: ");
  if (dataIndex < 0) return;

  String jsonStr = event.substring(dataIndex + 6);
  jsonStr.trim();

  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, jsonStr);
  if (error) return;

  // Handle siren command
  if (doc.containsKey("sirenCommand")) {
    bool command = doc["sirenCommand"];
    handleSirenCommand(command);
  }

  // Handle SMS command (manual siren ON or auto-activation) — QUEUED, non-blocking
  if (doc.containsKey("type") && doc["type"] == "send-sms") {
    String msg = doc["smsMessage"].as<String>();
    JsonArray contacts = doc["alertContacts"];
    for (JsonVariant contact : contacts) {
      queueSMS(contact.as<String>(), msg);
    }
    Serial.println("📱 SSE: Queued SMS for " + String(contacts.size()) + " contacts");
  }

  // Handle BFP dispatch (SMS to fire department) — QUEUED, non-blocking
  if (doc.containsKey("type") && doc["type"] == "bfp-dispatch") {
    String phone = doc["phoneNumber"].as<String>();
    String msg = doc["message"].as<String>();
    queueSMS(phone, msg);
    Serial.println("🚨 BFP dispatch SMS queued for " + phone);
  }
}
```

### SSE Event Types Summary

The ESP32 receives 3 types of SSE events:

| SSE Event | When | ESP32 Action |
|-----------|------|-------------|
| `{"sirenCommand": true/false}` | Siren toggled (manual or auto) | Turn siren ON/OFF |
| `{"type":"send-sms", "alertContacts":[...], "smsMessage":"..."}` | Siren activated (manual ON or auto-critical) | Send SMS to all alert contacts |
| `{"type":"bfp-dispatch", "phoneNumber":"...", "message":"..."}` | User clicks BFP dispatch on dashboard | Send SMS to BFP number only |

### Architecture Diagram (Complete)

```
                        Web Dashboard (User)
                            |
                   Set contacts, BFP number,
                   toggle siren, dispatch BFP
                            |
                        Backend (:3000)
                       /    |    \
                      /     |     \
              ACES-1     ACES-2    ACES-3
              ESP32      ESP32     ESP32
              SIM800L    SIM800L   SIM800L
                |           |         |
         Sends SMS     Sends SMS  Sends SMS
         for ITS       for ITS    for ITS
         alerts only   alerts     alerts

  POST response: contacts, BFP#, sendSMS, smsMessage
  SSE push:      siren ON/OFF, BFP dispatch command
```

---

## Migration Checklist

- [ ] Add `SIREN_PIN` definition to match your hardware GPIO
- [ ] Add `#include <ArduinoJson.h>` if not already included
- [ ] Add `sirenActive` boolean variable
- [ ] Add `handleSirenCommand()` function
- [ ] Parse `sirenCommand` from POST response (fallback)
- [ ] **Add SSE listener** — `connectSSE()` + `handleSSE()` in loop (instant siren)
- [ ] **Setup SIM800L** — `setupGSM()` in setup, `sendSMS()` function
- [ ] **Parse `sendSMS` + `alertContacts`** from POST response → send SMS on critical
- [ ] **Handle BFP dispatch** in SSE `processSSEEvent()` → send SMS to BFP number
- [ ] Remove any local `if (flame) { digitalWrite(BUZZER_PIN, HIGH); }` logic
- [ ] Set `pinMode(SIREN_PIN, OUTPUT)` in `setup()`
- [ ] Test: trigger critical condition → verify SMS sent to all alert contacts
- [ ] Test: wait 10s while critical persists → verify SMS re-sent
- [ ] Test: click BFP dispatch on dashboard → verify ESP32 sends SMS to BFP
- [ ] Test: toggle siren from dashboard → verify ESP32 responds instantly via SSE
- [ ] Test: disconnect WiFi → verify SSE auto-reconnects
