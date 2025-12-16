'use client';

import { FC } from 'react';
import { X, SkipBack, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeedImage } from './FeedImage';
import { UseMediaModalReturn, MediaItem } from '../hooks/useMediaModal';

export interface MediaModalProps {
  modal: UseMediaModalReturn;
}

export const MediaModal: FC<MediaModalProps> = ({ modal }) => {
  const {
    modalOpen,
    modalMedia,
    currentMediaIndex,
    closeModal,
    showMediaAt,
    nextMedia,
    prevMedia,
    clickStateRef,
    clickTimeoutRef,
    currentMediaIndexRef,
    mediaListRef,
    CLICK_STATE_WINDOW,
  } = modal;

  if (!modalOpen) return null;

  const mediaList = mediaListRef.current;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-black/80 backdrop-blur-sm"
      )}
      onClick={closeModal}
    >
      {/* Close Button */}
      <button
        onClick={closeModal}
        className={cn(
          "absolute top-4 right-4 p-2 rounded-full",
          "bg-white/10 hover:bg-white/20 transition-colors"
        )}
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Media Content */}
      <div
        className={cn(
          "w-[90vw] h-[90vh] flex items-center justify-center",
          "bg-card/90 rounded-2xl border border-border p-4",
          "shadow-2xl"
        )}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onPointerDown={(e) => {
          (e.currentTarget as any)._startX = e.clientX;
        }}
        onPointerUp={(e) => {
          const startX = (e.currentTarget as any)._startX;
          if (typeof startX !== 'number') return;
          const dx = e.clientX - startX;
          if (Math.abs(dx) > 30) {
            if (dx > 0) prevMedia(); else nextMedia();
          }
        }}
      >
        {modalMedia?.type === 'video' ? (
          <video
            src={modalMedia.src}
            controls
            autoPlay
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        ) : modalMedia?.type === 'image' ? (
          <FeedImage
            src={modalMedia.src}
            alt="Enlarged"
            onClick={(e) => {
              // same logic as previous img onClick
              const evt = e as React.MouseEvent<HTMLImageElement>;
              evt.stopPropagation();
              const idx = currentMediaIndexRef.current;
              if (!mediaList || mediaList.length <= 1 || idx == null) return;

              try {
                const img = evt.currentTarget as HTMLImageElement;
                const rect = img.getBoundingClientRect();
                const clickX = evt.clientX - rect.left;
                const isLeft = clickX < rect.width / 2;

                const now = Date.now();
                if (!clickStateRef.current || now - clickStateRef.current.time > CLICK_STATE_WINDOW) {
                  clickStateRef.current = { startIndex: idx, isLeft, time: now };
                }
                if (clickTimeoutRef.current) window.clearTimeout(clickTimeoutRef.current);
                clickTimeoutRef.current = window.setTimeout(() => {
                  clickTimeoutRef.current = null;
                  clickStateRef.current = null;
                }, CLICK_STATE_WINDOW) as unknown as number;
                if (isLeft) prevMedia(); else nextMedia();
              } catch (err) {
                // ignore
              }
            }}
            onDoubleClick={(e) => {
              const evt = e as React.MouseEvent<HTMLImageElement>;
              evt.stopPropagation();
              const s = clickStateRef.current;
              if (clickTimeoutRef.current) {
                window.clearTimeout(clickTimeoutRef.current);
                clickTimeoutRef.current = null;
              }
              clickStateRef.current = null;
              if (!mediaList || mediaList.length <= 1) return;
              if (!s) return;
              try {
                const img = evt.currentTarget as HTMLImageElement;
                const rect = img.getBoundingClientRect();
                const clickX = evt.clientX - rect.left;
                const isLeftDbl = clickX < rect.width / 2;
                if (isLeftDbl && s.isLeft && s.startIndex === 0) {
                  closeModal();
                } else if (!isLeftDbl && !s.isLeft && s.startIndex === mediaList.length - 1) {
                  closeModal();
                }
              } catch (err) {
                // ignore
              }
            }}
          />
        ) : null}

        {/* Prev / Next buttons */}
        {mediaList.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const idx = currentMediaIndexRef.current;
                const now = Date.now();
                if (!clickStateRef.current || now - clickStateRef.current.time > CLICK_STATE_WINDOW) {
                  clickStateRef.current = { startIndex: idx, isLeft: true, time: now };
                }
                if (clickTimeoutRef.current) window.clearTimeout(clickTimeoutRef.current);
                clickTimeoutRef.current = window.setTimeout(() => {
                  clickTimeoutRef.current = null;
                  clickStateRef.current = null;
                }, CLICK_STATE_WINDOW) as unknown as number;
                showMediaAt(0);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                const s = clickStateRef.current;
                if (clickTimeoutRef.current) {
                  window.clearTimeout(clickTimeoutRef.current);
                  clickTimeoutRef.current = null;
                }
                clickStateRef.current = null;
                if (s && s.isLeft && s.startIndex === 0) closeModal();
              }}
              title="처음으로"
              aria-label="first"
              className={cn(
                "p-2 rounded bg-white/10 hover:bg-white/20",
                (currentMediaIndex == null || currentMediaIndex === 0) && "opacity-40 pointer-events-none"
              )}
              aria-disabled={currentMediaIndex == null || currentMediaIndex === 0}
            >
              <SkipBack className="w-4 h-4" />
              <span className="sr-only">처음으로</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const idx = currentMediaIndexRef.current;
                const now = Date.now();
                if (!clickStateRef.current || now - clickStateRef.current.time > CLICK_STATE_WINDOW) {
                  clickStateRef.current = { startIndex: idx, isLeft: true, time: now };
                }
                if (clickTimeoutRef.current) window.clearTimeout(clickTimeoutRef.current);
                clickTimeoutRef.current = window.setTimeout(() => {
                  clickTimeoutRef.current = null;
                  clickStateRef.current = null;
                }, CLICK_STATE_WINDOW) as unknown as number;
                prevMedia();
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                const s = clickStateRef.current;
                if (clickTimeoutRef.current) {
                  window.clearTimeout(clickTimeoutRef.current);
                  clickTimeoutRef.current = null;
                }
                clickStateRef.current = null;
                if (s && s.isLeft && s.startIndex === 0) closeModal();
              }}
              title="이전"
              aria-label="previous"
              className={cn(
                "p-2 rounded bg-white/10 hover:bg-white/20",
                (currentMediaIndex == null || currentMediaIndex === 0) && "opacity-40 pointer-events-none"
              )}
              aria-disabled={currentMediaIndex == null || currentMediaIndex === 0}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="sr-only">이전</span>
            </button>
            <div className="text-xs text-white/90 bg-black/40 px-3 py-1 rounded">
              {currentMediaIndex != null ? `${currentMediaIndex + 1}/${mediaList.length}` : ''}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const idx = currentMediaIndexRef.current;
                const now = Date.now();
                if (!clickStateRef.current || now - clickStateRef.current.time > CLICK_STATE_WINDOW) {
                  clickStateRef.current = { startIndex: idx, isLeft: false, time: now };
                }
                if (clickTimeoutRef.current) window.clearTimeout(clickTimeoutRef.current);
                clickTimeoutRef.current = window.setTimeout(() => {
                  clickTimeoutRef.current = null;
                  clickStateRef.current = null;
                }, CLICK_STATE_WINDOW) as unknown as number;
                nextMedia();
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                const s = clickStateRef.current;
                if (clickTimeoutRef.current) {
                  window.clearTimeout(clickTimeoutRef.current);
                  clickTimeoutRef.current = null;
                }
                clickStateRef.current = null;
                if (s && !s.isLeft && s.startIndex === mediaList.length - 1) closeModal();
              }}
              title="다음"
              aria-label="next"
              className={cn(
                "p-2 rounded bg-white/10 hover:bg-white/20",
                (currentMediaIndex == null || currentMediaIndex === mediaList.length - 1) && "opacity-40 pointer-events-none"
              )}
              aria-disabled={currentMediaIndex == null || currentMediaIndex === mediaList.length - 1}
            >
              <ChevronRight className="w-4 h-4" />
              <span className="sr-only">다음</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const idx = currentMediaIndexRef.current;
                const now = Date.now();
                if (!clickStateRef.current || now - clickStateRef.current.time > CLICK_STATE_WINDOW) {
                  clickStateRef.current = { startIndex: idx, isLeft: false, time: now };
                }
                if (clickTimeoutRef.current) window.clearTimeout(clickTimeoutRef.current);
                clickTimeoutRef.current = window.setTimeout(() => {
                  clickTimeoutRef.current = null;
                  clickStateRef.current = null;
                }, CLICK_STATE_WINDOW) as unknown as number;
                showMediaAt(mediaList.length - 1);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                const s = clickStateRef.current;
                if (clickTimeoutRef.current) {
                  window.clearTimeout(clickTimeoutRef.current);
                  clickTimeoutRef.current = null;
                }
                clickStateRef.current = null;
                if (s && !s.isLeft && s.startIndex === mediaList.length - 1) closeModal();
              }}
              title="마지막으로"
              aria-label="last"
              className={cn(
                "p-2 rounded bg-white/10 hover:bg-white/20",
                (currentMediaIndex == null || currentMediaIndex === mediaList.length - 1) && "opacity-40 pointer-events-none"
              )}
              aria-disabled={currentMediaIndex == null || currentMediaIndex === mediaList.length - 1}
            >
              <SkipForward className="w-4 h-4" />
              <span className="sr-only">마지막으로</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
