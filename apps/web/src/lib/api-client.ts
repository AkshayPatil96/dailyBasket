import axios from 'axios';
import type {
  LoginInput,
  RegisterInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyEmailInput,
  ResendVerificationInput,
} from '@grocery-delivery/validation';
import type { Role } from '@grocery-delivery/types';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1',
  withCredentials: true,
});

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retriedAfterRefresh?: boolean;
  }
}

// Access token is a short-lived cookie; a 401 usually just means it expired.
// Refresh once (queuing concurrent 401s onto the same in-flight refresh) and
// retry the original request. If refresh itself fails, the caller decides
// what "logged out" means for that page — this interceptor never redirects.
let refreshPromise: Promise<unknown> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config) {
      return Promise.reject(error);
    }

    const { config, response } = error;
    const isAuthRoute = /\/auth\/(login|register|refresh)$/.test(config.url ?? '');

    if (response?.status !== 401 || config._retriedAfterRefresh || isAuthRoute) {
      return Promise.reject(error);
    }

    config._retriedAfterRefresh = true;
    refreshPromise ??= apiClient
      .post('/auth/refresh')
      .finally(() => {
        refreshPromise = null;
      });

    try {
      await refreshPromise;
      return apiClient(config);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: Role;
  emailVerifiedAt: string | null;
}

export interface ApiErrorBody {
  message: string | string[];
  error: string;
  statusCode: number;
}

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError<ApiErrorBody>(error) && error.response?.data?.message) {
    const { message } = error.response.data;
    return Array.isArray(message) ? message[0] : message;
  }
  return fallback;
};

export const authApi = {
  register: (input: RegisterInput) =>
    apiClient.post<AuthUser>('/auth/register', input).then((res) => res.data),

  login: (input: LoginInput) =>
    apiClient.post<AuthUser>('/auth/login', input).then((res) => res.data),

  logout: () => apiClient.post('/auth/logout').then((res) => res.data),

  me: () => apiClient.get<AuthUser>('/auth/me').then((res) => res.data),

  forgotPassword: (input: ForgotPasswordInput) =>
    apiClient
      .post<{ success: boolean; message: string }>('/auth/forgot-password', input)
      .then((res) => res.data),

  resetPassword: (input: ResetPasswordInput) =>
    apiClient.post('/auth/reset-password', input).then((res) => res.data),

  verifyEmail: (input: VerifyEmailInput) =>
    apiClient.post('/auth/verify-email', input).then((res) => res.data),

  resendVerification: (input: ResendVerificationInput) =>
    apiClient
      .post<{ success: boolean; message: string }>('/auth/resend-verification', input)
      .then((res) => res.data),

  updateProfile: (input: { firstName?: string; lastName?: string; phone?: string | null }) =>
    apiClient.post<AuthUser>('/auth/profile', input).then((res) => res.data),

  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    apiClient
      .post<{ success: boolean }>('/auth/change-password', input)
      .then((res) => res.data),

  deleteAccount: () =>
    apiClient.post<{ success: boolean }>('/auth/account/delete').then((res) => res.data),
};
