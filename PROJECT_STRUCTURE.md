ACES IoT System - Project Structure
===================================

Frontend (Current - Ready for Backend)
├── acesiot/
│   ├── index.html (Dashboard)
│   ├── logs.html (Event Logs - ready for API)
│   ├── device.html (Device Details)
│   ├── alerts.html (Alerts Settings)
│   ├── contacts.html (Contacts)
│   │
│   ├── css/
│   │   └── style.css (All styling including logs page)
│   │
│   ├── js/
│   │   ├── config.js (NEW - Backend API configuration)
│   │   ├── main.js (Dashboard logic + event logging)
│   │   ├── device.js (Device detail page)
│   │   ├── alerts.js (Alerts modal)
│   │   └── logs.js (Logs page - NOW WITH API INTEGRATION)
│   │
│   ├── assets/
│   │   ├── fonts/
│   │   └── icons/
│   │
│   ├── FRONTEND_READY.md (This project summary)
│   └── BACKEND_INTEGRATION_GUIDE.md (For backend developer)
│
└── acesiot-backend/ (To be created by backend developer)
    ├── package.json
    ├── server.js
    ├── routes/
    │   ├── logs.js (GET, POST, DELETE /api/logs)
    │   └── events.js (POST /api/events)
    ├── models/
    │   └── Log.js (Database schema)
    ├── middleware/
    │   └── cors.js
    └── config/
        └── database.js

---

API Endpoints Expected by Frontend
===================================

GET /api/logs
  - Fetch logs with optional filtering
  - Returns: { success: true, logs: [...], total: N }

POST /api/logs
  - Create a new log entry
  - Body: { deviceId, labName, eventType, temperature, humidity, gas, ... }
  - Returns: { success: true, logId: "..." }

POST /api/logs/clear
  - Clear all logs
  - Returns: { success: true, message: "..." }

DELETE /api/logs/:id
  - Delete specific log
  - Returns: { success: true, message: "..." }

POST /api/events (Optional - alternative to POST /api/logs)
  - Log an event
  - Body: { deviceId, labName, eventType, alertMessage, ... }
  - Returns: { success: true, message: "..." }

---

Device Information
==================

Device IDs: ACES-1, ACES-2, ACES-3

Device Names (Lab Names):
- ACES-1 → Computer Laboratory 1
- ACES-2 → Computer Laboratory 2
- ACES-3 → Food Laboratory

Device Properties:
- temperature (°C)
- humidity (%)
- gas (ppm)
- online (boolean)
- lastResponse (timestamp)

Alert Thresholds:
- Warning: Temp ≥ 35°C, Gas ≥ 400 ppm, Humidity ≥ 75%
- Critical: Temp ≥ 42°C, Gas ≥ 600 ppm
- Fire: Temp ≥ 42°C AND Gas ≥ 600 ppm

---

Event Types to Log
==================

1. device_online - Device came back online
2. device_offline - Device went offline
3. warning - Sensor reached warning threshold
4. critical - Sensor reached critical threshold
5. manual_alarm_on - Manual alarm button activated
6. manual_alarm_off - Manual alarm button deactivated
7. bfp_alert - Emergency alert sent to Bureau of Fire Protection

---

Backend Configuration in Frontend
==================================

File: js/config.js

Current: BASE_URL = 'http://localhost:3000'

For Production:
Change to: BASE_URL = 'https://your-backend-domain.com'

---

Development Flow
================

1. Frontend Developer:
   ✅ UI/UX complete
   ✅ Sample data working
   ✅ API integration ready
   ✅ Using fallback data during backend development

2. Backend Developer:
   ⏳ Set up Node.js + Express server
   ⏳ Create database (MongoDB/PostgreSQL)
   ⏳ Implement API endpoints (listed above)
   ⏳ Test endpoints with Postman

3. Integration:
   ⏳ Update js/config.js with backend URL
   ⏳ Test logs page with real data
   ⏳ Test event logging from devices
   ⏳ Full system testing

4. Deployment:
   ⏳ Deploy frontend to hosting (Netlify, Vercel, etc.)
   ⏳ Deploy backend to server (Railway, Render, AWS, etc.)
   ⏳ Update BASE_URL for production
   ⏳ Set up database backups

---

Key Features Ready
==================

Frontend:
✅ Responsive design (mobile, tablet, desktop)
✅ Dark mode toggle (persistent with localStorage)
✅ Device management (add, edit, remove)
✅ Real-time sensor display
✅ Alert settings modal
✅ Emergency alert display
✅ Logs page with filtering
✅ Critical-only toggle
✅ Device filter dropdown
✅ Clear logs button
✅ API integration with fallback
✅ Error handling

Backend (To Be Implemented):
⏳ REST API server
⏳ Database storage
⏳ Event logging
⏳ Real-time updates (Socket.io - optional but recommended)
⏳ Authentication (optional for future)
⏳ Rate limiting (for security)

---

Current Backend Configuration
=============================

Location: js/config.js
Timeout: 5 seconds
Fallback: Enabled (uses sample data if API fails)
Enable API: true

To disable API and use only sample data:
- Set ENABLE_API: false in config.js

---

Ready for Integration!
=====================

The frontend is production-ready and waiting for the backend.
All API integration points are documented and implemented.
Sample data ensures the UI works during backend development.
Zero UI/UX changes after backend connection.
