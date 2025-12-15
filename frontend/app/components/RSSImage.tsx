import { FC, useState, useRef, useEffect } from "react";
import Image from 'next/image';

export const RSSImage: FC<{
  src: string;
  alt?: string;
  onClick: () => void;
}> = ({ src, alt = '', onClick }) => {
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
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

  useEffect(() => {
    if (!isVisible) return;
    let mounted = true;

    const tryUseCacheOrSchedule = async () => {
      try {
        // No server-side image caching: just use the original image URL
        if (mounted) setCurrentSrc(src);
      } catch (e) {
        if (mounted) setCurrentSrc(src);
      }
    };

    tryUseCacheOrSchedule();
    return () => { mounted = false; };
  }, [isVisible, src]);

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
          onClick();
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
      {currentSrc ? (
        <Image
          src={currentSrc}
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
            onClick();
          }}
          onLoad={handleLoad}
          onError={() => setError(true)}
          loading="lazy"
          // For certain hosts that actively block server-side fetching (or cause connection resets),
          // prefer letting the browser fetch the asset directly by disabling Next.js optimization.
          // This avoids proxying via Next's /_next/image which can cause 500/ECONNRESET when the origin blocks server requests.
          unoptimized={currentSrc.startsWith('data:') || (() => {
            try {
              const url = new URL(currentSrc);
              const host = url.hostname.toLowerCase();
              const envHosts = process?.env?.NEXT_PUBLIC_UNOPTIMIZED_IMAGE_HOSTS;
              const unoptimizedHosts = envHosts ? envHosts.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : ['cosplaytele.com'];
              return unoptimizedHosts.includes(host);
            } catch (e) {
              return false;
            }
          })()}
        />
      ) : (
        // Placeholder box to reserve layout before image becomes visible/loaded
        <div
          role="img"
          aria-label={alt}
          onClick={(e) => {
            // clicking a placeholder should trigger loading and also propagate the click intent
            e.preventDefault();
            e.stopPropagation();
            setIsVisible(true);
            onClick();
          }}
          style={{
            display: 'block',
            width: '100%',
            paddingTop: naturalSize ? `${(naturalSize.height / naturalSize.width) * 100}%` : '56.25%',
            background: 'linear-gradient(90deg, rgba(0,0,0,0.03), rgba(0,0,0,0.06))',
            cursor: 'pointer'
          }}
        />
      )}
    </div>
  );
};
