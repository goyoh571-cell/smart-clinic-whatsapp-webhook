// ============================================================================
// SOCKET.IO CLIENT HELPER & CLINIC ROOM MANAGER
// ============================================================================

import { io } from 'socket.io-client';

let socket = null;

export function getSocket(serverUrl = 'http://localhost:4000') {
  if (!socket) {
    socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 5,
      timeout: 5000,
    });
  }
  return socket;
}

export function joinClinicRoom(clinicId = 1) {
  if (socket && socket.connected) {
    socket.emit('join_clinic_room', clinicId);
  }
}
