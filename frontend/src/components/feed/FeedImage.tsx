import { FC, useState, useRef, useEffect, memo, useCallback } from "react";
import Image from 'next/image';
import { cn } from "@/lib/utils";

// 전역 IntersectionObserver 싱글톤 - 모든 FeedImage가 공유
// 로딩용 observer (화면 근처 500px)
let loadObserver: IntersectionObserver | null = null;
const loadCallbacks = new WeakMap<Element, () => void>();

// 언로딩용 observer (화면에서 2000px 벗어나면)
let unloadObserver: IntersectionObserver | null = null;
const unloadCallbacks = new WeakMap<Element, () => void>();

const getLoadObserver = () => {
  if (loadObserver) return loadObserver;
  if (typeof IntersectionObserver === 'undefined') return null;

  loadObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const callback = loadCallbacks.get(entry.target);
          callback?.();
        }
      });
    },
    {
      threshold: 0,
      rootMargin: '500px 0px' // 화면 500px 전에 로드 시작
    }
  );
  return loadObserver;
};

const getUnloadObserver = () => {
  if (unloadObserver) return unloadObserver;
  if (typeof IntersectionObserver === 'undefined') return null;

  unloadObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        // 화면에서 완전히 벗어났을 때만 언로드
        if (!entry.isIntersecting) {
          const callback = unloadCallbacks.get(entry.target);
          callback?.();
        }
      });
    },
    {
      threshold: 0,
      rootMargin: '2000px 0px' // 화면에서 2000px 벗어나면 언로드
    }
  );
  return unloadObserver;
};

export const FeedImage: FC<{
  src: string;
  alt?: string;
  className?: string;
  contain?: boolean; // true면 부모에 맞춰 contain 모드로 표시
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
}> = memo(({ src, alt = '', className, contain = false, onClick, onDoubleClick }) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  // 초기 로딩 상태만 state로 관리 (최초 1회만 변경)
  const [initialLoad, setInitialLoad] = useState(false);
  // 이후 visible/hidden은 ref + DOM 직접 조작으로 처리 (리렌더링 없음)
  const isVisibleRef = useRef(false);
  const naturalSizeRef = useRef<{ width: number; height: number } | null>(null);

  // content-visibility로 숨김 처리 (리렌더링 없이 DOM 직접 조작)
  const hideImage = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !isVisibleRef.current) return;

    isVisibleRef.current = false;
    // content-visibility: hidden - 브라우저가 렌더 트리에서 제외
    // contain-intrinsic-size로 레이아웃 크기 유지
    const size = naturalSizeRef.current;
    if (size) {
      wrapper.style.contentVisibility = 'hidden';
      wrapper.style.containIntrinsicSize = `auto ${size.width}px auto ${size.height}px`;
    }
  }, []);

  const showImage = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || isVisibleRef.current) return;

    isVisibleRef.current = true;
    wrapper.style.contentVisibility = 'visible';
    wrapper.style.containIntrinsicSize = 'auto';

    // 최초 로드 트리거
    if (!initialLoad) {
      setInitialLoad(true);
    }
  }, [initialLoad]);

  // 뷰포트 진입/이탈 감지 설정
  useEffect(() => {
    // http가 아닌 URL은 즉시 로드
    try {
      const u = new URL(src);
      if (!u.protocol.startsWith('http')) {
        setInitialLoad(true);
        isVisibleRef.current = true;
        return;
      }
    } catch {
      setInitialLoad(true);
      isVisibleRef.current = true;
      return;
    }

    const el = wrapperRef.current;
    if (!el) {
      setInitialLoad(true);
      isVisibleRef.current = true;
      return;
    }

    const loadObs = getLoadObserver();
    const unloadObs = getUnloadObserver();

    if (!loadObs || !unloadObs) {
      setInitialLoad(true);
      isVisibleRef.current = true;
      return;
    }

    // 콜백 등록 (리렌더링 없이 DOM 직접 조작)
    loadCallbacks.set(el, showImage);
    unloadCallbacks.set(el, hideImage);

    loadObs.observe(el);
    unloadObs.observe(el);

    return () => {
      loadCallbacks.delete(el);
      unloadCallbacks.delete(el);
      loadObs.unobserve(el);
      unloadObs.unobserve(el);
    };
  }, [src, showImage, hideImage]);

  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  // Calculate aspect ratio based height when image loads
  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const size = { width: img.naturalWidth, height: img.naturalHeight };
    naturalSizeRef.current = size;
    setNaturalSize(size);
    setLoaded(true);
  };

  // 초기 로드 전에는 placeholder만 표시
  if (!initialLoad) {
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
