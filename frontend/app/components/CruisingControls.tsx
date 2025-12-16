'use client';

import { FC, useState } from 'react';
import { ChevronDown, Pause, Ship, ChevronsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';

export interface CruisingControlsProps {
  isCruising: boolean;
  speedPercent: number;
  onToggle: () => void;
  onSpeedChange: (percent: number) => void;
}

export const CruisingControls: FC<CruisingControlsProps> = ({
  isCruising,
  speedPercent,
  onToggle,
  onSpeedChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3"
      data-cruising-control
    >
      {/* Speed Slider - shows when expanded or cruising */}
      {(isExpanded || isCruising) && (
        <div
          className={cn(
            "bg-card/95 backdrop-blur-sm rounded-xl border border-border shadow-lg p-4",
            "animate-in slide-in-from-bottom-2 fade-in duration-200"
          )}
          data-cruising-control
        >
          <div className="flex items-center gap-3 min-w-[200px]">
            <span className="text-xs text-muted-foreground whitespace-nowrap">느림</span>
            <Slider
              value={[speedPercent]}
              onValueChange={([value]: number[]) => onSpeedChange(value)}
              min={0}
              max={100}
              step={1}
              className="flex-1"
              data-cruising-control
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">빠름</span>
          </div>
          <div className="text-center text-xs text-muted-foreground mt-2">
            스크롤 속도: {Math.round(speedPercent)}%
          </div>
        </div>
      )}

      {/* FAB Buttons */}
      <div className="flex items-center gap-2" data-cruising-control>
        {/* Settings toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "p-3 rounded-full shadow-lg transition-all",
            "bg-secondary hover:bg-secondary/80",
            "hover:scale-105 active:scale-95",
            isExpanded && "bg-secondary/80"
          )}
          data-cruising-control
          title="크루징 설정"
          aria-label="크루징 설정"
        >
          <Ship className="w-5 h-5" />
        </button>

        {/* Scroll-to-top button (placed above Play/Pause) */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={cn(
            "p-3 rounded-full shadow-lg transition-all",
            "bg-primary hover:bg-primary/90 text-primary-foreground",
            "hover:scale-105 active:scale-95"
          )}
          data-cruising-control
          title="맨 위로"
          aria-label="맨 위로"
        >
          <ChevronsUp className="w-5 h-5 -mt-0.5" />
        </button>

        {/* Play/Pause button */}
        <button
          onClick={onToggle}
          className={cn(
            "p-4 rounded-full shadow-lg transition-all",
            "hover:scale-105 active:scale-95",
            isCruising
              ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              : "bg-primary hover:bg-primary/90 text-primary-foreground"
          )}
          data-cruising-control
          title={isCruising ? "크루징 멈춤" : "크루징 시작"}
          aria-label={isCruising ? "크루징 멈춤" : "크루징 시작"}
        >
          {isCruising ? (
            <Pause className="w-6 h-6" />
          ) : (
            <ChevronDown className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Cruising indicator */}
      {isCruising && (
        <div
          className={cn(
            "absolute -top-2 -right-2 w-3 h-3 rounded-full bg-green-500",
            "animate-pulse"
          )}
          data-cruising-control
        />
      )}
    </div>
  );
};
