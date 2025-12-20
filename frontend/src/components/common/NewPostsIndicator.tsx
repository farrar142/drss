'use client';

import { FC } from 'react';
import { cn } from '@/lib/utils';
import { ArrowUp } from 'lucide-react';
import { useTranslation } from '@/stores/languageStore';

export interface NewPostsIndicatorProps {
  /** 새 글 개수 */
  newCount: number;
  /** 클릭 핸들러 */
  onClick: () => void;
  /** 자동 새로고침 진행률 (0-100) */
  progress?: number;
  /** 로딩/새로고침 중인지 */
  isRefreshing?: boolean;
}

export const NewPostsIndicator: FC<NewPostsIndicatorProps> = ({
  newCount,
  onClick,
  progress = 0,
  isRefreshing = false,
}) => {
  const { t } = useTranslation();

  const handleClick = () => {
    onClick();
    // 맨 위로 스크롤
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 서큘러 프로그레스 계산
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // 진행 중이면 스피너 표시 (progress가 0보다 크거나 새로고침 중일 때)
  const showSpinner = isRefreshing || progress > 0;

  return (
    <button
      onClick={handleClick}
      className={cn(
        "fixed top-20 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-2 px-4 py-2 rounded-full",
        "bg-primary text-primary-foreground",
        "shadow-lg hover:shadow-xl",
        "transition-all duration-300 ease-out",
        "hover:scale-105 active:scale-95",
      )}
    >
      {/* 서큘러 프로그레스 */}
      <div className="relative w-6 h-6">
        {/* 배경 원 */}
        <svg className="w-6 h-6 -rotate-90" viewBox="0 0 44 44">
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="opacity-20"
          />
          {/* 프로그레스 원 */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        {/* 로딩 또는 화살표 아이콘 */}
        <div className="absolute inset-0 flex items-center justify-center">
          {showSpinner ? (
            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <ArrowUp className="w-3 h-3" />
          )}
        </div>
      </div>

      {/* 텍스트 */}
      <span className="text-sm font-medium whitespace-nowrap">
        {newCount > 0 ? t.ui.newPosts.replace('{count}', String(newCount)) : t.common.refresh}
      </span>
    </button>
  );
};
