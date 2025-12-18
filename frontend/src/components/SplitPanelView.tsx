'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTabStore, Panel, Tab, PanelId } from '../stores/tabStore';
import { useAppBar } from '../context/AppBarContext';
import { TabBar } from './TabBar';
import { ContentRenderer } from './ContentRenderer';
import { cn } from '@/lib/utils';

interface SplitPanelViewProps {
  isMediaModalOpen?: boolean;
}

// 개별 패널 컴포넌트 - 각자 스크롤 관리
interface PanelViewProps {
  panel: Panel;
  isActive: boolean;
  panelsCount: number;
  index: number;
  showDropIndicator: boolean;
  dragOverSide: 'left' | 'right' | null;
  hideTabBar?: boolean;
  onPanelClick: (panelId: PanelId) => void;
  onTabClick: (panelId: PanelId, tab: Tab) => void;
  onTabClose: (tabId: string) => void;
  onAddTab: (panelId: PanelId) => void;
  onDragStart: (e: React.DragEvent, tab: Tab) => void;
  onDragOver: (e: React.DragEvent, panelId: PanelId) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, panelId: PanelId) => void;
  onColumnsChange: (tabId: string, columns: number) => void;
  onCloseAllTabs: (panelId: PanelId) => void;
  onScrollChange: (panelId: PanelId, tabId: string | null, scrollTop: number) => void;
  savedScrollPosition: number;
}

const PanelView: React.FC<PanelViewProps> = React.memo(({
  panel,
  isActive,
  panelsCount,
  index,
  showDropIndicator,
  dragOverSide,
  hideTabBar,
  onPanelClick,
  onTabClick,
  onTabClose,
  onAddTab,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onColumnsChange,
  onCloseAllTabs,
  onScrollChange,
  savedScrollPosition,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isRestoringScroll = useRef(false);
  // 현재 스크롤 위치를 ref로 저장 (store 업데이트 없이)
  const currentScrollRef = useRef(0);

  // 탭 변경 시 스크롤 위치 복원 및 이전 탭의 스크롤 위치 저장
  const prevActiveTabId = useRef(panel.activeTabId);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // 탭이 실제로 변경되었을 때
    if (prevActiveTabId.current !== panel.activeTabId) {
      // 이전 탭의 스크롤 위치 저장 (탭 변경 시에만 store 업데이트)
      if (prevActiveTabId.current && currentScrollRef.current > 0) {
        onScrollChange(panel.id, prevActiveTabId.current, currentScrollRef.current);
      }

      // 새 탭의 스크롤 위치 복원
      isRestoringScroll.current = true;
      container.scrollTop = savedScrollPosition;
      currentScrollRef.current = savedScrollPosition;
      prevActiveTabId.current = panel.activeTabId;

      // 복원 후 짧은 딜레이 후 스크롤 감지 활성화
      setTimeout(() => {
        isRestoringScroll.current = false;
      }, 100);
    }
  }, [panel.activeTabId, savedScrollPosition, onScrollChange, panel.id]);

  // 언마운트 시 현재 스크롤 위치 저장
  useEffect(() => {
    return () => {
      if (panel.activeTabId && currentScrollRef.current > 0) {
        onScrollChange(panel.id, panel.activeTabId, currentScrollRef.current);
      }
    };
  }, [panel.id, panel.activeTabId, onScrollChange]);

  // 스크롤 위치를 ref에만 저장 (store 업데이트 없음 - 리렌더링 방지)
  const handleScroll = useCallback(() => {
    if (isRestoringScroll.current) return;
    const container = scrollContainerRef.current;
    if (container) {
      currentScrollRef.current = container.scrollTop;
    }
  }, []);

  // 이벤트 핸들러들 - panelId를 바인딩
  const handlePanelClick = useCallback(() => {
    onPanelClick(panel.id);
  }, [onPanelClick, panel.id]);

  const handleTabClick = useCallback((tab: Tab) => {
    onTabClick(panel.id, tab);
  }, [onTabClick, panel.id]);

  const handleAddTab = useCallback(() => {
    onAddTab(panel.id);
  }, [onAddTab, panel.id]);

  const handleCloseAllTabs = useCallback(() => {
    onCloseAllTabs(panel.id);
  }, [onCloseAllTabs, panel.id]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    onDragOver(e, panel.id);
  }, [onDragOver, panel.id]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    onDrop(e, panel.id);
  }, [onDrop, panel.id]);

  // 스티키 헤더 오프셋 - 스크롤 컨테이너 내에서 탭바는 sticky로 별도 처리되므로 0px
  const effectiveHeaderOffset = '0px';

  return (
    <div
      className={cn(
        "relative flex flex-col flex-1 min-w-0 min-h-0 h-full",
        panelsCount > 1 && index === 0 && "border-r border-border",
        isActive && panelsCount > 1 && "ring-1 ring-primary/20"
      )}
      onClick={handlePanelClick}
      onDragOver={handleDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
    >
      {/* 드롭 인디케이터 - 패널 1개일 때: 좌우 절반, 패널 2개일 때: 전체 */}
      {showDropIndicator && (
        panelsCount === 1 ? (
          <div className={cn(
            "absolute inset-y-0 w-1/2 bg-primary/10 pointer-events-none z-50",
            dragOverSide === 'left' ? "left-0" : "right-0"
          )} />
        ) : (
          <div className="absolute inset-0 bg-primary/10 pointer-events-none z-50 ring-2 ring-primary/30 ring-inset" />
        )
      )}

      {/* 탭바 - sticky로 스크롤 컨테이너 위에 고정, 미디어 모달 열릴 때 숨김 (CSS로 처리하여 리마운트 방지) */}
      <div className={cn(
        "sticky top-0 z-30",
        hideTabBar && "invisible"
      )}>
        <TabBar
          panelId={panel.id}
          tabs={panel.tabs}
          activeTabId={panel.activeTabId}
          onTabClick={handleTabClick}
          onTabClose={onTabClose}
          onAddTab={handleAddTab}
          onTabDragStart={onDragStart}
          onColumnsChange={onColumnsChange}
          onCloseAllTabs={handleCloseAllTabs}
          canClose={panelsCount > 1 ? true : panel.tabs.length > 1}
        />
      </div>

      {/* 컨텐츠 - 개별 스크롤 */}
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex-1 min-h-0 relative",
          hideTabBar ? "overflow-hidden" : "overflow-y-auto"
        )}
        onScroll={handleScroll}
        style={{
          ['--header-offset' as string]: effectiveHeaderOffset,
        }}
      >
        <div className="p-1 sm:p-2 md:p-4 lg:p-6 min-h-full">
          <ContentRenderer panelId={panel.id} scrollContainerRef={scrollContainerRef} />
        </div>
      </div>
    </div>
  );
});

PanelView.displayName = 'PanelView';

export const SplitPanelView: React.FC<SplitPanelViewProps> = ({ isMediaModalOpen }) => {
  const router = useRouter();
  const { isAppBarHidden } = useAppBar();
  const {
    panels,
    activePanelId,
    setActivePanel,
    setActiveTab,
    removeTab,
    openTab,
    saveScrollPosition,
    getScrollPosition,
    moveTabToPanel,
    createSplitPanel,
    closeSplitPanel,
    setTabColumns,
    closeAllTabs,
  } = useTabStore();

  const [dragOverPanel, setDragOverPanel] = useState<PanelId | null>(null);
  const [dragOverSide, setDragOverSide] = useState<'left' | 'right' | null>(null);

  // 활성 패널의 활성 탭이 변경되면 URL 업데이트 (모든 피드 탭은 /home으로 통일)
  useEffect(() => {
    const activePanel = panels.find(p => p.id === activePanelId);
    const activeTab = activePanel?.tabs.find(t => t.id === activePanel.activeTabId);

    if (activeTab) {
      // 피드 관련 탭들은 모두 /home URL 사용 (URL 단순화)
      const targetPath = activeTab.type === 'settings' ? '/settings' : '/home';
      const currentPath = window.location.pathname;

      if (currentPath !== targetPath) {
        router.push(targetPath);
      }
    }
  }, [activePanelId, panels, router]);

  const handleTabClick = useCallback((panelId: PanelId, tab: Tab) => {
    setActivePanel(panelId);
    setActiveTab(tab.id);
  }, [setActivePanel, setActiveTab]);

  const handleTabClose = useCallback((tabId: string) => {
    removeTab(tabId);
  }, [removeTab]);

  const handleAddTab = useCallback((panelId: PanelId) => {
    setActivePanel(panelId);
    openTab({
      type: 'home',
      title: '메인스트림',
      path: '/home',
    });
  }, [setActivePanel, openTab]);

  const handleCloseAllTabs = useCallback((panelId: PanelId) => {
    closeAllTabs(panelId);
  }, [closeAllTabs]);

  const handlePanelClick = useCallback((panelId: PanelId) => {
    if (activePanelId !== panelId) {
      setActivePanel(panelId);
    }
  }, [activePanelId, setActivePanel]);

  // 드래그 앤 드롭 핸들러
  const handleDragStart = useCallback((e: React.DragEvent, tab: Tab) => {
    e.dataTransfer.setData('text/plain', tab.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, panelId: PanelId) => {
    // 탭, 카테고리, 피드 드래그 모두 허용
    const isTabDrag = e.dataTransfer.types.includes('text/plain');
    const isFeedDrag = e.dataTransfer.types.includes('application/json');
    const isCategoryDrag = e.dataTransfer.types.includes('application/category-reorder');

    if (!isTabDrag && !isFeedDrag && !isCategoryDrag) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const side = x < rect.width / 2 ? 'left' : 'right';

    setDragOverPanel(panelId);
    setDragOverSide(side);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverPanel(null);
    setDragOverSide(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetPanelId: PanelId) => {
    e.preventDefault();

    // 1. 탭 드롭 처리
    const tabId = e.dataTransfer.getData('text/plain');
    if (tabId && !tabId.startsWith('{')) {
      // 패널이 1개이고 드래그 오버 사이드가 있으면 분할 생성
      if (panels.length === 1 && dragOverSide) {
        createSplitPanel(tabId, dragOverSide);
      } else if (panels.length === 2) {
        // 이미 2개의 패널이 있으면 탭을 해당 패널로 이동
        moveTabToPanel(tabId, targetPanelId);
      }
      setDragOverPanel(null);
      setDragOverSide(null);
      return;
    }

    // 2. 피드 드롭 처리 (새 탭으로 열기)
    const jsonData = e.dataTransfer.getData('application/json');
    if (jsonData) {
      try {
        const data = JSON.parse(jsonData);
        if (data.feedId) {
          const tabData = {
            type: 'feed' as const,
            title: data.feedTitle || `피드 #${data.feedId}`,
            path: `/feed/${data.feedId}`,
            resourceId: data.feedId,
            favicon: data.faviconUrl,
          };

          // 패널이 1개이고 드래그 오버 사이드가 있으면 새 패널 생성
          if (panels.length === 1 && dragOverSide) {
            // 먼저 현재 패널에 탭 추가
            const newTabId = openTab(tabData, targetPanelId);
            // 그 탭으로 새 패널 생성
            if (newTabId) {
              createSplitPanel(newTabId, dragOverSide);
            }
          } else {
            // 기존 패널에 탭 추가
            openTab(tabData, targetPanelId);
          }
        }
      } catch {
        // JSON 파싱 실패 무시
      }
      setDragOverPanel(null);
      setDragOverSide(null);
      return;
    }

    // 3. 카테고리 드롭 처리 (새 탭으로 열기)
    const categoryData = e.dataTransfer.getData('application/category-reorder');
    if (categoryData) {
      try {
        const data = JSON.parse(categoryData);
        if (data.categoryId) {
          const tabData = {
            type: 'category' as const,
            title: data.categoryName || `카테고리 #${data.categoryId}`,
            path: `/category/${data.categoryId}`,
            resourceId: data.categoryId,
          };

          // 패널이 1개이고 드래그 오버 사이드가 있으면 새 패널 생성
          if (panels.length === 1 && dragOverSide) {
            const newTabId = openTab(tabData, targetPanelId);
            if (newTabId) {
              createSplitPanel(newTabId, dragOverSide);
            }
          } else {
            openTab(tabData, targetPanelId);
          }
        }
      } catch {
        // JSON 파싱 실패 무시
      }
    }

    setDragOverPanel(null);
    setDragOverSide(null);
  }, [panels.length, dragOverSide, createSplitPanel, moveTabToPanel, openTab]);

  // 컬럼 수 변경 핸들러
  const handleColumnsChange = useCallback((tabId: string, columns: number) => {
    setTabColumns(tabId, columns);
  }, [setTabColumns]);

  // 스크롤 위치 저장 핸들러
  const handleScrollChange = useCallback((panelId: PanelId, tabId: string | null, scrollTop: number) => {
    if (tabId) {
      saveScrollPosition(tabId, scrollTop);
    }
  }, [saveScrollPosition]);

  // 컨테이너 높이 계산: 앱바가 숨겨지면 100vh, 아니면 앱바 높이(3.5rem) 제외
  const containerHeight = isMediaModalOpen ? '100vh' : isAppBarHidden ? '100vh' : 'calc(100vh - 3.5rem)';

  return (
    <div
      className={cn(
        "flex w-full",
        isMediaModalOpen && "relative z-0"
      )}
      style={{ height: containerHeight }}
    >
      {panels.map((panel, index) => {
        const isActive = panel.id === activePanelId;
        const showDropIndicator = dragOverPanel === panel.id;
        const savedScrollPosition = panel.activeTabId ? getScrollPosition(panel.activeTabId) : 0;

        return (
          <PanelView
            key={panel.id}
            panel={panel}
            isActive={isActive}
            panelsCount={panels.length}
            index={index}
            showDropIndicator={showDropIndicator}
            dragOverSide={dragOverSide}
            hideTabBar={isMediaModalOpen}
            onPanelClick={handlePanelClick}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
            onAddTab={handleAddTab}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onColumnsChange={handleColumnsChange}
            onCloseAllTabs={handleCloseAllTabs}
            onScrollChange={handleScrollChange}
            savedScrollPosition={savedScrollPosition}
          />
        );
      })}
    </div>
  );
};
