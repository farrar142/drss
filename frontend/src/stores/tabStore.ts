import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type TabType = 'home' | 'category' | 'feed' | 'settings' | 'rss-everything' | 'task-results' | 'periodic-tasks' | 'feed-edit';

// RSSEverything 탭 컨텍스트 (소스 편집용)
export interface RSSEverythingContext {
  mode: 'create' | 'edit';
  feedId: number;       // 피드 ID (필수 - 소스를 연결할 피드)
  sourceId?: number;    // 소스 수정 시 소스 ID
}

// FeedEdit 탭 컨텍스트 (피드 편집용)
export interface FeedEditContext {
  mode: 'create' | 'edit';
  categoryId?: number;  // 피드 생성 시 카테고리 ID
  feedId?: number;      // 피드 수정 시 피드 ID
}

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
  // RSSEverything 탭의 컨텍스트 데이터
  context?: RSSEverythingContext;
  // FeedEdit 탭의 컨텍스트 데이터
  feedEditContext?: FeedEditContext;
}

// 패널 ID 타입
export type PanelId = 'left' | 'right';

// 패널 상태
export interface Panel {
  id: PanelId;
  tabs: Tab[];
  activeTabId: string | null;
  // 탭 방문 히스토리 (탭 ID 배열, 최근 방문이 뒤에)
  tabHistory: string[];
}

// 영속화할 상태
interface PersistedState {
  panels: Panel[];
  activePanelId: PanelId;
}

interface TabStore {
  // 현재 유저 ID (영속화 키로 사용)
  _userId: number | null;

  // 패널 기반 구조
  panels: Panel[];
  activePanelId: PanelId;

  // 기존 호환성을 위한 computed 값들
  tabs: Tab[];
  activeTabId: string | null;

  // 유저별 초기화
  initializeForUser: (userId: number) => void;
  clearForLogout: () => void;

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

  // 특정 피드와 관련된 모든 탭 닫기
  closeTabsByFeedId: (feedId: number) => void;

  // 특정 패널의 모든 탭 닫기 (홈 탭 제외)
  closeAllTabs: (panelId?: PanelId) => void;

  // 탭 히스토리 관리
  goBackTab: (panelId?: PanelId) => boolean;
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
  tabHistory: ['tab_home'],
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

// 스토리지 키 생성
const getStorageKey = (userId: number) => `drss-tabs-user-${userId}`;

// localStorage에서 상태 로드
const loadFromStorage = (userId: number): PersistedState | null => {
  if (typeof window === 'undefined') return null;

  try {
    const key = getStorageKey(userId);
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const parsed = JSON.parse(stored);

    // 마이그레이션: 기존 tabs 구조에서 panels 구조로
    if (parsed.tabs && !parsed.panels) {
      const activeTabId = parsed.activeTabId || parsed.tabs[0]?.id || null;
      return {
        panels: [{
          id: 'left' as PanelId,
          tabs: parsed.tabs,
          activeTabId,
          tabHistory: activeTabId ? [activeTabId] : [],
        }],
        activePanelId: 'left' as PanelId,
      };
    }

    // 마이그레이션: tabHistory가 없는 패널에 추가
    const migratedPanels = parsed.panels.map((panel: Panel) => ({
      ...panel,
      tabHistory: panel.tabHistory || (panel.activeTabId ? [panel.activeTabId] : []),
    }));

    return { ...parsed, panels: migratedPanels } as PersistedState;
  } catch {
    return null;
  }
};

// localStorage에 상태 저장
const saveToStorage = (userId: number, state: PersistedState) => {
  if (typeof window === 'undefined') return;

  try {
    const key = getStorageKey(userId);
    // 탭 수 제한 및 scrollPosition 제외
    const toSave: PersistedState = {
      panels: state.panels.map(panel => ({
        ...panel,
        tabs: panel.tabs.slice(0, 10).map(({ scrollPosition, ...tab }) => tab),
      })),
      activePanelId: state.activePanelId,
    };
    localStorage.setItem(key, JSON.stringify(toSave));
  } catch (e) {
    console.error('Failed to save tab state:', e);
  }
};

export const useTabStore = create<TabStore>()(
  subscribeWithSelector((set, get) => ({
    _userId: null,
    panels: [DEFAULT_LEFT_PANEL],
    activePanelId: 'left' as PanelId,

    // computed 값들 (기존 호환성)
    get tabs() {
      return getAllTabs(get().panels);
    },
    get activeTabId() {
      return getActiveTabId(get().panels, get().activePanelId);
    },

    // 유저별 초기화
    initializeForUser: (userId) => {
      const stored = loadFromStorage(userId);
      if (stored) {
        set({
          _userId: userId,
          panels: stored.panels,
          activePanelId: stored.activePanelId,
        });
      } else {
        set({
          _userId: userId,
          panels: [{ ...DEFAULT_LEFT_PANEL, tabs: [{ ...DEFAULT_HOME_TAB }], tabHistory: ['tab_home'] }],
          activePanelId: 'left',
        });
      }
    },

    // 로그아웃 시 초기화
    clearForLogout: () => {
      set({
        _userId: null,
        panels: [{ ...DEFAULT_LEFT_PANEL, tabs: [{ ...DEFAULT_HOME_TAB }], tabHistory: ['tab_home'] }],
        activePanelId: 'left',
      });
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
        set({
          panels: [{
            ...targetPanel,
            id: 'left',
            tabs: [...targetPanel.tabs, tab],
            activeTabId: tab.id,
            tabHistory: [...targetPanel.tabHistory, tab.id],
          }],
          activePanelId: 'left',
        });
        return;
      }

      set((state) => ({
        panels: state.panels.map(p => {
          if (p.id === sourcePanel.id) {
            const newTabs = p.tabs.filter(t => t.id !== tabId);
            const newHistory = p.tabHistory.filter(tid => tid !== tabId);
            const newActiveId = p.activeTabId === tabId
              ? (newHistory[newHistory.length - 1] || newTabs[Math.min(index, newTabs.length - 1)]?.id || null)
              : p.activeTabId;
            return {
              ...p,
              tabs: newTabs,
              activeTabId: newActiveId,
              tabHistory: newHistory,
            };
          }
          if (p.id === targetPanelId) {
            return {
              ...p,
              tabs: [...p.tabs, tab],
              activeTabId: tab.id,
              tabHistory: [...p.tabHistory, tab.id],
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

      const newSourceTabs = sourcePanel.tabs.filter(t => t.id !== tabId);
      const newSourceHistory = sourcePanel.tabHistory.filter(tid => tid !== tabId);
      const newSourceActiveId = sourcePanel.activeTabId === tabId
        ? (newSourceHistory[newSourceHistory.length - 1] || newSourceTabs[Math.min(index, newSourceTabs.length - 1)]?.id || null)
        : sourcePanel.activeTabId;

      const updatedSourcePanel: Panel = {
        ...sourcePanel,
        id: existingPanelId,
        tabs: newSourceTabs,
        activeTabId: newSourceActiveId,
        tabHistory: newSourceHistory,
      };

      const newPanel: Panel = {
        id: newPanelId,
        tabs: [tab],
        activeTabId: tab.id,
        tabHistory: [tab.id],
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

      if (panels.length <= 1) return;

      const panelToClose = panels.find(p => p.id === panelId);
      const remainingPanel = panels.find(p => p.id !== panelId);
      if (!panelToClose || !remainingPanel) return;

      set({
        panels: [{
          ...remainingPanel,
          id: 'left',
          tabs: [...remainingPanel.tabs, ...panelToClose.tabs],
          // 남은 패널의 히스토리 유지 (닫히는 패널의 탭들은 히스토리에서 제외)
          tabHistory: remainingPanel.tabHistory,
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
            ? {
              ...p,
              tabs: [...p.tabs, newTab],
              activeTabId: id,
              // 히스토리에 새 탭 추가
              tabHistory: [...p.tabHistory.filter(tid => tid !== id), id],
            }
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

      const totalTabs = getAllTabs(panels).length;
      if (totalTabs <= 1) return;

      if (panel.tabs.length <= 1 && panels.length > 1) {
        get().closeSplitPanel(panel.id);
        return;
      }

      const newTabs = panel.tabs.filter(t => t.id !== tabId);
      // 히스토리에서 해당 탭 제거
      const newHistory = panel.tabHistory.filter(tid => tid !== tabId);
      let newActiveId = panel.activeTabId;

      if (panel.activeTabId === tabId) {
        // 히스토리에서 가장 최근에 방문한 탭으로 이동 (현재 탭 제외)
        const lastInHistory = newHistory[newHistory.length - 1];
        if (lastInHistory && newTabs.some(t => t.id === lastInHistory)) {
          newActiveId = lastInHistory;
        } else {
          // 히스토리에 유효한 탭이 없으면 인덱스 기반
          const newIndex = Math.min(index, newTabs.length - 1);
          newActiveId = newTabs[newIndex]?.id || null;
        }
      }

      set((state) => ({
        panels: state.panels.map(p =>
          p.id === panel.id
            ? { ...p, tabs: newTabs, activeTabId: newActiveId, tabHistory: newHistory }
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
            ? {
              ...p,
              activeTabId: tabId,
              // 히스토리에서 해당 탭을 제거하고 끝에 추가 (최근 방문)
              tabHistory: [...p.tabHistory.filter(tid => tid !== tabId), tabId],
            }
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

      const existingTab = findTabByResource(tabData.type, tabData.resourceId);
      if (existingTab) {
        setActiveTab(existingTab.id);
        return existingTab.id;
      }

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
      const clampedColumns = Math.max(1, Math.min(5, columns));
      get().updateTab(tabId, { columns: clampedColumns });
    },

    getTabColumns: (tabId) => {
      const found = findTabInPanels(get().panels, tabId);
      return found?.tab.columns ?? 3;
    },

    closeTabsByFeedId: (feedId) => {
      const { panels, removeTab } = get();

      const tabsToClose: string[] = [];

      for (const panel of panels) {
        for (const tab of panel.tabs) {
          if (tab.type === 'feed' && tab.resourceId === feedId) {
            tabsToClose.push(tab.id);
          }
          if (tab.type === 'feed-edit' && tab.feedEditContext?.feedId === feedId) {
            tabsToClose.push(tab.id);
          }
          if (tab.type === 'rss-everything' && tab.context?.feedId === feedId) {
            tabsToClose.push(tab.id);
          }
        }
      }

      for (const tabId of tabsToClose.reverse()) {
        removeTab(tabId);
      }
    },

    closeAllTabs: (panelId) => {
      const { panels, activePanelId } = get();
      const targetPanelId = panelId || activePanelId;

      set((state) => ({
        panels: state.panels.map(p => {
          if (p.id !== targetPanelId) return p;

          // 홈 탭은 유지, 없으면 새로 생성
          const homeTab = p.tabs.find(t => t.type === 'home');
          const newTabs = homeTab ? [homeTab] : [{ ...DEFAULT_HOME_TAB }];
          const homeTabId = newTabs[0].id;

          return {
            ...p,
            tabs: newTabs,
            activeTabId: homeTabId,
            // 히스토리도 리셋
            tabHistory: [homeTabId],
          };
        }),
      }));
    },

    goBackTab: (panelId) => {
      const { panels, activePanelId } = get();
      const targetPanelId = panelId || activePanelId;
      const panel = panels.find(p => p.id === targetPanelId);

      if (!panel || !panel.activeTabId) return false;

      // 히스토리에서 현재 탭이 마지막이어야 함
      const history = panel.tabHistory;
      if (history.length <= 1) return false;

      // 히스토리에서 현재 탭(마지막)을 제거하고 그 이전 탭을 찾음
      const currentTabId = panel.activeTabId;
      const currentIndex = history.lastIndexOf(currentTabId);

      if (currentIndex <= 0) return false;

      // 이전 탭 ID
      const prevTabId = history[currentIndex - 1];

      // 이전 탭이 실제로 존재하는지 확인
      const prevTabExists = panel.tabs.some(t => t.id === prevTabId);
      if (!prevTabExists) {
        // 존재하지 않으면 히스토리에서 제거하고 재귀적으로 시도
        set((state) => ({
          panels: state.panels.map(p =>
            p.id === targetPanelId
              ? { ...p, tabHistory: p.tabHistory.filter(tid => tid !== prevTabId) }
              : p
          ),
        }));
        return get().goBackTab(targetPanelId);
      }

      // 히스토리에서 현재 탭을 제거하고 이전 탭을 활성화
      set((state) => ({
        panels: state.panels.map(p =>
          p.id === targetPanelId
            ? {
              ...p,
              activeTabId: prevTabId,
              // 현재 탭을 히스토리에서 제거
              tabHistory: p.tabHistory.slice(0, currentIndex),
            }
            : p
        ),
      }));

      return true;
    },
  }))
);

// 상태 변경 시 자동 저장 (구독)
if (typeof window !== 'undefined') {
  useTabStore.subscribe(
    (state) => ({ panels: state.panels, activePanelId: state.activePanelId, _userId: state._userId }),
    (current) => {
      if (current._userId) {
        saveToStorage(current._userId, {
          panels: current.panels,
          activePanelId: current.activePanelId,
        });
      }
    },
    { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) }
  );
}
