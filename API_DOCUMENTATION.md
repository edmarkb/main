# ACES IoT Backend - API Documentation

## Overview
Complete API documentation for the ACES IoT System backend. This document provides frontend developers with all information needed to integrate with the backend.

---

## API ENDPOINTS

### 1. GET /api/logs - Fetch all logs

**Description:** Retrieve logs with optional filtering and pagination

**URL:** `http://localhost:3000/api/logs`

**Method:** `GET`

**Query Parameters (Optional):**
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| deviceId | string | Filter by device ID | ACES-1 |
| eventType | string | Filter by event type | warning |
| critical | boolean | Show only critical events | true |
| limit | number | Logs per page (default: 50) | 20 |
| offset | number | Pagination offset (default: 0) | 0 |

**Example Request:**
```
GET http://localhost:3000/api/logs?deviceId=ACES-1&limit=20&offset=0
```

**Response (Success - 200):**
```json
{
  "success": true,
  "logs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "deviceId": "ACES-1",
      "labName": "Computer Laboratory 1",
      "timestamp": "2024-01-15 14:32:18",
      "eventType": "warning",
      "alertMessage": "High Temperature Warning",
      "temperature": 36,
      "humidity": 68,
      "gas": 350
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

---

### 2. POST /api/logs - Create new log

**Description:** Create a new log entry in the database

**URL:** `http://localhost:3000/api/logs`

**Method:** `POST`

**Request Body (JSON):**
```json
{
  "deviceId": "ACES-1",
  "labName": "Computer Laboratory 1",
  "eventType": "warning",
  "temperature": 36,
  "humidity": 68,
  "gas": 350,
  "alertMessage": "High Temperature Warning",
  "timestamp": "2024-01-15 14:32:18"
}
```

**Required Fields:**
- `deviceId` (string) - Must be ACES-1, ACES-2, or ACES-3
- `labName` (string) - Lab/location name
- `eventType` (string) - Type of event (see Event Types section)

**Optional Fields:**
- `temperature` (number) - Temperature in °C
- `humidity` (number) - Humidity in %
- `gas` (number) - Gas concentration in ppm
- `alertMessage` (string) - Description of event
- `timestamp` (string) - ISO 8601 format (auto-generated if not provided)

**Response (Success - 201):**
```json
{
  "success": true,
  "message": "Log created successfully",
  "logId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "message": "Missing required fields: deviceId, labName, eventType"
}
```

---

### 3. DELETE /api/logs/:id - Delete specific log

**Description:** Delete a log entry by ID

**URL:** `http://localhost:3000/api/logs/{logId}`

**Method:** `DELETE`

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Log entry ID |

**Example Request:**
```
DELETE http://localhost:3000/api/logs/550e8400-e29b-41d4-a716-446655440000
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Log deleted successfully"
}
```

**Response (Error - 404):**
```json
{
  "success": false,
  "message": "Log not found"
}
```

---

### 4. POST /api/logs/clear - Clear all logs

**Description:** Delete all log entries from the database

**URL:** `http://localhost:3000/api/logs/clear`

**Method:** `POST`

**Request Body:**
```json
{}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "All logs cleared successfully",
  "deletedCount": 150
}
```

---

## DATABASE SCHEMA

### Table: logs

**Purpose:** Stores all device events and alerts

**Columns:**

| Column Name | Type | Constraints | Description |
|-------------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Auto-generated unique identifier |
| device_id | VARCHAR(10) | NOT NULL | Device ID (ACES-1, ACES-2, ACES-3) |
| lab_name | VARCHAR(255) | NOT NULL | Laboratory/location name |
| timestamp | VARCHAR(50) | NOT NULL | Event timestamp |
| event_type | VARCHAR(50) | NOT NULL | Type of event |
| alert_message | TEXT | NULLABLE | Human-readable message |
| temperature | DECIMAL(5,2) | NULLABLE | Temperature in °C |
| humidity | DECIMAL(5,2) | NULLABLE | Humidity in % |
| gas | DECIMAL(5,2) | NULLABLE | Gas concentration in ppm |
| created_at | TIMESTAMP | DEFAULT NOW() | Server creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Server update timestamp |

**Indexes:**
- `idx_logs_device_id` - On device_id (faster device filtering)
- `idx_logs_event_type` - On event_type (faster event filtering)
- `idx_logs_timestamp` - On timestamp DESC (faster chronological queries)

---

## EVENT TYPES

Valid values for `eventType` field:

| Event Type | Description | Triggered When |
|------------|-------------|-----------------|
| `device_online` | Device came back online | Device reconnects |
| `device_offline` | Device went offline | Device disconnects |
| `warning` | Sensor threshold warning | Temp ≥35°C OR Gas ≥400ppm OR Humidity ≥75% |
| `critical` | Critical sensor reading | Temp ≥42°C OR Gas ≥600ppm |
| `manual_alarm_on` | Manual alarm activated | User presses alarm button |
| `manual_alarm_off` | Manual alarm deactivated | User stops alarm |
| `bfp_alert` | Emergency alert sent to BFP | Critical condition + alarm activation |

---

## DEVICE INFORMATION

### Valid Device IDs

| Device ID | Lab Name | Location |
|-----------|----------|----------|
| ACES-1 | Computer Laboratory 1 | Campus Building A |
| ACES-2 | Computer Laboratory 2 | Campus Building A |
| ACES-3 | Food Laboratory | Campus Building B |

### Sensor Thresholds

**Warning Level:**
- Temperature ≥ 35°C
- Gas ≥ 400 ppm
- Humidity ≥ 75%

**Critical Level:**
- Temperature ≥ 42°C
- Gas ≥ 600 ppm

---

## API BASE URL

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:3000` |
| Production | *(To be deployed)* |

---

## RESPONSE FORMAT

### Success Response
All successful responses include:
```json
{
  "success": true,
  "message": "Description of what happened",
  "data": {}
}
```

### Error Response
All error responses include:
```json
{
  "success": false,
  "message": "Description of the error"
}
```

### HTTP Status Codes

| Status | Meaning | Example |
|--------|---------|---------|
| 200 | OK | GET, DELETE successful |
| 201 | Created | POST successful |
| 400 | Bad Request | Invalid data sent |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Unexpected error |

---

## LOADING BEHAVIOR

### Current: Load Once
- Logs load when the page opens
- Single fetch from GET /api/logs
- No continuous updates
- Suitable for current needs

### Future: Real-time Updates (Optional)
- Socket.io implementation
- Push updates from backend
- Live log display
- Recommended for production

---

## INTEGRATION CHECKLIST

✅ Backend running on `http://localhost:3000`
✅ GET /api/logs endpoint (with filters)
✅ POST /api/logs endpoint (create logs)
✅ DELETE /api/logs/:id endpoint
✅ POST /api/logs/clear endpoint
✅ PostgreSQL database connected
✅ Proper JSON response format
✅ Error handling included
✅ CORS enabled for frontend
✅ Input validation implemented

---

## EXAMPLE USAGE

### JavaScript Fetch Example

**Get all logs:**
```javascript
fetch('http://localhost:3000/api/logs')
  .then(response => response.json())
  .then(data => console.log(data.logs))
  .catch(error => console.error('Error:', error));
```

**Get logs by device:**
```javascript
fetch('http://localhost:3000/api/logs?deviceId=ACES-1')
  .then(response => response.json())
  .then(data => console.log(data.logs));
```

**Create a new log:**
```javascript
const newLog = {
  deviceId: 'ACES-1',
  labName: 'Computer Laboratory 1',
  eventType: 'warning',
  temperature: 36,
  humidity: 68,
  gas: 350,
  alertMessage: 'High Temperature Warning'
};

fetch('http://localhost:3000/api/logs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(newLog)
})
.then(response => response.json())
.then(data => console.log('Log created:', data.logId));
```

**Delete a log:**
```javascript
fetch('http://localhost:3000/api/logs/550e8400-e29b-41d4-a716-446655440000', {
  method: 'DELETE'
})
.then(response => response.json())
.then(data => console.log(data.message));
```

---

## POSTMAN TESTING

### Setup
1. Open Postman
2. Create requests for each endpoint
3. Set base URL: `http://localhost:3000`

### Test Requests
- **GET:** `/api/logs`
- **POST:** `/api/logs` with JSON body
- **DELETE:** `/api/logs/{id}`
- **POST:** `/api/logs/clear`

---

## CORS CONFIGURATION

Frontend can connect from:
- `http://localhost:*` (any port on localhost)
- `http://127.0.0.1:*` (any port on loopback)

For production, update CORS settings in `server.js`

---

## ERROR HANDLING

The backend handles these common errors:

| Error | Status | Message |
|-------|--------|---------|
| Missing required fields | 400 | "Missing required fields: ..." |
| Invalid device ID | 400 | "Invalid deviceId. Must be one of: ..." |
| Invalid event type | 400 | "Invalid eventType. Must be one of: ..." |
| Log not found | 404 | "Log not found" |
| Server error | 500 | "Error retrieving logs" |

---

## DEPLOYMENT NOTES

When deploying to production:

1. Update `API_BASE_URL` in frontend config
2. Update CORS origins in `server.js`
3. Use environment variables for database URL
4. Set `NODE_ENV=production`
5. Enable SSL/HTTPS
6. Set up proper logging
7. Configure rate limiting

---

## SUPPORT & QUESTIONS

For issues or questions:
1. Check the logs page in frontend
2. Monitor backend console for errors
3. Verify database connection
4. Test endpoints with Postman
5. Check request/response format matches documentation

---

**Last Updated:** January 31, 2026
**Backend Version:** 1.0.0
**API Version:** v1
