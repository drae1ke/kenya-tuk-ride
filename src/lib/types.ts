export type UserRole = 'client' | 'driver' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  suspended?: boolean;
  createdAt: string;
}

export interface Driver extends User {
  role: 'driver';
  vehicle: string;
  licensePlate: string;
  rating: number;
  totalTrips: number;
  earnings: number;
  documents: DriverDocument[];
  online: boolean;
  location?: { lat: number; lng: number };
}

export interface DriverDocument {
  id: string;
  type: 'license' | 'insurance' | 'vehicle_registration' | 'good_conduct';
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: string;
}

export interface RideOrder {
  id: string;
  clientId: string;
  clientName: string;
  driverId?: string;
  driverName?: string;
  pickup: string;
  dropoff: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  fare: number;
  paymentMethod: 'mpesa' | 'cash';
  distance: string;
  duration: string;
  createdAt: string;
}

export interface PricingConfig {
  baseFare: number;
  perKm: number;
  perMinute: number;
  minimumFare: number;
  surgePricing: number;
}
