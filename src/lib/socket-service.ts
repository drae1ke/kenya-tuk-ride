import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000';

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => console.log('[Socket] Connected:', socket?.id));
  socket.on('disconnect', (reason) => console.log('[Socket] Disconnected:', reason));
  socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message));

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

// ─── CLIENT EMITTERS ────────────────────────────────────────────────────────

export function emitRideRequest(payload: {
  pickup: { latitude: number; longitude: number; address: string };
  destination: { latitude: number; longitude: number; address: string };
  vehicleType?: string;
  paymentMethod?: string;
}) {
  socket?.emit('ride:request', payload);
}

export function emitCancelRide(rideId: string, reason?: string) {
  socket?.emit('ride:cancel', { rideId, reason: reason || 'Cancelled by user' });
}

// ─── DRIVER EMITTERS ────────────────────────────────────────────────────────

export function emitDriverOnline() {
  socket?.emit('driver:online');
}

export function emitDriverOffline() {
  socket?.emit('driver:offline');
}

export function emitDriverLocation(lat: number, lng: number, heading?: number, speed?: number) {
  socket?.emit('driver:location', { latitude: lat, longitude: lng, heading, speed });
}

export function emitAcceptRide(rideId: string) {
  socket?.emit('ride:accept', { rideId });
}

export function emitArrivedAtPickup(rideId: string) {
  socket?.emit('ride:arrived', { rideId });
}

export function emitStartRide(rideId: string) {
  socket?.emit('ride:start', { rideId });
}

export function emitCompleteRide(rideId: string) {
  socket?.emit('ride:complete', { rideId });
}

export function emitRideMessage(rideId: string, text: string) {
  socket?.emit('ride:message', { rideId, text });
}

// ─── EVENT TYPES ─────────────────────────────────────────────────────────────

export interface RideRequestedEvent {
  rideId: string;
  fare: number;
  distance: number;
  duration: number;
  status: string;
}

export interface RideAcceptedEvent {
  rideId: string;
  driver: {
    id: string;
    name: string;
    phone: string;
    rating: number;
    vehicle: { make: string; model: string; plateNumber: string };
    profilePhoto?: string;
  };
  driverLocation: { coordinates: [number, number] };
  eta: string;
}

export interface RideNewRequestEvent {
  rideId: string;
  pickup: { coordinates: [number, number]; address: string };
  destination: { coordinates: [number, number]; address: string };
  fare: number;
  distance: number;
  duration: number;
  timestamp: string;
}

export interface LocationUpdateEvent {
  rideId: string;
  location: { latitude: number; longitude: number };
  remainingDistance: number;
}

export interface DriverLocationUpdateEvent {
  driverId: string;
  location: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  };
}

export interface RideMessageEvent {
  rideId: string;
  message: {
    senderType: 'user' | 'driver' | 'admin';
    senderId: string;
    text: string;
    createdAt: string;
  };
}

