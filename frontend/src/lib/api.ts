import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/authStore";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1",
});

// Attach the access token to every outgoing request automatically — this is
// the step you were doing by hand in Swagger's Authorize dialog.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;

// If a request comes back 401 (access token expired), silently use the
// refresh token to get a new one and retry — the user never sees this happen.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    const isAuthFlowEndpoint = /\/auth\/(login|register|refresh)$/.test(original.url ?? "");
    if (error.response?.status !== 401 || original._retry || isAuthFlowEndpoint) {
      return Promise.reject(error);
    }
    original._retry = true;

    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    if (!refreshInFlight) {
      refreshInFlight = axios
        .post(`${api.defaults.baseURL}/auth/refresh`, { refresh_token: refreshToken })
        .then((res) => {
          const { access_token, refresh_token } = res.data;
          useAuthStore.getState().setTokens(access_token, refresh_token);
          return access_token as string;
        })
        .catch(() => {
          useAuthStore.getState().logout();
          return null;
        })
        .finally(() => {
          refreshInFlight = null;
        });
    }

    const newToken = await refreshInFlight;
    if (!newToken) return Promise.reject(error);

    original.headers.Authorization = `Bearer ${newToken}`;
    return api(original);
  }
);
