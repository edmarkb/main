# ESP32 Dual Interval POST — Faster Siren Response

## The Problem

The ESP32 currently POSTs sensor data to the backend every ~2 seconds. The backend responds with `sirenCommand: true/false` telling the ESP32 whether the siren should be ON or OFF.

**When a user toggles the siren from the web dashboard:**

```
User clicks button → Backend saves state instantly → waits for ESP32's next POST → responds with sirenCommand
```

The ESP32 only checks for the siren command when it POSTs. So if it POSTs every 2 seconds, there's a **2-4 second delay** before the siren actually turns on/off. This feels sluggish.

---

## The Solution: Dual Interval

Instead of always posting at the same speed, switch between two speeds:

| State         | POST Interval | Why                                          |
|---------------|---------------|----------------------------------------------|
| Siren OFF     | 2000ms        | Normal speed, saves bandwidth                |
| Siren ON      | 500ms         | Fast polling, picks up OFF command in ~0.5s  |

**Result:** The siren activates within 0.5-2 seconds and deactivates within 0.5 seconds.

---

## Implementation

### Step 1: Define Two Intervals

Add these at the top of your sketch with your other `#define` statements:

```cpp
// Dual POST interval for responsive siren control
#define POST_INTERVAL_NORMAL 2000   // 2 seconds — when siren is idle
#define POST_INTERVAL_FAST   500    // 0.5 seconds — when siren is active
```

### Step 2: Track Siren State

You should already have this from the Siren Guide. If not, add it:

```cpp
bool sirenActive = false;   // Tracks current siren state
```

### Step 3: Replace Your Fixed Interval

Find your current POST logic. It probably looks something like this:

```cpp
// ❌ BEFORE — Fixed interval
#define POST_INTERVAL 2000

void loop() {
  unsigned long now = millis();
  
  if (now - lastPost >= POST_INTERVAL) {
    postSensorData(temp, hum, gas, flame);
    lastPost = now;
  }
}
```

Replace it with:

```cpp
// ✅ AFTER — Dual interval
void loop() {
  unsigned long now = millis();
  
  // Use fast interval when siren is active for responsive control
  unsigned long interval = sirenActive ? POST_INTERVAL_FAST : POST_INTERVAL_NORMAL;
  
  if (now - lastPost >= interval) {
    postSensorData(temp, hum, gas, flame);
    lastPost = now;
  }
  
  // ... rest of your loop (OLED, sensor reads, etc.)
}
```

That's it. One line change in your loop.

### Step 4: Parse sirenCommand in POST Response

In your HTTP POST function, after getting the response, parse `sirenCommand`:

```cpp
void postSensorData(float temp, float hum, int gas, bool flame) {
  HTTPClient http;
  http.begin(serverUrl);  // e.g. "http://192.168.100.129:3000/api/sensor-data"
  http.addHeader("Content-Type", "application/json");

  // Build your sensor JSON payload (same as before)
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
    
    // Parse JSON response
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, response);
    
    if (!error) {
      // Read siren command from server
      bool command = doc["sirenCommand"] | false;
      
      // Apply siren state
      if (command && !sirenActive) {
        digitalWrite(SIREN_PIN, HIGH);
        sirenActive = true;
        Serial.println("SIREN ON (server command)");
        // POST interval will automatically switch to 500ms on next loop
      } 
      else if (!command && sirenActive) {
        digitalWrite(SIREN_PIN, LOW);
        sirenActive = false;
        Serial.println("SIREN OFF (server command)");
        // POST interval will automatically switch back to 2000ms on next loop
      }
    }
  }

  http.end();
}
```

---

## How It Works — Step by Step

### User Turns Siren ON from Dashboard

```
Time 0.0s  →  User clicks siren button on web dashboard
Time 0.0s  →  Backend saves sirenCommand = true (instant)
Time 0.0s  →  All web dashboards update button to active (instant via WebSocket)
              
              ESP32 is posting every 2 seconds (normal interval)...
              
Time ~1.5s →  ESP32 makes its next POST
Time ~1.5s →  Backend responds: { "sirenCommand": true }
Time ~1.5s →  ESP32 reads response → turns siren ON
Time ~1.5s →  ESP32 switches to 500ms interval (fast mode)
```

**Worst case: 2 seconds.** Average: 1 second.

### User Turns Siren OFF from Dashboard

```
Time 0.0s  →  User clicks siren button on web dashboard  
Time 0.0s  →  Backend saves sirenCommand = false (instant)

              ESP32 is posting every 500ms (fast interval — siren is active)...

Time ~0.3s →  ESP32 makes its next POST
Time ~0.3s →  Backend responds: { "sirenCommand": false }
Time ~0.3s →  ESP32 reads response → turns siren OFF
Time ~0.3s →  ESP32 switches back to 2000ms interval (normal mode)
```

**Worst case: 0.5 seconds.** Average: 0.25 seconds.

### Auto-Siren (Critical Condition Detected)

```
Time 0.0s  →  ESP32 POSTs sensor data with critical readings (e.g. temp=45°C)
Time 0.0s  →  Backend detects critical condition
Time 0.0s  →  Backend sets sirenCommand = true
Time 0.0s  →  Backend responds to THIS SAME POST: { "sirenCommand": true }
Time 0.0s  →  ESP32 reads response → turns siren ON immediately
              
              No delay at all — the command is in the response to the POST that triggered it.
```

**Delay: 0 seconds.** The siren activates on the same request cycle.

---

## Complete Minimal Example

If you want to see it all together in one clean sketch:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- Configuration ---
#define DEVICE_ID     "ACES-1"
#define SIREN_PIN     25     // Change to your GPIO pin
#define WIFI_SSID     "YourWiFi"
#define WIFI_PASS     "YourPassword"
#define SERVER_URL    "http://192.168.100.129:3000/api/sensor-data"

// --- Dual Interval ---
#define POST_INTERVAL_NORMAL 2000
#define POST_INTERVAL_FAST   500

// --- State ---
bool sirenActive = false;
unsigned long lastPost = 0;

void setup() {
  Serial.begin(115200);
  pinMode(SIREN_PIN, OUTPUT);
  digitalWrite(SIREN_PIN, LOW);
  
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
}

void loop() {
  unsigned long now = millis();
  unsigned long interval = sirenActive ? POST_INTERVAL_FAST : POST_INTERVAL_NORMAL;
  
  if (now - lastPost >= interval) {
    // Read your sensors here
    float temp = readTemperature();    // Your sensor reading function
    float hum  = readHumidity();       // Your sensor reading function
    int   gas  = readGas();            // Your sensor reading function
    bool  flame = readFlame();         // Your sensor reading function
    
    postSensorData(temp, hum, gas, flame);
    lastPost = now;
  }
  
  // ... your other loop code (OLED updates, etc.)
}

void postSensorData(float temp, float hum, int gas, bool flame) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  
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
    StaticJsonDocument<512> doc;
    
    if (!deserializeJson(doc, response)) {
      bool command = doc["sirenCommand"] | false;
      
      if (command && !sirenActive) {
        digitalWrite(SIREN_PIN, HIGH);
        sirenActive = true;
        Serial.println("SIREN ON");
      } else if (!command && sirenActive) {
        digitalWrite(SIREN_PIN, LOW);
        sirenActive = false;
        Serial.println("SIREN OFF");
      }
    }
  }
  
  http.end();
}
```

---

## FAQ

**Q: Will faster posting overload the server?**  
A: No. The backend processes each POST in ~1ms. Even at 500ms intervals from 3 devices, that's only 6 requests/second — trivial load.

**Q: What if WiFi drops while siren is active?**  
A: The siren stays in its last known state (ON). When WiFi reconnects and the next POST goes through, the ESP32 will get the current `sirenCommand` from the server and sync up.

**Q: Do I need ArduinoJson?**  
A: Yes. Install it from Arduino Library Manager: search "ArduinoJson" by Benoit Blanchon. Use version 6.x or 7.x.

**Q: What about the existing fire/buzzer logic in my code?**  
A: Remove it. The server now decides when the siren should be on. Your ESP32 just reads `sirenCommand` and obeys. See the main [ESP32_SIREN_GUIDE.md](ESP32_SIREN_GUIDE.md) for details.
