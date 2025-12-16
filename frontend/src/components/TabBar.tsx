'use client';

import React, { useRef, useEffect } from 'react';
import { X, Home, Folder, Rss, Settings, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTabStore, Tab, TabType } from '../stores/tabStore';
import { cn } from '@/lib/utils';

// 탭 타입별 아이콘
const TabIcon: React.FC<{ type: TabType; className?: string }> = ({ type, className }) => {
  switch (type) {
    case 'home':
      return <Home className={className} />;
    case 'category':
      return <Folder className={className} />;
    case 'feed':
      return <Rss className={className} />;
    case 'settings':
      return <Settings className={className} />;
    default:
      return null;
  }
};

interface TabBarProps {
  className?: string;
}

export const TabBar: React.FC<TabBarProps> = ({ className }) => {
  const router = useRouter();
  const { tabs, activeTabId, setActiveTab, removeTab, openTab, saveScrollPosition, getScrollPosition } = useTabStore();
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const isRestoringScrollRef = useRef(false);

  // 활성 탭이 변경되면 해당 탭의 경로로 이동 및 스크롤 복원
  useEffect(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) {
      // URL과 탭 경로가 다를 때만 이동 (무한 루프 방지)
      const currentPath = window.location.pathname;
      if (currentPath !== activeTab.path) {
        router.push(activeTab.path);
      }
      
      // 스크롤 위치 복원 (약간의 딜레이 필요)
      isRestoringScrollRef.current = true;
      const savedPosition = getScrollPosition(activeTab.id);
      setTimeout(() => {
        window.scrollTo(0, savedPosition);
        // 복원 완료 후 플래그 해제
        setTimeout(() => {
          isRestoringScrollRef.current = false;
        }, 100);
      }, 50);
    }
  }, [activeTabId, tabs, router, getScrollPosition]);

  const handleTabClick = (tab: Tab) => {
    if (tab.id === activeTabId) return;
    
    // 현재 탭의 스크롤 위치 저장
    if (activeTabId) {
      saveScrollPosition(activeTabId, window.scrollY);
    }
    
    setActiveTab(tab.id);
  };

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    removeTab(tabId);
  };

  const handleAddHomeTab = () => {
    // 현재 탭의 스크롤 위치 저장
    if (activeTabId) {
      saveScrollPosition(activeTabId, window.scrollY);
    }
    
    openTab({
      type: 'home',
      title: '메인스트림',
      path: '/home',
    });
  };

  // 활성 탭이 보이도록 스크롤
  useEffect(() => {
    const activeTabElement = tabsContainerRef.current?.querySelector(`[data-tab-id="${activeTabId}"]`);
    if (activeTabElement) {
      activeTabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTabId]);

  return (
    <div className={cn(
      "flex items-center h-9 bg-background/80 backdrop-blur-sm border-b border-border overflow-hidden",
      className
    )}>
      {/* 탭 목록 */}
      <div 
        ref={tabsContainerRef}
        className="flex-1 flex items-center overflow-x-auto scrollbar-none"
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            data-tab-id={tab.id}
            onClick={() => handleTabClick(tab)}
            title={tab.title}
            className={cn(
              "group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-border/50 min-w-0 max-w-[180px]",
              "transition-colors duration-150",
              tab.id === activeTabId
                ? "bg-card text-foreground"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <TabIcon type={tab.type} className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs font-medium truncate">{tab.title}</span>
            
            {/* 닫기 버튼 - 탭이 2개 이상일 때만 표시 */}
            {tabs.length > 1 && (
              <button
                onClick={(e) => handleTabClose(e, tab.id)}
                className={cn(
                  "ml-auto p-0.5 rounded-sm shrink-0 transition-opacity",
                  tab.id === activeTabId
                    ? "opacity-60 hover:opacity-100 hover:bg-muted"
                    : "opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-muted"
                )}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 새 탭 추가 버튼 */}
      <button
        onClick={handleAddHomeTab}
        className="p-2 hover:bg-muted/50 transition-colors border-l border-border/50"
        title="새 탭"
      >
        <Plus className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
};
