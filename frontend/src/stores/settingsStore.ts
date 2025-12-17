import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 폰트 사이즈 단계 정의
export type FontSizeLevel = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const fontSizeLevels: FontSizeLevel[] = ['xs', 'sm', 'md', 'lg', 'xl'];

// 각 레벨별 실제 CSS 클래스/값 매핑
export const fontSizeConfig: Record<FontSizeLevel, {
  label: string;
  title: string;
  body: string;
  meta: string;
  icon: string;  // 아이콘 사이즈
  iconWrapper: string; // 아이콘 wrapper 사이즈
  gap: string;
}> = {
  xs: {
    label: '아주 작게',
    title: 'text-xs',
    body: 'text-[10px]',
    meta: 'text-[9px]',
    icon: 'w-3 h-3',
    iconWrapper: 'w-5 h-5',
    gap: 'gap-1',
  },
  sm: {
    label: '작게',
    title: 'text-sm',
    body: 'text-xs',
    meta: 'text-[10px]',
    icon: 'w-3.5 h-3.5',
    iconWrapper: 'w-6 h-6',
    gap: 'gap-1.5',
  },
  md: {
    label: '보통',
    title: 'text-base',
    body: 'text-sm',
    meta: 'text-xs',
    icon: 'w-4 h-4',
    iconWrapper: 'w-7 h-7',
    gap: 'gap-2',
  },
  lg: {
    label: '크게',
    title: 'text-lg',
    body: 'text-base',
    meta: 'text-sm',
    icon: 'w-5 h-5',
    iconWrapper: 'w-8 h-8',
    gap: 'gap-2.5',
  },
  xl: {
    label: '아주 크게',
    title: 'text-xl',
    body: 'text-base',
    meta: 'text-sm',
    icon: 'w-6 h-6',
    iconWrapper: 'w-9 h-9',
    gap: 'gap-3',
  },
};

interface SettingsStore {
  // 크루즈 속도 (0-100 퍼센트)
  cruiseSpeedPercent: number;
  setCruiseSpeedPercent: (percent: number) => void;

  // 폰트 사이즈
  fontSizeLevel: FontSizeLevel;
  setFontSizeLevel: (level: FontSizeLevel) => void;

  // 미디어 모달 뷰 모드 (1개 또는 2개)
  mediaViewMode: 1 | 2;
  setMediaViewMode: (mode: 1 | 2) => void;

  // 미디어 모달 읽기 방향 (ltr: 왼→오, rtl: 오→왼)
  mediaReadDirection: 'ltr' | 'rtl';
  setMediaReadDirection: (direction: 'ltr' | 'rtl') => void;

  // 미디어 모달 듀얼 뷰 정렬 (center: 중앙 모아보기, spread: 좌우 분리)
  mediaDualAlignment: 'center' | 'spread';
  setMediaDualAlignment: (alignment: 'center' | 'spread') => void;

  // 앱바 필터
  filter: 'all' | 'unread' | 'read' | 'favorite';
  setFilter: (filter: 'all' | 'unread' | 'read' | 'favorite') => void;

  // 앱바 뷰 모드
  viewMode: 'board' | 'feed';
  setViewMode: (mode: 'board' | 'feed') => void;

  // 칼럼 수
  columns: number;
  setColumns: (columns: number) => void;

  // 크루즈 컨트롤 표시 여부
  showCruisingControls: boolean;
  setShowCruisingControls: (show: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      // 크루즈 속도 기본값 30%
      cruiseSpeedPercent: 30,
      setCruiseSpeedPercent: (percent) => set({ cruiseSpeedPercent: Math.max(0, Math.min(100, percent)) }),

      // 폰트 사이즈 기본값 md
      fontSizeLevel: 'md',
      setFontSizeLevel: (level) => set({ fontSizeLevel: level }),

      // 미디어 모달 뷰 모드 기본값 1개
      mediaViewMode: 1,
      setMediaViewMode: (mode) => set({ mediaViewMode: mode }),

      // 미디어 모달 읽기 방향 기본값 ltr (왼→오)
      mediaReadDirection: 'ltr',
      setMediaReadDirection: (direction) => set({ mediaReadDirection: direction }),

      // 미디어 모달 듀얼 뷰 정렬 기본값 spread (좌우 분리)
      mediaDualAlignment: 'spread',
      setMediaDualAlignment: (alignment) => set({ mediaDualAlignment: alignment }),

      // 앱바 필터 기본값 all
      filter: 'all',
      setFilter: (filter) => set({ filter }),

      // 앱바 뷰 모드 기본값 feed
      viewMode: 'feed',
      setViewMode: (viewMode) => set({ viewMode }),

      // 칼럼 수 기본값 3
      columns: 3,
      setColumns: (columns) => set({ columns }),

      // 크루즈 컨트롤 표시 기본값 true
      showCruisingControls: true,
      setShowCruisingControls: (show) => set({ showCruisingControls: show }),
    }),
    {
      name: 'drss-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
