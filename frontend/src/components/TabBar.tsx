'use client';

import React, { useRef, useEffect, useState } from 'react';
import { X, Home, Folder, Rss, Settings, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTabStore, Tab, TabType } from '../stores/tabStore';
import { cn } from '@/lib/utils';

// 탭 타입별 아이콘
const TabIcon: React.FC<{ type: TabType; favicon?: string; className?: string }> = ({ type, favicon, className }) => {
  const [faviconError, setFaviconError] = useState(false);
  
  // favicon이 변경되면 에러 상태 리셋
  useEffect(() => {
    setFaviconError(false);
  }, [favicon]);
  
  // 피드 타입이고 favicon이 있고 로드 에러가 없으면 favicon 이미지 표시
  if (type === 'feed' && favicon && !faviconError) {
    return (
      <img 
        src={favicon} 
        alt="" 
        className={cn(className, "rounded-sm object-cover")}
        onError={() => setFaviconError(true)}
      />
    );
  }
  
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
  
  // 드래그 스크롤 상태
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const hasDraggedRef = useRef(false); // 드래그가 발생했는지 여부 (클릭 방지용)

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

  // 드래그 스크롤 핸들러
  const handleMouseDown = (e: React.MouseEvent) => {
    const container = tabsContainerRef.current;
    if (!container) return;
    
    setIsDragging(true);
    setStartX(e.pageX - container.offsetLeft);
    setScrollLeft(container.scrollLeft);
    hasDraggedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    
    const container = tabsContainerRef.current;
    if (!container) return;
    
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5; // 스크롤 속도 조절
    
    // 일정 거리 이상 드래그하면 드래그로 인식
    if (Math.abs(x - startX) > 5) {
      hasDraggedRef.current = true;
    }
    
    container.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    // 드래그 후 약간의 딜레이 후에 클릭 가능하도록
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 50);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
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
        className={cn(
          "flex-1 flex items-center overflow-x-auto scrollbar-none",
          isDragging ? "cursor-grabbing select-none" : "cursor-grab"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            data-tab-id={tab.id}
            onClick={() => !hasDraggedRef.current && handleTabClick(tab)}
            title={tab.title}
            className={cn(
              "group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-border/50 min-w-0 shrink-0",
              "transition-colors duration-150",
              tab.id === activeTabId
                ? "bg-card text-foreground"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <TabIcon type={tab.type} favicon={tab.favicon} className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs font-medium truncate max-w-[120px]">{tab.title}</span>
            
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
