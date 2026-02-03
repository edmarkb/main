// ============================================
// BACKEND INTEGRATION GUIDE
// For the backend developer
// ============================================

/**
 * FRONTEND API EXPECTATIONS
 * 
 * The frontend is configured to communicate with a Node.js backend
 * running on http://localhost:3000
 * 
 * The following endpoints are expected:
 */

// ============================================
// 1. GET LOGS ENDPOINT
// ============================================
/*
Endpoint: GET /api/logs
Query Parameters:
  - deviceId (optional): Filter by device (e.g., "ACES-1")
  - eventType (optional): Filter by event type
  - critical (optional): Show only critical events (true/false)
  - limit (optional): Number of logs to return
  - offset (optional): Pagination offset

Response: 
{
  "success": true,
  "logs": [
    {
      "id": "unique-id",
      "deviceId": "ACES-1",
      "labName": "Computer Laboratory 1",
      "timestamp": "2024-01-15 14:32:18",
      "eventType": "device_online",
      "alertMessage": "Device came back online",
      "temperature": 28,
      "humidity": 65,
      "gas": 245
    }
  ],
  "total": 10
}

Event Types:
- "device_online": Device came back online
- "device_offline": Device went offline
- "warning": Temp ≥35°C, Gas ≥400ppm, Humidity ≥75%
- "critical": Temp ≥42°C, Gas ≥600ppm (FIRE)
- "manual_alarm_on": Manual alarm activated
- "manual_alarm_off": Manual alarm deactivated
- "bfp_alert": Emergency alert sent to BFP
*/

// ============================================
// 2. CREATE LOG ENDPOINT
// ============================================
/*
Endpoint: POST /api/logs
Body:
{
  "deviceId": "ACES-1",
  "labName": "Computer Laboratory 1",
  "eventType": "warning",
  "temperature": 36,
  "humidity": 68,
  "gas": 350,
  "alertMessage": "High Temperature Warning - 36.0°C detected",
  "timestamp": "2024-01-15 14:28:45"
}

Response:
{
  "success": true,
  "message": "Log created successfully",
  "logId": "unique-id"
}
*/

// ============================================
// 3. CLEAR LOGS ENDPOINT
// ============================================
/*
Endpoint: POST /api/logs/clear
Body: {} (empty)

Response:
{
  "success": true,
  "message": "All logs cleared successfully"
}
*/

// ============================================
// 4. DELETE LOG ENDPOINT
// ============================================
/*
Endpoint: DELETE /api/logs/:id
Parameters:
  - id: Log entry ID

Response:
{
  "success": true,
  "message": "Log deleted successfully"
}
*/

// ============================================
// IMPORTANT NOTES FOR BACKEND
// ============================================
/*
1. CORS: Enable CORS for http://localhost:* and production domain
2. Error Handling: Include proper error messages in responses
3. Authentication: Consider adding auth tokens for security
4. Real-time Updates: Consider adding Socket.io for real-time alerts
5. Data Validation: Validate all incoming data from frontend
6. Device Names: Must match exactly (Computer Laboratory 1/2, Food Laboratory)
7. Device IDs: Must be ACES-1, ACES-2, ACES-3
8. Timestamps: Use ISO 8601 format or timestamp that can be parsed by JavaScript
9. Status Codes: Use proper HTTP status codes (200, 400, 401, 500, etc.)
10. Rate Limiting: Consider rate limiting for security

SAMPLE REQUEST from Frontend:
const response = await apiCall('GET', '/api/logs');
// This will make a GET request to: http://localhost:3000/api/logs

BACKEND CONFIGURATION IN FRONTEND:
File: js/config.js
Change BASE_URL if deploying to production:
  const API_CONFIG = {
    BASE_URL: 'http://your-backend-url:port',
    ...
  }
*/

// ============================================
// QUICK SETUP CHECKLIST
// ============================================
/*
Backend Checklist:
[ ] Create Express.js server
[ ] Set up CORS middleware
[ ] Create database (MongoDB/PostgreSQL)
[ ] Create logs table/collection with fields:
    - id, deviceId, labName, timestamp, eventType, alertMessage, temperature, humidity, gas
[ ] Implement GET /api/logs endpoint
[ ] Implement POST /api/logs endpoint
[ ] Implement POST /api/logs/clear endpoint
[ ] Add error handling
[ ] Test with Postman or similar tool
[ ] Share backend URL with frontend dev (update js/config.js)
[ ] (Optional) Implement Socket.io for real-time updates
*/
