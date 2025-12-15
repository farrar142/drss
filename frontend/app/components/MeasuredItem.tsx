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
      if (ref.current) {
        const height = ref.current.offsetHeight;
        // Only report if height changed significantly
        if (Math.abs(lastHeightRef.current - height) > 10) {
          lastHeightRef.current = height;
          onHeightChange(item.id, height);
        }
      }
    };

    // Initial measurement after a short delay to let content render
    const initialTimeout = setTimeout(measureHeight, 100);

    // Re-measure when images load
    const images = ref.current.querySelectorAll('img');
    const imageLoadHandler = () => {
      setTimeout(measureHeight, 50);
    };

    images.forEach(img => {
      if (!img.complete) {
        img.addEventListener('load', imageLoadHandler);
        img.addEventListener('error', imageLoadHandler);
      }
    });

    // One final measurement after all images should be loaded
    const finalTimeout = setTimeout(measureHeight, 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(finalTimeout);
      images.forEach(img => {
        img.removeEventListener('load', imageLoadHandler);
        img.removeEventListener('error', imageLoadHandler);
      });
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
