import { FC, useState, useRef, useEffect } from "react";
import Image from 'next/image';

export const FeedImage: FC<{
  src: string;
  alt?: string;
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
}> = ({ src, alt = '', onClick, onDoubleClick }) => {
  const [isVisible, setIsVisible] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Start loading only when element is visible (or when src is not an http(s) url)
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

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          obs.disconnect();
        }
      });
    }, { threshold: 0.01 });

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

  // For images without known dimensions, use regular img tag for proper aspect ratio
  if (error) {
    // Fallback to regular img tag if Next.js Image fails
    return (
      <img
        src={src}
        alt={alt}
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
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          cursor: 'pointer'
        }}
      />
    );
  }

  return (
    <div ref={wrapperRef}>

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
