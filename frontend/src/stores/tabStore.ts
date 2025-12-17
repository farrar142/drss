import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type TabType = 'home' | 'category' | 'feed' | 'settings' | 'rss-everything';

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
  // Feed 모드에서 컬럼 수 (min: 1, default: 3, max: 5)
  columns?: number;
}

// 패널 ID 타입
export type PanelId = 'left' | 'right';

// 패널 상태
export interface Panel {
  id: PanelId;
  tabs: Tab[];
  activeTabId: string | null;
}

interface TabStore {
  // 패널 기반 구조
  panels: Panel[];
  activePanelId: PanelId;

  // 기존 호환성을 위한 computed 값들
  tabs: Tab[];
  activeTabId: string | null;

  // 패널 액션
  setActivePanel: (panelId: PanelId) => void;
  moveTabToPanel: (tabId: string, targetPanelId: PanelId) => void;
  createSplitPanel: (tabId: string, side: 'left' | 'right') => void;
  closeSplitPanel: (panelId: PanelId) => void;

  // 탭 액션들
  addTab: (tab: Omit<Tab, 'id'>, panelId?: PanelId) => string;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Tab>) => void;

  // 탭 찾기
  findTabByPath: (path: string) => Tab | undefined;
  findTabByResource: (type: TabType, resourceId?: number) => Tab | undefined;

  // 탭으로 이동 또는 새 탭 생성
  openTab: (tab: Omit<Tab, 'id'>, panelId?: PanelId) => string;

  // 스크롤 위치 저장/복원
  saveScrollPosition: (tabId: string, position: number) => void;
  getScrollPosition: (tabId: string) => number;

  // 컬럼 수 저장/조회
  setTabColumns: (tabId: string, columns: number) => void;
  getTabColumns: (tabId: string) => number;
}

// 고유 ID 생성
const generateId = () => `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// 기본 홈 탭
const DEFAULT_HOME_TAB: Tab = {
  id: 'tab_home',
  type: 'home',
  title: '메인스트림',
  path: '/home',
  columns: 3,
};

// 기본 패널
const DEFAULT_LEFT_PANEL: Panel = {
  id: 'left',
  tabs: [DEFAULT_HOME_TAB],
  activeTabId: 'tab_home',
};

// 헬퍼: 모든 패널에서 탭 찾기
const findTabInPanels = (panels: Panel[], tabId: string): { panel: Panel; tab: Tab; index: number } | null => {
  for (const panel of panels) {
    const index = panel.tabs.findIndex(t => t.id === tabId);
    if (index !== -1) {
      return { panel, tab: panel.tabs[index], index };
    }
  }
  return null;
};

// 헬퍼: 모든 탭 가져오기
const getAllTabs = (panels: Panel[]): Tab[] => {
  return panels.flatMap(p => p.tabs);
};

// 헬퍼: 활성 패널의 활성 탭 ID 가져오기
const getActiveTabId = (panels: Panel[], activePanelId: PanelId): string | null => {
  const panel = panels.find(p => p.id === activePanelId);
  return panel?.activeTabId || null;
};

export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      panels: [DEFAULT_LEFT_PANEL],
      activePanelId: 'left' as PanelId,

      // computed 값들 (기존 호환성)
      get tabs() {
        return getAllTabs(get().panels);
      },
      get activeTabId() {
        return getActiveTabId(get().panels, get().activePanelId);
      },

      setActivePanel: (panelId) => {
        const panel = get().panels.find(p => p.id === panelId);
        if (panel) {
          set({ activePanelId: panelId });
        }
      },

      moveTabToPanel: (tabId, targetPanelId) => {
        const { panels } = get();
        const found = findTabInPanels(panels, tabId);
        if (!found) return;

        const { panel: sourcePanel, tab, index } = found;
        if (sourcePanel.id === targetPanelId) return;

        const targetPanel = panels.find(p => p.id === targetPanelId);
        if (!targetPanel) return;

        // 소스 패널에서 탭이 1개뿐이면 이동 후 패널 닫기
        if (sourcePanel.tabs.length <= 1) {
          // 탭을 타겟 패널로 이동하고, 소스 패널을 제거
          // closeSplitPanel을 사용하면 탭이 중복 추가되므로 직접 처리
          set({
            panels: [{
              ...targetPanel,
              id: 'left',
              tabs: [...targetPanel.tabs, tab],
              activeTabId: tab.id,
            }],
            activePanelId: 'left',
          });
          return;
        }

        set((state) => ({
          panels: state.panels.map(p => {
            if (p.id === sourcePanel.id) {
              const newTabs = p.tabs.filter(t => t.id !== tabId);
              return {
                ...p,
                tabs: newTabs,
                activeTabId: p.activeTabId === tabId
                  ? newTabs[Math.min(index, newTabs.length - 1)]?.id || null
                  : p.activeTabId,
              };
            }
            if (p.id === targetPanelId) {
              return {
                ...p,
                tabs: [...p.tabs, tab],
                activeTabId: tab.id,
              };
            }
            return p;
          }),
          activePanelId: targetPanelId,
        }));
      },

      createSplitPanel: (tabId, side) => {
        const { panels } = get();

        // 이미 2개의 패널이 있으면 생성 불가
        if (panels.length >= 2) return;

        const found = findTabInPanels(panels, tabId);
        if (!found) return;

        const { panel: sourcePanel, tab, index } = found;

        // 소스 패널에서 탭이 1개뿐이면 분할 불가
        if (sourcePanel.tabs.length <= 1) return;

        const newPanelId: PanelId = side === 'left' ? 'left' : 'right';
        const existingPanelId: PanelId = side === 'left' ? 'right' : 'left';

        // 기존 패널 ID 업데이트
        const updatedSourcePanel: Panel = {
          ...sourcePanel,
          id: existingPanelId,
          tabs: sourcePanel.tabs.filter(t => t.id !== tabId),
          activeTabId: sourcePanel.activeTabId === tabId
            ? sourcePanel.tabs.filter(t => t.id !== tabId)[Math.min(index, sourcePanel.tabs.length - 2)]?.id || null
            : sourcePanel.activeTabId,
        };

        const newPanel: Panel = {
          id: newPanelId,
          tabs: [tab],
          activeTabId: tab.id,
        };

        const newPanels = side === 'left'
          ? [newPanel, updatedSourcePanel]
          : [updatedSourcePanel, newPanel];

        set({
          panels: newPanels,
          activePanelId: newPanelId,
        });
      },

      closeSplitPanel: (panelId) => {
        const { panels } = get();

        // 패널이 1개뿐이면 닫기 불가
        if (panels.length <= 1) return;

        const panelToClose = panels.find(p => p.id === panelId);
        const remainingPanel = panels.find(p => p.id !== panelId);
        if (!panelToClose || !remainingPanel) return;

        // 닫히는 패널의 탭들을 남은 패널로 이동
        set({
          panels: [{
            ...remainingPanel,
            id: 'left',
            tabs: [...remainingPanel.tabs, ...panelToClose.tabs],
          }],
          activePanelId: 'left',
        });
      },

      addTab: (tabData, panelId) => {
        const { activePanelId, panels } = get();
        const targetPanelId = panelId || activePanelId;

        const id = generateId();
        const newTab: Tab = { ...tabData, id, columns: tabData.columns ?? 3 };

        set((state) => ({
          panels: state.panels.map(p =>
            p.id === targetPanelId
              ? { ...p, tabs: [...p.tabs, newTab], activeTabId: id }
              : p
          ),
          activePanelId: targetPanelId,
        }));
        return id;
      },

      removeTab: (tabId) => {
        const { panels } = get();
        const found = findTabInPanels(panels, tabId);
        if (!found) return;

        const { panel, index } = found;

        // 전체 탭이 1개면 삭제 불가
        const totalTabs = getAllTabs(panels).length;
        if (totalTabs <= 1) return;

        // 해당 패널의 마지막 탭이면 패널도 닫기
        if (panel.tabs.length <= 1 && panels.length > 1) {
          get().closeSplitPanel(panel.id);
          return;
        }

        const newTabs = panel.tabs.filter(t => t.id !== tabId);
        let newActiveId = panel.activeTabId;

        if (panel.activeTabId === tabId) {
          const newIndex = Math.min(index, newTabs.length - 1);
          newActiveId = newTabs[newIndex]?.id || null;
        }

        set((state) => ({
          panels: state.panels.map(p =>
            p.id === panel.id
              ? { ...p, tabs: newTabs, activeTabId: newActiveId }
              : p
          ),
        }));
      },

      setActiveTab: (tabId) => {
        const { panels } = get();
        const found = findTabInPanels(panels, tabId);
        if (!found) return;

        set((state) => ({
          panels: state.panels.map(p =>
            p.id === found.panel.id
              ? { ...p, activeTabId: tabId }
              : p
          ),
          activePanelId: found.panel.id,
        }));
      },

      updateTab: (tabId, updates) => {
        set((state) => ({
          panels: state.panels.map(p => ({
            ...p,
            tabs: p.tabs.map(tab =>
              tab.id === tabId ? { ...tab, ...updates } : tab
            ),
          })),
        }));
      },

      findTabByPath: (path) => {
        return getAllTabs(get().panels).find(t => t.path === path);
      },

      findTabByResource: (type, resourceId) => {
        return getAllTabs(get().panels).find(t => {
          if (t.type !== type) return false;
          if (resourceId !== undefined) return t.resourceId === resourceId;
          return true;
        });
      },

      openTab: (tabData, panelId) => {
        const { addTab, setActiveTab, findTabByResource } = get();

        // 이미 같은 타입+리소스의 탭이 있으면 해당 탭으로 전환
        const existingTab = findTabByResource(tabData.type, tabData.resourceId);
        if (existingTab) {
          setActiveTab(existingTab.id);
          return existingTab.id;
        }

        // 새 탭 추가 (panelId 전달)
        return addTab(tabData, panelId);
      },

      saveScrollPosition: (tabId, position) => {
        get().updateTab(tabId, { scrollPosition: position });
      },

      getScrollPosition: (tabId) => {
        const found = findTabInPanels(get().panels, tabId);
        return found?.tab.scrollPosition || 0;
      },

      setTabColumns: (tabId, columns) => {
        // 컬럼 수 제한 (1-5)
        const clampedColumns = Math.max(1, Math.min(5, columns));
        get().updateTab(tabId, { columns: clampedColumns });
      },

      getTabColumns: (tabId) => {
        const found = findTabInPanels(get().panels, tabId);
        return found?.tab.columns ?? 3;
      },
    }),
    {
      name: 'drss-tabs',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        panels: state.panels.map(panel => ({
          ...panel,
          tabs: panel.tabs.slice(0, 10).map(({ scrollPosition, ...tab }) => tab),
        })),
        activePanelId: state.activePanelId,
      }),
      // 마이그레이션: 기존 tabs 구조에서 panels 구조로
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as { tabs?: Tab[]; activeTabId?: string; panels?: Panel[] };

        // 이미 panels 구조면 그대로 반환
        if (state.panels) {
          return state as TabStore;
        }

        // 기존 tabs 구조를 panels로 마이그레이션
        if (state.tabs) {
          return {
            panels: [{
              id: 'left' as PanelId,
              tabs: state.tabs,
              activeTabId: state.activeTabId || state.tabs[0]?.id || null,
            }],
            activePanelId: 'left' as PanelId,
          } as unknown as TabStore;
        }

        return state as TabStore;
      },
      version: 1,
    }
  )
);
