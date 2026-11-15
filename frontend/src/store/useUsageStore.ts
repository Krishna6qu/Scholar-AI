import { create } from "zustand";
import { api } from "@/lib/api";

export interface FeatureUsage {
  used: number;
  limit: number;
}

export interface UsageData {
  quiz: FeatureUsage;
  flashcards: FeatureUsage;
  mindmap: FeatureUsage;
  roadmap: FeatureUsage;
  note: FeatureUsage;
  resets_in_hours: number;
  any_limit_reached: boolean;
  limit_reached_features: string[];
}

interface UsageState {
  usage: UsageData | null;
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  fetchUsage: (force?: boolean) => Promise<UsageData | null>;
  consumeEnergy: (feature: "quiz" | "flashcards" | "mindmap" | "roadmap" | "note") => void;
  resetUsage: () => void;
}

export const useUsageStore = create<UsageState>((set, get) => ({
  usage: null,
  loading: false,
  error: null,
  lastFetchedAt: null,

  fetchUsage: async (force = false) => {
    const { loading, lastFetchedAt } = get();
    // Cache for 4 seconds unless force refresh is requested
    if (!force && loading) return get().usage;
    if (!force && lastFetchedAt && Date.now() - lastFetchedAt < 4000 && get().usage) {
      return get().usage;
    }

    set({ loading: true, error: null });
    try {
      // Add timestamp and no-cache headers so browser / proxy never serves stale cached data
      const { data } = await api.get<UsageData>(`/auth/me/usage?_t=${Date.now()}`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
      set({
        usage: data,
        loading: false,
        error: null,
        lastFetchedAt: Date.now(),
      });
      return data;
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? "Could not sync usage quotas.";
      set({ loading: false, error: msg });
      return null;
    }
  },

  consumeEnergy: (feature) => {
    set((state) => {
      const baseUsage: UsageData = state.usage ?? {
        quiz: { used: 0, limit: 6 },
        flashcards: { used: 0, limit: 6 },
        mindmap: { used: 0, limit: 6 },
        roadmap: { used: 0, limit: 6 },
        note: { used: 0, limit: 6 },
        resets_in_hours: 5,
        any_limit_reached: false,
        limit_reached_features: [],
      };
      const currentFeature = baseUsage[feature];
      const newUsed = Math.min(currentFeature.limit, currentFeature.used + 1);
      const updatedFeature = { ...currentFeature, used: newUsed };
      const newUsage = { ...baseUsage, [feature]: updatedFeature };
      const reached = (["quiz", "flashcards", "mindmap", "roadmap", "note"] as const).filter(
        (k) => (newUsage[k]?.used ?? 0) >= (newUsage[k]?.limit ?? 6)
      );
      return {
        usage: {
          ...newUsage,
          any_limit_reached: reached.length > 0,
          limit_reached_features: reached,
        },
      };
    });

    // Re-sync with backend after database write
    setTimeout(() => {
      get().fetchUsage(true);
    }, 800);
  },

  resetUsage: () => {
    set({ usage: null, loading: false, error: null, lastFetchedAt: null });
  },
}));
