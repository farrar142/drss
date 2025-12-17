import { FC, useRef, useEffect } from "react";

// 필터링할 잘못된 DOM 속성들
const INVALID_VIDEO_PROPS = ['playsinline', 'autoplay', 'autopictureinpicture', 'disablepictureinpicture', 'disableremoteplayback', 'style'];

// Custom Video component with intersection observer for autoplay
export const FeedVideo: FC<{
  src?: string;
  poster?: string;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLVideoElement>) => void | (() => void);
  [key: string]: any;
}> = ({ src, poster, className, onClick, ...props }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // 잘못된 DOM 속성 필터링
  const filteredProps = Object.fromEntries(
    Object.entries(props).filter(([key]) => !INVALID_VIDEO_PROPS.includes(key.toLowerCase()))
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            video.play().catch(() => { });
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      className={className}
      muted
      loop
      playsInline
      controls
      preload="metadata"
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
        cursor: onClick ? 'pointer' : undefined
      }}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick(e);
        }
      }}
      {...filteredProps}
    />
  );
};
