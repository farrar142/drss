import { create } from 'zustand';
import { SignupStatusSchema, usersRouterGetSignupStatus } from '@/services/api';

interface SiteState {
  siteName: string;
  allowSignup: boolean;
  loaded: boolean;
  initializeSiteSettings: (settings: SignupStatusSchema) => void;
  loadSiteSettings: () => Promise<void>;
}

export const useSiteStore = create<SiteState>((set, get) => ({
  siteName: 'DRSS',
  allowSignup: true,
  loaded: false,

  // 서버에서 받은 초기 설정을 즉시 적용 (플래시 방지)
  initializeSiteSettings: (settings: SignupStatusSchema) => {
    if (get().loaded) return;

    set({
      siteName: settings.site_name || 'DRSS',
      allowSignup: settings.allow_signup,
      loaded: true,
    });

    // 브라우저 타이틀 업데이트
    if (typeof document !== 'undefined') {
      document.title = settings.site_name || 'DRSS';
    }
  },

  loadSiteSettings: async () => {
    if (get().loaded) return;

    try {
      const status = await usersRouterGetSignupStatus();
      set({
        siteName: status.site_name || 'DRSS',
        allowSignup: status.allow_signup,
        loaded: true,
      });

      // 브라우저 타이틀 업데이트
      if (typeof document !== 'undefined') {
        document.title = status.site_name || 'DRSS';
      }
    } catch {
      // 에러 시 기본값 유지
      set({ loaded: true });
    }
  },
}));

// 사이트 이름 훅 (편의용)
export function useSiteName() {
  const { siteName, loaded, loadSiteSettings } = useSiteStore();
  return { siteName, loaded, loadSiteSettings };
}
