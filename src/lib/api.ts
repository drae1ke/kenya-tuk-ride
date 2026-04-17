const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const SESSION_TOKEN_KEY = 'tookride.auth.token';
const TAB_SESSION_KEY = 'tookride.session.id';

export const getTabSessionId = () => {
  let sessionId = sessionStorage.getItem(TAB_SESSION_KEY);
  if (!sessionId) {
    sessionId = `sess_${crypto.randomUUID()}`;
    sessionStorage.setItem(TAB_SESSION_KEY, sessionId);
  }
  return sessionId;
};

type Options = { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; token?: string | null };

const request = async <T>(path: string, opts: Options = {}): Promise<T> => {
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      'x-session-id': getTabSessionId(),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const payload = await res.json();
  if (!res.ok) {
    // Surface the backend's human-readable error message
    throw new Error(payload?.message || `Request failed (${res.status})`);
  }
  return payload as T;
};

export type AuthUserType = 'user' | 'driver';

export type BackendAuthUser = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role?: 'user' | 'admin' | 'driver';
  profilePhoto?: string;
  emergencyContact?: { name?: string; phone?: string; relationship?: string };
};

export type AuthResponse = {
  status: string; token: string;
  data: { user: BackendAuthUser; userType: AuthUserType };
};

export type MeResponse = {
  status: string;
  data: { user: BackendAuthUser; userType: AuthUserType };
};

const authRequest = async <T>(path: string, opts: Options = {}) => {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  return request<T>(path, { ...opts, token });
};

export const authApi = {
  registerUser: (body: { name: string; email: string; phone: string; password: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body }),

  registerDriver: (body: {
    name: string; email: string; phone: string; password: string;
    idNumber: string; licenseNumber: string;
    vehicle: { make: string; model: string; year: number; color: string; plateNumber: string; type: 'tuktuk' | 'bajaj' | 'auto'; capacity: number };
  }) => request<AuthResponse>('/auth/driver/register', { method: 'POST', body }),

  loginUser: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body }),

  loginDriver: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/driver/login', { method: 'POST', body }),

  me: (token: string) =>
    request<MeResponse>('/auth/me', { token }),
  getSessions: () =>
    authRequest<{ status: string; data: { sessions: Array<{ sessionId: string; lastSeenAt: string; userAgent?: string; createdAt: string }> } }>('/auth/sessions'),
  logoutSession: (sessionId: string) =>
    authRequest<{ status: string; message: string }>(`/auth/sessions/${sessionId}`, { method: 'DELETE' }),
};

export type AdminDriversResponse = {
  status: string;
  data: { drivers: any[]; count: number };
};

export type AdminClientsResponse = {
  status: string;
  data: { clients: any[]; count: number };
};

export const adminApi = {
  getDashboard: () => authRequest<{ status: string; data: { stats: any; recentRides: any[] } }>('/admin/dashboard'),
  getPricing: () => authRequest<{ status: string; data: { pricing: any } }>('/admin/pricing'),
  updatePricing: (body: Record<string, number>) =>
    authRequest<{ status: string; data: { pricing: any } }>('/admin/pricing', { method: 'PATCH', body }),
  getDrivers: () => authRequest<AdminDriversResponse>('/admin/drivers'),
  getClients: () => authRequest<AdminClientsResponse>('/admin/clients'),
  updateDriverStatus: (driverId: string, status: 'active' | 'pending' | 'suspended' | 'rejected') =>
    authRequest<{ status: string; data: { driver: any } }>(`/admin/drivers/${driverId}`, { method: 'PATCH', body: { status } }),
  deleteDriver: (driverId: string) =>
    authRequest<{ status: string; message: string }>(`/admin/drivers/${driverId}`, { method: 'DELETE' }),
  updateClientStatus: (clientId: string, isActive: boolean) =>
    authRequest<{ status: string; data: { client: any } }>(`/admin/clients/${clientId}`, { method: 'PATCH', body: { isActive } }),
  deleteClient: (clientId: string) =>
    authRequest<{ status: string; message: string }>(`/admin/clients/${clientId}`, { method: 'DELETE' }),
};

export const userApi = {
  getProfile: () => authRequest<{ status: string; data: { user: BackendAuthUser; stats: any; activeRide: any } }>('/users/profile'),
  updateProfile: (body: Record<string, unknown>) =>
    authRequest<{ status: string; data: { user: BackendAuthUser } }>('/users/profile', { method: 'PATCH', body }),
};

export const driverApi = {
  getProfile: () => authRequest<{ status: string; data: { driver: any; summary: any } }>('/drivers/profile'),
  updateProfile: (body: Record<string, unknown>) =>
    authRequest<{ status: string; data: { driver: any } }>('/drivers/profile', { method: 'PATCH', body }),
};

export const rideApi = {
  estimate: (body: Record<string, unknown>) =>
    authRequest<{ status: string; data: { estimate: any } }>('/rides/estimate', { method: 'POST', body }),
  getNearbyDrivers: (latitude: number, longitude: number, radius = 4) =>
    authRequest<{ status: string; data: { drivers: any[]; count: number } }>(`/rides/user/nearby-drivers?latitude=${latitude}&longitude=${longitude}&radius=${radius}`),
  getMessages: (rideId: string) =>
    authRequest<{ status: string; data: { messages: any[] } }>(`/rides/${rideId}/messages`),
  sendMessage: (rideId: string, text: string) =>
    authRequest<{ status: string; data: { message: any } }>(`/rides/${rideId}/messages`, { method: 'POST', body: { text } }),
};
