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
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean; _retry502?: boolean }) | undefined;

    if (!original) {
      return Promise.reject(error);
    }

    const isAuthFlowEndpoint = /\/auth\/(login|register|refresh)$/.test(original.url ?? "");

    // If request fails with 502 Bad Gateway or 503 Service Unavailable (e.g. Render container cold start)
    // and hasn't been retried yet, wait 2.5s and retry once transparently.
    const status = error.response?.status;
    if ((status === 502 || status === 503) && !original._retry502 && !isAuthFlowEndpoint) {
      original._retry502 = true;
      await new Promise((resolve) => setTimeout(resolve, 2500));
      return api(original);
    }

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
