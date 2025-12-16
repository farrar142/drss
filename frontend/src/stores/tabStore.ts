import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type TabType = 'home' | 'category' | 'feed' | 'settings';

export interface Tab {
  id: string;
  type: TabType;
  title: string;
  path: string;
  // 카테고리나 피드의 경우 ID 저장
  resourceId?: number;
  // 피드의 경우 favicon URL
  favicon?: string;
  // 탭별 상태
  scrollPosition?: number;
  filter?: 'all' | 'unread' | 'read' | 'favorite';
}

interface TabStore {
  tabs: Tab[];
  activeTabId: string | null;
  
  // 액션들
  addTab: (tab: Omit<Tab, 'id'>) => string;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;
  
  // 탭 찾기
  findTabByPath: (path: string) => Tab | undefined;
  findTabByResource: (type: TabType, resourceId?: number) => Tab | undefined;
  
  // 탭으로 이동 또는 새 탭 생성
  openTab: (tab: Omit<Tab, 'id'>) => string;
  
  // 스크롤 위치 저장/복원
  saveScrollPosition: (tabId: string, position: number) => void;
  getScrollPosition: (tabId: string) => number;
}

// 고유 ID 생성
const generateId = () => `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// 기본 홈 탭
const DEFAULT_HOME_TAB: Tab = {
  id: 'tab_home',
  type: 'home',
  title: '메인스트림',
  path: '/home',
};

export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      tabs: [DEFAULT_HOME_TAB],
      activeTabId: 'tab_home',

      addTab: (tabData) => {
        const id = generateId();
        const newTab: Tab = { ...tabData, id };
        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: id,
        }));
        return id;
      },

      removeTab: (tabId) => {
        const { tabs, activeTabId } = get();
        
        // 최소 1개의 탭은 유지
        if (tabs.length <= 1) return;
        
        const tabIndex = tabs.findIndex((t) => t.id === tabId);
        if (tabIndex === -1) return;
        
        const newTabs = tabs.filter((t) => t.id !== tabId);
        
        // 삭제되는 탭이 활성 탭이면 다른 탭으로 전환
        let newActiveId = activeTabId;
        if (activeTabId === tabId) {
          // 왼쪽 탭 우선, 없으면 오른쪽 탭
          const newIndex = Math.min(tabIndex, newTabs.length - 1);
          newActiveId = newTabs[newIndex]?.id || null;
        }
        
        set({ tabs: newTabs, activeTabId: newActiveId });
      },

      setActiveTab: (tabId) => {
        const tab = get().tabs.find((t) => t.id === tabId);
        if (tab) {
          set({ activeTabId: tabId });
        }
      },

      updateTab: (tabId, updates) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, ...updates } : tab
          ),
        }));
      },

      findTabByPath: (path) => {
        return get().tabs.find((t) => t.path === path);
      },

      findTabByResource: (type, resourceId) => {
        return get().tabs.find((t) => {
          if (t.type !== type) return false;
          if (resourceId !== undefined) return t.resourceId === resourceId;
          return true;
        });
      },

      openTab: (tabData) => {
        const { tabs, addTab, setActiveTab, findTabByPath } = get();
        
        // 이미 같은 경로의 탭이 있으면 해당 탭으로 전환
        const existingTab = findTabByPath(tabData.path);
        if (existingTab) {
          setActiveTab(existingTab.id);
          return existingTab.id;
        }
        
        // 새 탭 추가
        return addTab(tabData);
      },

      saveScrollPosition: (tabId, position) => {
        set((state) => ({
          tabs: state.tabs.map((tab) =>
            tab.id === tabId ? { ...tab, scrollPosition: position } : tab
          ),
        }));
      },

      getScrollPosition: (tabId) => {
        const tab = get().tabs.find((t) => t.id === tabId);
        return tab?.scrollPosition || 0;
      },
    }),
    {
      name: 'drss-tabs',
      storage: createJSONStorage(() => localStorage),
      // 탭 수가 너무 많아지지 않도록 저장 시 최대 10개로 제한
      partialize: (state) => ({
        tabs: state.tabs.slice(0, 10),
        activeTabId: state.activeTabId,
      }),
    }
  )
);
