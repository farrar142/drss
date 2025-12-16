'use client';

import { FC, useState, useEffect } from 'react';
import { X, SkipBack, SkipForward, ChevronLeft, ChevronRight, Download, Archive, Loader2, Square, Columns2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeedImage } from './FeedImage';
import { UseMediaModalReturn, MediaItem } from '../hooks/useMediaModal';
import { useSettingsStore } from '../stores/settingsStore';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { FeedVideo } from './FeedVideo';

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

// 프록시 URL 생성 (CORS 우회)
const getProxiedUrl = (src: string): string => {
  return `/api/proxy/image?url=${encodeURIComponent(src)}`;
};

// 단일 미디어 다운로드
const downloadSingleMedia = async (src: string, filename: string) => {
  try {
    const fetchUrl = getProxiedUrl(src);
    const response = await fetch(fetchUrl);
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
      const fetchUrl = getProxiedUrl(media.src);
      const response = await fetch(fetchUrl);
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
  const { mediaViewMode: viewMode, setMediaViewMode: setViewMode } = useSettingsStore();

  // viewMode에 따른 네비게이션 핸들러
  const handleNext = () => {
    if (currentMediaIndex == null) return;
    const mediaCount = mediaListRef.current.length;
    if (viewMode === 2) {
      // 듀얼 뷰: 현재 짝수 인덱스 기준으로 다음 짝수 인덱스로 이동
      const currentLeftIndex = Math.floor(currentMediaIndex / 2) * 2;
      const nextLeftIndex = currentLeftIndex + 2;
      if (nextLeftIndex < mediaCount) {
        showMediaAt(nextLeftIndex);
      }
    } else {
      // 싱글 뷰: 1개씩 이동
      const next = currentMediaIndex + 1;
      if (next < mediaCount) showMediaAt(next);
    }
  };

  const handlePrev = () => {
    if (currentMediaIndex == null) return;
    if (viewMode === 2) {
      // 듀얼 뷰: 현재 짝수 인덱스 기준으로 이전 짝수 인덱스로 이동
      const currentLeftIndex = Math.floor(currentMediaIndex / 2) * 2;
      const prevLeftIndex = currentLeftIndex - 2;
      if (prevLeftIndex >= 0) {
        showMediaAt(prevLeftIndex);
      }
    } else {
      // 싱글 뷰: 1개씩 이동
      const prev = currentMediaIndex - 1;
      if (prev >= 0) showMediaAt(prev);
    }
  };

  // 모달이 열릴 때 body 스크롤 막기
  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [modalOpen]);

  if (!modalOpen) return null;

  const mediaList = mediaListRef.current;
  const mediaCount = mediaList.length;

  // 듀얼 뷰 모드에서의 인덱스 계산
  const leftIndex = currentMediaIndex != null ? Math.floor(currentMediaIndex / 2) * 2 : null;
  const rightIndex = leftIndex != null ? Math.min(leftIndex + 1, mediaCount - 1) : null;

  // 네비게이션 가능 여부 (viewMode에 따라 다르게 계산)
  const canGoPrev = currentMediaIndex != null && (
    viewMode === 1
      ? currentMediaIndex > 0
      : (leftIndex != null && leftIndex > 0)
  );
  const canGoNext = currentMediaIndex != null && (
    viewMode === 1
      ? currentMediaIndex < mediaCount - 1
      : (rightIndex != null && rightIndex < mediaCount - 1)
  );

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
      {/* Media Content */}
      <div
        className={cn(
          "w-[90vw] h-[90vh] flex items-center justify-center",
          "bg-card/90 rounded-2xl border border-border p-4",
          "shadow-2xl relative"
        )}
        // onClick={(e) => e.stopPropagation()}
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
      >
        {/* Single View Mode */}
        {viewMode === 1 && (
          <>
            {modalMedia?.type === 'video' ? (
              <FeedVideo
                key={modalMedia.src}
                src={modalMedia.src}
                controls
                autoPlay
                className="max-w-full max-h-[calc(90vh-80px)] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            ) : modalMedia?.type === 'image' ? (
              <FeedImage
                src={modalMedia.src}
                alt="Enlarged"
                contain
                className="max-h-[calc(90vh-80px)]"
                onClick={(e) => e.preventDefault()}
              />
            ) : null}
          </>
        )}

        {/* Dual View Mode */}
        {viewMode === 2 && (() => {
          // 듀얼 뷰에서는 항상 짝수 인덱스(0, 2, 4...)에서 시작하도록 보정
          const leftIndex = currentMediaIndex != null ? Math.floor(currentMediaIndex / 2) * 2 : null;
          const rightIndex = leftIndex != null ? leftIndex + 1 : null;

          return (
            <div className="flex items-center justify-center gap-4 w-full h-[calc(90vh-80px)]">
              {/* Left Image - 클릭 시 이전으로 */}
              <div
                className="flex-1 h-full flex items-center justify-center cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
              >
                {leftIndex != null && mediaList[leftIndex] && (
                  mediaList[leftIndex].type === 'video' ? (
                    <FeedVideo
                      key={mediaList[leftIndex].src}
                      src={mediaList[leftIndex].src}
                      controls
                      autoPlay
                      className="max-w-full max-h-full object-contain rounded-lg pointer-events-auto"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <FeedImage
                      src={mediaList[leftIndex].src}
                      alt={`Image ${leftIndex + 1}`}
                      contain
                      className="max-h-full pointer-events-none"
                    />
                  )
                )}
              </div>

              {/* Divider */}
              <div className="w-px h-3/4 bg-border" />

              {/* Right Image - 클릭 시 다음으로 */}
              <div
                className="flex-1 h-full flex items-center justify-center cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
              >
                {rightIndex != null && rightIndex < mediaList.length && mediaList[rightIndex] ? (
                  mediaList[rightIndex].type === 'video' ? (
                    <FeedVideo
                      key={mediaList[rightIndex].src}
                      src={mediaList[rightIndex].src}
                      controls
                      autoPlay
                      className="max-w-full max-h-full object-contain rounded-lg pointer-events-auto"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <FeedImage
                      src={mediaList[rightIndex].src}
                      alt={`Image ${rightIndex + 1}`}
                      contain
                      className="max-h-full pointer-events-none"
                    />
                  )
                ) : (
                  <div className="flex items-center justify-center text-muted-foreground">
                    <span className="text-sm">마지막 이미지</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Bottom Controls Bar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1.5">

            {/* === 저장들 === */}
            {/* Download Current */}
            {modalMedia && (
              <button
                onClick={handleDownloadCurrent}
                title={modalMedia.type === 'video' ? '현재 비디오 다운로드' : '현재 이미지 다운로드'}
                className="p-2 rounded-full hover:bg-white/20 transition-colors"
              >
                <Download className="w-4 h-4 text-white" />
              </button>
            )}

            {/* Download All as ZIP */}
            {mediaCount > 1 && (
              <button
                onClick={handleDownloadAll}
                disabled={isDownloading}
                title={isDownloading ? `다운로드 중... ${downloadProgress}%` : `전체 다운로드 (${mediaCount}개)`}
                className={cn(
                  "p-2 rounded-full hover:bg-white/20 transition-colors relative",
                  isDownloading && "cursor-wait"
                )}
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <>
                    <Archive className="w-4 h-4 text-white" />
                    <span className="absolute -top-1 -right-1 text-[9px] bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center font-medium">
                      {mediaCount}
                    </span>
                  </>
                )}
              </button>
            )}

            {/* Divider: 저장들 | 브라우징 */}
            {mediaList.length > 1 && <div className="w-px h-5 bg-white/20 mx-1" />}

            {/* === 브라우징 === */}
            {mediaList.length > 1 && (
              <>
                {/* First */}
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
                    "p-2 rounded-full hover:bg-white/20 transition-colors",
                    !canGoPrev && "opacity-30 pointer-events-none"
                  )}
                  aria-disabled={!canGoPrev}
                >
                  <SkipBack className="w-4 h-4 text-white" />
                </button>

                {/* Previous */}
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
                    handlePrev();
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
                    "p-2 rounded-full hover:bg-white/20 transition-colors",
                    !canGoPrev && "opacity-30 pointer-events-none"
                  )}
                  aria-disabled={!canGoPrev}
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>

                {/* Counter */}
                <div className="px-3 py-1 text-xs text-white/90 font-medium min-w-[60px] text-center">
                  {currentMediaIndex != null ? (
                    viewMode === 2
                      ? (() => {
                        const leftIdx = Math.floor(currentMediaIndex / 2) * 2;
                        const rightIdx = Math.min(leftIdx + 1, mediaList.length - 1);
                        return leftIdx === rightIdx
                          ? `${leftIdx + 1} / ${mediaList.length}`
                          : `${leftIdx + 1}-${rightIdx + 1} / ${mediaList.length}`;
                      })()
                      : `${currentMediaIndex + 1} / ${mediaList.length}`
                  ) : ''}
                </div>

                {/* Next */}
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
                    handleNext();
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
                    "p-2 rounded-full hover:bg-white/20 transition-colors",
                    !canGoNext && "opacity-30 pointer-events-none"
                  )}
                  aria-disabled={!canGoNext}
                >
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>

                {/* Last */}
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
                    "p-2 rounded-full hover:bg-white/20 transition-colors",
                    !canGoNext && "opacity-30 pointer-events-none"
                  )}
                  aria-disabled={!canGoNext}
                >
                  <SkipForward className="w-4 h-4 text-white" />
                </button>
              </>
            )}

            {/* Divider: 브라우징 | 2개보기, 종료 */}
            <div className="w-px h-5 bg-white/20 mx-1" />

            {/* === 2개보기, 종료 === */}
            {/* View Mode Toggle (only if multiple media) */}
            {mediaCount > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode(viewMode === 1 ? 2 : 1);
                }}
                title={viewMode === 1 ? '2개씩 보기' : '1개씩 보기'}
                className={cn(
                  "p-2 rounded-full hover:bg-white/20 transition-colors",
                  viewMode === 2 && "bg-white/20"
                )}
              >
                {viewMode === 1 ? (
                  <Columns2 className="w-4 h-4 text-white" />
                ) : (
                  <Square className="w-4 h-4 text-white" />
                )}
              </button>
            )}

            {/* Close */}
            <button
              onClick={closeModal}
              title="닫기"
              className="p-2 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
