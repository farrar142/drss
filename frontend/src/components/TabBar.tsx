'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Home, Folder, Rss, Settings, Plus, Columns2, ChevronDown, Globe, ClipboardList } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTabStore, Tab, TabType, PanelId } from '../stores/tabStore';
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
    case 'rss-everything':
      return <Globe className={className} />;
    case 'task-results':
      return <ClipboardList className={className} />;
    case 'periodic-tasks':
      return <ClipboardList className={className} />;
    default:
      return null;
  }
};

interface TabBarProps {
  className?: string;
  panelId: PanelId;
  tabs: Tab[];
  activeTabId: string | null;
  onTabClick: (tab: Tab) => void;
  onTabClose: (tabId: string) => void;
  onAddTab: () => void;
  onTabDragStart?: (e: React.DragEvent, tab: Tab) => void;
  onTabDragOver?: (e: React.DragEvent) => void;
  onTabDrop?: (e: React.DragEvent, side: 'left' | 'right') => void;
  canClose?: boolean;
  showSplitButton?: boolean;
  onSplitPanel?: (side: 'left' | 'right') => void;
  onColumnsChange?: (tabId: string, columns: number) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  className,
  panelId,
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onAddTab,
  onTabDragStart,
  canClose = true,
  showSplitButton = false,
  onColumnsChange,
}) => {
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  // 화면 너비 상태 (작은 화면에서는 컬럼 설정 숨김)
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  // 드래그 스크롤 상태
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const hasDraggedRef = useRef(false); // 드래그가 발생했는지 여부 (클릭 방지용)

  // 화면 너비 감지 (디바운싱 적용)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 640); // sm breakpoint
    };
    
    const debouncedCheck = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(checkScreenSize, 150);
    };
    
    checkScreenSize();
    window.addEventListener('resize', debouncedCheck, { passive: true });
    return () => {
      window.removeEventListener('resize', debouncedCheck);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const handleTabClick = (tab: Tab) => {
    if (hasDraggedRef.current) return;
    onTabClick(tab);
  };

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    onTabClose(tabId);
  };  // 드래그 스크롤 핸들러
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

  // 컬럼 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    if (showColumnMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnMenu]);

  // 활성 탭 정보
  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeColumns = activeTab?.columns ?? 3;
  // settings, rss-everything, feed-edit, task-results, periodic-tasks 탭 또는 작은 화면에서는 컬럼 설정 숨김 (1열 강제)
  const showColumnSetting = activeTab && !isSmallScreen && !['settings', 'rss-everything', 'feed-edit', 'task-results', 'periodic-tasks'].includes(activeTab.type);

  // 활성 탭이 보이도록 스크롤
  useEffect(() => {
    const activeTabElement = tabsContainerRef.current?.querySelector(`[data-tab-id="${activeTabId}"]`);
    if (activeTabElement) {
      activeTabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTabId]);

  return (
    <div className={cn(
      "flex items-center h-9 bg-background/80 backdrop-blur-sm border-b border-border",
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
            draggable
            onDragStart={(e) => onTabDragStart?.(e, tab)}
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

            {/* 닫기 버튼 - canClose가 true일 때만 표시 */}
            {canClose && (
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
        onClick={(e) => {
          e.stopPropagation();
          onAddTab();
        }}
        className="p-2 hover:bg-muted/50 transition-colors border-l border-border/50"
        title="새 탭"
      >
        <Plus className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* 컬럼 수 조절 버튼 */}
      {showColumnSetting && onColumnsChange && (
        <div className="relative" ref={columnMenuRef}>
          <button
            onClick={(e) => {
              console.log('컬럼 수 조절 버튼 클릭');
              e.stopPropagation();
              e.preventDefault();
              console.log('현재 showColumnMenu:', showColumnMenu);
              console.log('현재 활성화된 탭 ID:', activeTabId);
              setShowColumnMenu(!showColumnMenu);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-2 hover:bg-muted/50 transition-colors border-l border-border/50 flex items-center gap-0.5"
            title="컬럼 수 조절"
          >
            <Columns2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">{activeColumns}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>

          {showColumnMenu && activeTabId && (
            <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-[200] min-w-[100px]">
              <div className="p-1">
                <div className="px-2 py-1 text-xs text-muted-foreground font-medium">컬럼 수</div>
                {[1, 2, 3, 4, 5].map((col) => (
                  <button
                    key={col}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onColumnsChange(activeTabId, col);
                      setShowColumnMenu(false);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-sm rounded-sm transition-colors",
                      col === activeColumns
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    {col}열
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
