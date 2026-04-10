const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
};

const request = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed');
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
};

export type AuthResponse = {
  status: string;
  token: string;
  data: {
    user: BackendAuthUser;
    userType: AuthUserType;
  };
};

export type MeResponse = {
  status: string;
  data: {
    user: BackendAuthUser;
    userType: AuthUserType;
  };
};

export const authApi = {
  registerUser: (body: { name: string; email: string; phone: string; password: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body }),
  registerDriver: (body: {
    name: string;
    email: string;
    phone: string;
    password: string;
    idNumber: string;
    licenseNumber: string;
    vehicle: { make: string; model: string; year: number; color: string; plateNumber: string; type: 'tuktuk' | 'bajaj' | 'auto'; capacity: number };
  }) => request<AuthResponse>('/auth/driver/register', { method: 'POST', body }),
  loginUser: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body }),
  loginDriver: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/driver/login', { method: 'POST', body }),
  me: (token: string) => request<MeResponse>('/auth/me', { token }),
};

