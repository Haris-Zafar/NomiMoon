/**
 * API Service
 *
 * Centralized Axios instance for all API calls.
 *
 * FEATURES:
 * - Automatic JWT token inclusion
 * - Token refresh on 401
 * - Request/response interceptors
 * - Error handling
 * - Base URL configuration
 */

import axios from 'axios';

// Base URL - uses proxy in development, absolute URL in production
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Create Axios instance
 */
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds
});

/**
 * Request Interceptor
 *
 * Automatically adds JWT token to all requests
 */
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('accessToken');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 *
 * Handles token refresh and global error handling
 */
api.interceptors.response.use(
  (response) => {
    // Return successful responses as-is
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh the access token
        const refreshToken = localStorage.getItem('refreshToken');

        if (!refreshToken) {
          // No refresh token, redirect to login
          throw new Error('No refresh token');
        }

        // Call refresh endpoint (without interceptor to avoid loop)
        const { data } = await axios.post(`${BASE_URL}/auth/refresh-token`, {
          refreshToken,
        });

        // Save new access token
        localStorage.setItem('accessToken', data.data.accessToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');

        // Redirect to login
        window.location.href = '/login';

        return Promise.reject(refreshError);
      }
    }

    // For other errors, just reject
    return Promise.reject(error);
  }
);

/**
 * API Helper Functions
 */

/**
 * Extract error message from API response
 */
export const getErrorMessage = (error) => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

/**
 * Authentication API calls
 */
export const authAPI = {
  // Signup
  signup: (data) => api.post('/auth/signup', data),

  // Login
  login: (credentials) => api.post('/auth/login', credentials),

  // Verify email
  verifyEmail: (token) => api.get(`/auth/verify-email/${token}`),

  // Resend verification
  resendVerification: (email) =>
    api.post('/auth/resend-verification', { email }),

  // Forgot password
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),

  // Reset password
  resetPassword: (token, password, passwordConfirm) =>
    api.post(`/auth/reset-password/${token}`, { password, passwordConfirm }),

  // Get current user
  getMe: () => api.get('/auth/me'),

  // Update password
  updatePassword: (data) => api.patch('/auth/update-password', data),

  // Update profile
  updateProfile: (data) => api.patch('/auth/profile', data),

  // Logout
  logout: () => api.post('/auth/logout'),

  // Delete account
  deleteAccount: () => api.delete('/auth/account'),

  googleLogin: (idToken) => api.post('/auth/google', { idToken }),
};

export default api;

/**
 * USAGE EXAMPLES:
 *
 * 1. Login:
 * ```jsx
 * import { authAPI } from './services/api';
 *
 * const handleLogin = async () => {
 *   try {
 *     const { data } = await authAPI.login({ email, password });
 *     localStorage.setItem('accessToken', data.data.accessToken);
 *     localStorage.setItem('refreshToken', data.data.refreshToken);
 *   } catch (error) {
 *     console.error(getErrorMessage(error));
 *   }
 * };
 * ```
 *
 * 2. Protected request (token added automatically):
 * ```jsx
 * const { data } = await authAPI.getMe();
 * ```
 *
 * 3. Custom API call:
 * ```jsx
 * import api from './services/api';
 *
 * const { data } = await api.get('/posts');
 * ```
 */
