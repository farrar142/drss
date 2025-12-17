import { FC, useState, useRef, useEffect, memo } from "react";
import Image from 'next/image';
import { cn } from "@/lib/utils";

// 전역 IntersectionObserver 싱글톤 - 모든 FeedImage가 공유
let globalObserver: IntersectionObserver | null = null;
const observerCallbacks = new WeakMap<Element, () => void>();

const getGlobalObserver = () => {
  if (globalObserver) return globalObserver;
  if (typeof IntersectionObserver === 'undefined') return null;

  globalObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const callback = observerCallbacks.get(entry.target);
          if (callback) {
            callback();
            observerCallbacks.delete(entry.target);
            globalObserver?.unobserve(entry.target);
          }
        }
      });
    },
    {
      threshold: 0,
      rootMargin: '200px 0px'
    }
  );
  return globalObserver;
};

export const FeedImage: FC<{
  src: string;
  alt?: string;
  className?: string;
  contain?: boolean; // true면 부모에 맞춰 contain 모드로 표시
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
}> = memo(({ src, alt = '', className, contain = false, onClick, onDoubleClick }) => {
  const [isVisible, setIsVisible] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Start loading only when element is near viewport - 전역 observer 사용
  useEffect(() => {
    // If src is not an absolute http(s) url, load immediately
    try {
      const u = new URL(src);
      if (!u.protocol.startsWith('http')) {
        setIsVisible(true);
        return;
      }
    } catch (e) {
      // not a url - load immediately
      setIsVisible(true);
      return;
    }

    if (isVisible) return; // already visible

    const el = wrapperRef.current;
    if (!el) {
      setIsVisible(true);
      return;
    }

    const observer = getGlobalObserver();
    if (!observer) {
      setIsVisible(true);
      return;
    }

    // 콜백 등록 및 관찰 시작
    observerCallbacks.set(el, () => setIsVisible(true));
    observer.observe(el);

    return () => {
      observerCallbacks.delete(el);
      observer.unobserve(el);
    };
  }, [src, isVisible]);


  // Pre-schedule caching for nearby (above-the-fold / near-viewport) items to improve
  // NOTE: scheduling of caching for nearby items is handled in the parent
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  // Calculate aspect ratio based height when image loads
  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    setLoaded(true);
  };

  // Placeholder skeleton while not visible (애니메이션 제거 - 성능 이슈)
  if (!isVisible) {
    return (
      <div
        ref={wrapperRef}
        className={cn(
          "bg-muted/30 rounded",
          className
        )}
        style={contain ? {
          position: 'relative',
          width: '100%',
          height: '100%',
          minHeight: '200px'
        } : {
          width: '100%',
          aspectRatio: '16/9',
          minHeight: '100px'
        }}
      />
    );
  }

  // For images without known dimensions, use regular img tag for proper aspect ratio
  if (error) {
    // Fallback to regular img tag if Next.js Image fails
    return (
      <img
        src={src}
        alt={alt}
        className={cn(className, "select-none")}
        draggable={false}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onClick) onClick(e as unknown as React.MouseEvent<HTMLImageElement>);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onDoubleClick) onDoubleClick(e as unknown as React.MouseEvent<HTMLImageElement>);
        }}
        loading="lazy"
        style={contain ? {
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          cursor: 'pointer'
        } : {
          display: 'block',
          width: '100%',
          height: 'auto',
          cursor: 'pointer'
        }}
      />
    );
  }

  // contain 모드: fill 사용해서 부모에 맞춤
  if (contain) {
    return (
      <div ref={wrapperRef} className={cn(className, "select-none")} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes="95vw"
          draggable={false}
          style={{
            objectFit: 'contain',
            cursor: 'pointer',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.2s'
          }}
          onClick={(e) => {
            e.preventDefault();
            if (onClick) onClick(e as unknown as React.MouseEvent<HTMLImageElement>);
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            if (onDoubleClick) onDoubleClick(e as unknown as React.MouseEvent<HTMLImageElement>);
          }}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          loading="lazy"
          unoptimized={src.startsWith('data:') || (() => {
            try {
              const url = new URL(src);
              const host = url.hostname.toLowerCase();
              const envHosts = process?.env?.NEXT_PUBLIC_UNOPTIMIZED_IMAGE_HOSTS;
              const unoptimizedHosts = envHosts ? envHosts.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
              return unoptimizedHosts.includes(host);
            } catch (e) {
              return false;
            }
          })()}
        />
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={cn(className, "select-none")}>

      <Image
        src={src}
        alt={alt}
        width={naturalSize?.width || 800}
        height={naturalSize?.height || 600}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        draggable={false}
        style={{
          width: '100%',
          height: 'auto',
          cursor: 'pointer',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.2s'
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onClick) onClick(e as unknown as React.MouseEvent<HTMLImageElement>);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onDoubleClick) onDoubleClick(e as unknown as React.MouseEvent<HTMLImageElement>);
        }}
        onLoad={handleLoad}
        onError={() => setError(true)}
        loading="lazy"
        // For certain hosts that actively block server-side fetching (or cause connection resets),
        // prefer letting the browser fetch the asset directly by disabling Next.js optimization.
        // This avoids proxying via Next's /_next/image which can cause 500/ECONNRESET when the origin blocks server requests.
        unoptimized={src.startsWith('data:') || (() => {
          try {
            const url = new URL(src);
            const host = url.hostname.toLowerCase();
            const envHosts = process?.env?.NEXT_PUBLIC_UNOPTIMIZED_IMAGE_HOSTS;
            const unoptimizedHosts = envHosts ? envHosts.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
            return unoptimizedHosts.includes(host);
          } catch (e) {
            return false;
          }
        })()}
      />
    </div>
  );
});

FeedImage.displayName = 'FeedImage';
