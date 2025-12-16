import React, { ComponentType, FC, JSX, useEffect, useRef, useState } from "react";
import FeedItemCard from "./FeedItemCard";

type MeasuredItemRenderer<T extends { id: number }> = ComponentType<{
  item: T;
  onMediaClick: (src: string, type: 'image' | 'video', itemId?: number) => void;
  onCollapseChange?: (id: number, collapsed: boolean) => void;
}>

type MeseasuredItemProp<T extends { id: number }> = {

  item: T;
  onMediaClick: (src: string, type: 'image' | 'video', itemId?: number) => void;
  onHeightChange: (id: number, height: number) => void;
  isForcedVisible?: boolean;
  estimateHeight?: number;
  onCollapseChange?: (id: number, collapsed: boolean) => void;
  Renderer: MeasuredItemRenderer<T>;
}

// Wrapper component to measure item height
export const MeasuredItem = <T extends { id: number }>({ item, onMediaClick, onHeightChange, isForcedVisible, estimateHeight, onCollapseChange, Renderer }: MeseasuredItemProp<T>) => {
  const ref = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef<number>(0);
  const measuredRef = useRef<boolean>(false); // 측정 완료 여부
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    // Lazy-render content only when in/near viewport to avoid loading images/video too early
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          setIsVisible(true);
          obs.disconnect();
        }
      });
    }, { rootMargin: '400px' });
    obs.observe(ref.current);

    const measureHeight = () => {
      // 이미 측정 완료되었으면 무시
      if (measuredRef.current) return;

      if (ref.current) {
        const height = ref.current.offsetHeight;
        // Only report if height changed significantly
        if (Math.abs(lastHeightRef.current - height) > 10) {
          lastHeightRef.current = height;
          onHeightChange(item.id, height);
          // 측정 완료로 마킹 (한번만 측정)
          measuredRef.current = true;
        }
      }
    };

    // Initial measurement after a short delay to let content render
    const initialTimeout = setTimeout(measureHeight, 150);

    return () => {
      clearTimeout(initialTimeout);
    };
  }, [item.id, onHeightChange]);

  return (
    <div ref={ref} data-item-id={item.id}>
      {isVisible || isForcedVisible ? (
        <Renderer item={item} onMediaClick={onMediaClick} onCollapseChange={onCollapseChange} />
      ) : (
        <div className="bg-muted animate-pulse rounded" style={{ height: estimateHeight || 144 }} />
      )}
    </div>
  );
};
