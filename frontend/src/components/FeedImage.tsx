import { FC, useState, useRef, useEffect } from "react";
import Image from 'next/image';
import { cn } from "@/lib/utils";

export const FeedImage: FC<{
  src: string;
  alt?: string;
  className?: string;
  contain?: boolean; // true면 부모에 맞춰 contain 모드로 표시
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
}> = ({ src, alt = '', className, contain = false, onClick, onDoubleClick }) => {
  const [isVisible, setIsVisible] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Start loading only when element is near viewport
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
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    // rootMargin: 뷰포트 위아래 200px 범위 내에 들어오면 로딩 시작
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          obs.disconnect();
        }
      });
    }, {
      threshold: 0,
      rootMargin: '200px 0px' // 뷰포트 위아래 200px 여유
    });

    obs.observe(el);
    return () => obs.disconnect();
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
        className={className}
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
      <div ref={wrapperRef} className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes="90vw"
          style={{
            objectFit: 'contain',
            cursor: 'pointer',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.2s'
          }}
          onClick={(e) => {
            console.log("click image")
            e.preventDefault();
            e.stopPropagation();
            if (onClick) onClick(e as unknown as React.MouseEvent<HTMLImageElement>);
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
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
    <div ref={wrapperRef} className={className}>

      <Image
        src={src}
        alt={alt}
        width={naturalSize?.width || 800}
        height={naturalSize?.height || 600}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
};
