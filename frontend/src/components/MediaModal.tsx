'use client';

import { FC, useState } from 'react';
import { X, SkipBack, SkipForward, ChevronLeft, ChevronRight, Download, Archive, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeedImage } from './FeedImage';
import { UseMediaModalReturn, MediaItem } from '../hooks/useMediaModal';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// 미디어 URL에서 파일명 추출
const getFilenameFromUrl = (url: string, index: number, type: 'image' | 'video'): string => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    if (type === 'image' && filename && /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(filename)) {
      return filename;
    }
    if (type === 'video' && filename && /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(filename)) {
      return filename;
    }
  } catch {
    // URL 파싱 실패시 기본 이름 사용
  }
  // 확장자 추측
  if (type === 'video') {
    const ext = url.match(/\.(mp4|webm|ogg|mov|avi|mkv)/i)?.[1] || 'mp4';
    return `video_${index + 1}.${ext}`;
  }
  const ext = url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)/i)?.[1] || 'jpg';
  return `image_${index + 1}.${ext}`;
};

// 단일 미디어 다운로드
const downloadSingleMedia = async (src: string, filename: string) => {
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error('Failed to fetch media');
    const blob = await response.blob();
    saveAs(blob, filename);
  } catch (error) {
    console.error('Download failed:', error);
    // 폴백: 새 탭에서 열기
    window.open(src, '_blank');
  }
};

// 모든 미디어 ZIP으로 다운로드
const downloadAllAsZip = async (
  mediaList: MediaItem[],
  onProgress?: (progress: number) => void
): Promise<void> => {
  if (mediaList.length === 0) return;

  const zip = new JSZip();
  const imagesFolder = zip.folder('images');
  const videosFolder = zip.folder('videos');
  if (!imagesFolder || !videosFolder) return;

  let completed = 0;
  const total = mediaList.length;
  let imageIndex = 0;
  let videoIndex = 0;

  const fetchPromises = mediaList.map(async (media) => {
    try {
      const response = await fetch(media.src);
      if (!response.ok) throw new Error(`Failed to fetch: ${media.src}`);
      const blob = await response.blob();
      if (media.type === 'image') {
        const filename = getFilenameFromUrl(media.src, imageIndex++, 'image');
        imagesFolder.file(filename, blob);
      } else {
        const filename = getFilenameFromUrl(media.src, videoIndex++, 'video');
        videosFolder.file(filename, blob);
      }
    } catch (error) {
      console.error(`Failed to download media:`, error);
    } finally {
      completed++;
      onProgress?.(Math.round((completed / total) * 100));
    }
  });

  await Promise.all(fetchPromises);

  const content = await zip.generateAsync({ type: 'blob' });
  const timestamp = new Date().toISOString().slice(0, 10);
  saveAs(content, `media_${timestamp}.zip`);
};

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

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  if (!modalOpen) return null;

  const mediaList = mediaListRef.current;
  const mediaCount = mediaList.length;

  const handleDownloadCurrent = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!modalMedia) return;
    const filename = getFilenameFromUrl(modalMedia.src, currentMediaIndex ?? 0, modalMedia.type);
    await downloadSingleMedia(modalMedia.src, filename);
  };

  const handleDownloadAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading || mediaCount === 0) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      await downloadAllAsZip(mediaList, setDownloadProgress);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-black/80 backdrop-blur-sm"
      )}
      onClick={closeModal}
    >
      {/* Top Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {/* Download Current Media */}
        {modalMedia && (
          <button
            onClick={handleDownloadCurrent}
            title={modalMedia.type === 'video' ? '현재 비디오 다운로드' : '현재 이미지 다운로드'}
            className={cn(
              "p-2 rounded-full",
              "bg-white/10 hover:bg-white/20 transition-colors"
            )}
          >
            <Download className="w-6 h-6 text-white" />
          </button>
        )}

        {/* Download All as ZIP */}
        {mediaCount > 1 && (
          <button
            onClick={handleDownloadAll}
            disabled={isDownloading}
            title={isDownloading ? `다운로드 중... ${downloadProgress}%` : `전체 미디어 다운로드 (${mediaCount}개)`}
            className={cn(
              "p-2 rounded-full relative",
              "bg-white/10 hover:bg-white/20 transition-colors",
              isDownloading && "cursor-wait"
            )}
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-6 h-6 text-white animate-spin" />
                <span className="absolute -bottom-1 -right-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1">
                  {downloadProgress}%
                </span>
              </>
            ) : (
              <>
                <Archive className="w-6 h-6 text-white" />
                <span className="absolute -bottom-1 -right-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5">
                  {mediaCount}
                </span>
              </>
            )}
          </button>
        )}

        {/* Close Button */}
        <button
          onClick={closeModal}
          className={cn(
            "p-2 rounded-full",
            "bg-white/10 hover:bg-white/20 transition-colors"
          )}
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Media Content */}
      <div
        className={cn(
          "w-[90vw] h-[90vh] flex items-center justify-center",
          "bg-card/90 rounded-2xl border border-border p-4",
          "shadow-2xl"
        )}
        onClick={(e) => e.stopPropagation()}
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
            contain
            onClick={(e) => {
              e.stopPropagation();
              const idx = currentMediaIndexRef.current;
              if (!mediaList || mediaList.length <= 1 || idx == null) return;

              try {
                const img = e.currentTarget as HTMLImageElement;
                const rect = img.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
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
              e.stopPropagation();
              const s = clickStateRef.current;
              if (clickTimeoutRef.current) {
                window.clearTimeout(clickTimeoutRef.current);
                clickTimeoutRef.current = null;
              }
              clickStateRef.current = null;
              if (!mediaList || mediaList.length <= 1) return;
              if (!s) return;
              try {
                const img = e.currentTarget as HTMLImageElement;
                const rect = img.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
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
