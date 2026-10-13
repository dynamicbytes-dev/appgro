import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const TOKEN_KEY = 'agro_jwt_token';
const REFRESH_TOKEN_KEY = 'agro_refresh_token';

const USER_KEY = 'agro_user_data';

export const tokenStorage = {
  getToken: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
      console.error('Failed to set token in storage', e);
    }
  },
  getUser: (): any | null => {
    try {
      const data = localStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  setUser: (user: any) => {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('Failed to set user in storage', e);
    }
  },
  getRefreshToken: (): string | null => {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setRefreshToken: (token: string) => {
    try {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } catch (e) {
      console.error('Failed to set refresh token in storage', e);
    }
  },
  clearTokens: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {
      console.error('Failed to clear tokens', e);
    }
  },
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

let onSessionExpiredCallback: (() => void) | null = null;

export const setOnSessionExpired = (callback: () => void) => {
  onSessionExpiredCallback = callback;
};

// Request Interceptor: Attach JWT Token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response Interceptor: Handle 401 & Automatic Refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      originalRequest &&
      (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh'))
    ) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
          headers: {
            Authorization: `Bearer ${tokenStorage.getToken()}`
          }
        });

        const newAccessToken = data.data?.access_token || data.access_token;
        if (newAccessToken) {
          tokenStorage.setToken(newAccessToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }

          processQueue(null, newAccessToken);
          return api(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        tokenStorage.clearTokens();
        if (onSessionExpiredCallback) {
          onSessionExpiredCallback();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
