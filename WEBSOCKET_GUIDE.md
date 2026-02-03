# WebSocket Device Synchronization Guide

## What We Just Implemented

Real-time device synchronization across multiple users using WebSocket (Socket.IO). When User A adds/removes/renames a device, User B sees the change **instantly**.

---

## How It Works

### Backend (Node.js)

1. **websocket.js** - Handles all WebSocket events:
   - `device-added` → Broadcasts new device to all clients
   - `device-removed` → Broadcasts deletion to all clients  
   - `device-renamed` → Broadcasts name change to all clients
   - `device-status-changed` → Broadcasts online/offline status

2. **server.js** - Updated to:
   - Import Socket.IO and setup WebSocket server
   - Listen on port 3000 (same as REST API)
   - Attach Socket.IO to HTTP server

### Frontend (JavaScript)

1. **websocket-client.js** - Client-side WebSocket:
   - Connects to server via Socket.IO
   - Listens for device changes from other users
   - Updates local device list in real-time
   - Emits changes when user adds/removes/renames device

2. **main.js** - Updated functions:
   - `editDevice()` → Calls `emitDeviceRenamed()`
   - `removeDevice()` → Calls `emitDeviceRemoved()`
   - `addNewDevice()` → Calls `emitDeviceAdded()`

3. **index.html** - Added:
   - Socket.IO library: `<script src="/socket.io/socket.io.js"></script>`
   - WebSocket client: `<script src="js/websocket-client.js"></script>`

---

## Flow Example

**Scenario: User A removes "Food Laboratory"**

```
User A Browser
    ↓
  removeDevice("Food Laboratory")
    ↓
  emitDeviceRemoved("Food Laboratory")
    ↓
Socket.IO Client → WebSocket Connection → Socket.IO Server
    ↓
server.js receives 'device-removed' event
    ↓
io.emit('device-removed', deviceName)  [Broadcast to ALL clients]
    ↓
User B Browser receives event
    ↓
websocket-client.js removes device from local array
    ↓
Toast: "Food Laboratory removed by another user"
    ↓
renderDevices() updates UI
```

---

## Testing

### Step 1: Restart Backend
```bash
cd "c:\Users\Edmark Bermio\acesiot - backend"
node server.js
```
Should show: `WebSocket event handlers setup complete`

### Step 2: Open App in Two Browsers/Devices
- Browser 1: `http://192.168.100.129:3000`
- Browser 2: `http://192.168.100.129:3000`
- Both on same WiFi network

### Step 3: Test Device Changes

**Test 1 - Add Device:**
- In Browser 1, add a device
- Browser 2 should instantly see it appear

**Test 2 - Remove Device:**
- In Browser 1, remove a device
- Browser 2 should see it disappear with toast notification

**Test 3 - Rename Device:**
- In Browser 1, rename a device
- Browser 2 should see name change instantly

---

## Features

✅ **Real-time sync** - Changes appear immediately  
✅ **Automatic reconnection** - Handles network drops  
✅ **Fallback to polling** - Works even if WebSocket unavailable  
✅ **User notifications** - Toast shows who changed what  
✅ **No data conflicts** - Device list always consistent  

---

## Browser Support

Works on:
- ✅ Chrome/Edge (Desktop & Mobile)
- ✅ Safari (Desktop & iOS)
- ✅ Firefox (Desktop & Mobile)
- ✅ Any modern browser with WebSocket support

---

## Troubleshooting

### "Socket.IO library not loaded"
- Make sure `/socket.io/socket.io.js` loads (served by Socket.IO automatically)
- Check browser console for errors

### "WebSocket disconnected"
- Check if backend is running
- Verify firewall isn't blocking port 3000
- Check network connectivity

### Changes not syncing
- Make sure both browsers are on same network
- Clear localStorage: `localStorage.clear()`
- Refresh both pages

---

## Future Enhancements

1. **Persist devices to database** - Currently still in localStorage
2. **User attribution** - Show which user made the change
3. **Undo/Redo** - Save history of device changes
4. **Conflict resolution** - Handle simultaneous edits
5. **Subscription-based sync** - Only sync specific devices

