# ESP32 Device ID Configuration Guide

## Overview

Each ESP32 board in the ACES IoT system must have a **unique device ID** hardcoded in its firmware. The backend validates incoming data against these IDs:

| Device ID | Board | Status |
|-----------|-------|--------|
| `ACES-1`  | ESP32 Board #1 | Available |
| `ACES-2`  | ESP32 Board #2 | Available |
| `ACES-3`  | ESP32 Board #3 | Available (future) |

---

## The Problem

If two ESP32 boards share the same `deviceId` (e.g., both set to `"ACES-1"`):

- **Dashboard** may show the correct device (via polling service), but...
- **Database (`sensor_readings`)** stores data under the wrong device ID
- **Historical trends (24H, 7D, 1M, 3M)** won't show data — the frontend queries by the dashboard's device ID, but the database has it under a different one
- **Alerts and logs** get attributed to the wrong device

---

## How to Fix

### Step 1: Find the Device ID in Your ESP32 Code

Look for a line like this in your Arduino/PlatformIO sketch (usually near the top or in a config section):

```cpp
// Common patterns — find whichever one your code uses:

String deviceId = "ACES-1";           // Pattern 1: String variable
#define DEVICE_ID "ACES-1"            // Pattern 2: #define macro
const char* deviceId = "ACES-1";      // Pattern 3: const char pointer
```

### Step 2: Change the Device ID

Update the value to match the device slot you want:

**For Board #2:**
```cpp
String deviceId = "ACES-2";
```

**For Board #3 (future):**
```cpp
String deviceId = "ACES-3";
```

> **Important:** The ID must be exactly `ACES-1`, `ACES-2`, or `ACES-3` (uppercase, with hyphen). The backend rejects any other format.

### Step 3: Flash the Updated Firmware

Upload the updated sketch to the specific ESP32 board.

### Step 4: Verify

After flashing, check the backend console logs. You should see:

```
📥 POST /api/sensor-data received at ...
   Device: ACES-2, Temp: 31.8°C, Humidity: 68.5%, Gas: 0 ppm, Flame: false
```

If it still shows `ACES-1`, the firmware didn't update — re-flash.

---

## Fixing Existing Database Records

If data was already logged under the wrong device ID, you can migrate it with a SQL query.

### Migrate ACES-1 → ACES-2

> **Only run this if you don't have a real ACES-1 device with data you want to keep.**

```sql
-- Migrate sensor readings
UPDATE sensor_readings SET device_id = 'ACES-2' WHERE device_id = 'ACES-1';

-- Migrate event logs
UPDATE logs SET device_id = 'ACES-2' WHERE device_id = 'ACES-1';

-- Verify
SELECT device_id, COUNT(*) FROM sensor_readings GROUP BY device_id;
SELECT device_id, COUNT(*) FROM logs GROUP BY device_id;
```

### If both ACES-1 and ACES-2 have mixed data

If a real ACES-1 was also sending data, you'll need to identify which rows belong to which device. Use timestamps to isolate:

```sql
-- Check when the wrong data was recorded
SELECT device_id, MIN(recorded_at), MAX(recorded_at), COUNT(*)
FROM sensor_readings
WHERE device_id = 'ACES-1'
GROUP BY device_id;

-- Migrate only rows from a specific time range
UPDATE sensor_readings
SET device_id = 'ACES-2'
WHERE device_id = 'ACES-1'
  AND recorded_at >= '2026-02-21 00:00:00'
  AND recorded_at <= '2026-02-21 23:59:59';
```

---

## Adding ACES-3 (Future Board)

### 1. ESP32 Firmware

Set the device ID in the third board's firmware:

```cpp
String deviceId = "ACES-3";
```

### 2. Backend — Already Supported

The backend already accepts `ACES-3`. The validation whitelist in `routes/sensor.js` includes it:

```javascript
const validDeviceIds = ['ACES-1', 'ACES-2', 'ACES-3'];
```

The database constraints also allow it:

```sql
CHECK (device_id IN ('ACES-1', 'ACES-2', 'ACES-3'))
```

### 3. Dashboard — Add the Device

On the ACES IoT dashboard:
1. Click the **+** button (side nav or main "Add Device" button)
2. Enter the device ID: `ACES-3`
3. Set the lab name and ESP URL (the board's local IP)
4. The device will appear once the ESP32 starts sending data

### 4. If You Need More Than 3 Devices

To support `ACES-4` and beyond, you'll need to update:

1. **Backend validation** (`routes/sensor.js`):
   ```javascript
   const validDeviceIds = ['ACES-1', 'ACES-2', 'ACES-3', 'ACES-4'];
   ```

2. **Database constraints** (`config/database.js`) — update all `CHECK` constraints:
   ```sql
   CHECK (device_id IN ('ACES-1', 'ACES-2', 'ACES-3', 'ACES-4'))
   ```
   This applies to tables: `logs`, `device_config`, `sensor_readings`, `siren_state`

3. **Flash the new ESP32** with `deviceId = "ACES-4"`

---

## Timezone Note

The backend uses `Asia/Manila` (UTC+8) for all database timestamps. If `recorded_at` values look 8 hours behind your local time, restart the backend server to apply the timezone fix in `config/database.js`.

---

## Quick Reference

| What | Where | File |
|------|-------|------|
| ESP32 device ID | Firmware sketch | `*.ino` or `main.cpp` |
| Backend ID validation | Whitelist array | `routes/sensor.js` |
| DB constraints | Table definitions | `config/database.js` |
| Device registration | Dashboard UI | Web app → Add Device |
| Sensor data storage | PostgreSQL table | `sensor_readings` |
| Historical trends | API endpoint | `GET /api/sensor-data/readings?acesId=X&timeframe=24h` |
