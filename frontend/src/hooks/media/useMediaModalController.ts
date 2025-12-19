'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { UseMediaModalReturn, MediaItem } from './useMediaModal';
import { useSettingsStore } from '@/stores/settingsStore';
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

export interface UseMediaModalControllerReturn {
  // 기본 모달 상태
  modal: UseMediaModalReturn;
  modalOpen: boolean;
  modalMedia: { type: 'image' | 'video'; src: string; itemId?: number } | null;
  currentMediaIndex: number | null;
  mediaList: MediaItem[];
  mediaCount: number;

  // 다운로드 상태
  isDownloading: boolean;
  downloadProgress: number;

  // 뷰 설정
  viewMode: 1 | 2;
  readDirection: 'ltr' | 'rtl';
  dualAlignment: 'spread' | 'center';

  // 네비게이션 상태
  canGoPrev: boolean;
  canGoNext: boolean;

  // 듀얼 뷰 인덱스
  leftIndex: number | null;
  rightIndex: number | null;

  // 네비게이션 핸들러
  handleNext: () => void;
  handlePrev: () => void;
  handleFirst: () => void;
  handleLast: () => void;

  // 다운로드 핸들러
  handleDownloadCurrent: (e: React.MouseEvent) => Promise<void>;
  handleDownloadAll: (e: React.MouseEvent) => Promise<void>;

  // 설정 토글 핸들러
  toggleViewMode: (e: React.MouseEvent) => void;
  toggleReadDirection: (e: React.MouseEvent) => void;
  toggleDualAlignment: (e: React.MouseEvent) => void;

  // 제스처 핸들러
  handlePointerDown: (e: React.PointerEvent) => void;
  handlePointerUp: (e: React.PointerEvent) => void;
  handleClick: (e: React.MouseEvent) => void;
  handleDoubleClick: (e: React.MouseEvent) => void;

  // 클로즈
  closeModal: () => void;
}

export const useMediaModalController = (modal: UseMediaModalReturn): UseMediaModalControllerReturn => {
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

  const {
    mediaViewMode: viewMode,
    setMediaViewMode: setViewMode,
    mediaReadDirection: readDirection,
    setMediaReadDirection: setReadDirection,
    mediaDualAlignment: dualAlignment,
    setMediaDualAlignment: setDualAlignment
  } = useSettingsStore();

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

  // viewMode에 따른 네비게이션 핸들러
  const handleNext = useCallback(() => {
    if (currentMediaIndex == null) return;
    if (viewMode === 2) {
      const currentLeftIndex = Math.floor(currentMediaIndex / 2) * 2;
      const nextLeftIndex = currentLeftIndex + 2;
      if (nextLeftIndex < mediaCount) {
        showMediaAt(nextLeftIndex);
      }
    } else {
      const next = currentMediaIndex + 1;
      if (next < mediaCount) showMediaAt(next);
    }
  }, [currentMediaIndex, viewMode, mediaCount, showMediaAt]);

  const handlePrev = useCallback(() => {
    if (currentMediaIndex == null) return;
    if (viewMode === 2) {
      const currentLeftIndex = Math.floor(currentMediaIndex / 2) * 2;
      const prevLeftIndex = currentLeftIndex - 2;
      if (prevLeftIndex >= 0) {
        showMediaAt(prevLeftIndex);
      }
    } else {
      const prev = currentMediaIndex - 1;
      if (prev >= 0) showMediaAt(prev);
    }
  }, [currentMediaIndex, viewMode, showMediaAt]);

  const handleFirst = useCallback(() => {
    showMediaAt(0);
  }, [showMediaAt]);

  const handleLast = useCallback(() => {
    showMediaAt(mediaList.length - 1);
  }, [showMediaAt, mediaList.length]);

  // 다운로드 핸들러
  const handleDownloadCurrent = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!modalMedia) return;
    const filename = getFilenameFromUrl(modalMedia.src, currentMediaIndex ?? 0, modalMedia.type);
    await downloadSingleMedia(modalMedia.src, filename);
  }, [modalMedia, currentMediaIndex]);

  const handleDownloadAll = useCallback(async (e: React.MouseEvent) => {
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
  }, [isDownloading, mediaCount, mediaList]);

  // 설정 토글 핸들러
  const toggleViewMode = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setViewMode(viewMode === 1 ? 2 : 1);
  }, [viewMode, setViewMode]);

  const toggleReadDirection = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setReadDirection(readDirection === 'ltr' ? 'rtl' : 'ltr');
  }, [readDirection, setReadDirection]);

  const toggleDualAlignment = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDualAlignment(dualAlignment === 'spread' ? 'center' : 'spread');
  }, [dualAlignment, setDualAlignment]);

  // 제스처 핸들러
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as any)._startX = e.clientX;
    (e.currentTarget as any)._startY = e.clientY;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const startX = (e.currentTarget as any)._startX;
    const startY = (e.currentTarget as any)._startY;
    if (typeof startX !== 'number' || typeof startY !== 'number') return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const minSwipeDistance = 30;
    const isRtl = readDirection === 'rtl';

    if (absDx > minSwipeDistance && absDx > absDy) {
      if (isRtl) {
        if (dx > 0) handleNext(); else handlePrev();
      } else {
        if (dx > 0) handlePrev(); else handleNext();
      }
    } else if (absDy > minSwipeDistance && absDy > absDx) {
      if (dy > 0) handlePrev(); else handleNext();
    }
  }, [readDirection, handleNext, handlePrev]);

  const handleClick = useCallback((e: React.MouseEvent) => {
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

      if (readDirection === 'rtl') {
        if (isLeft) nextMedia(); else prevMedia();
      } else {
        if (isLeft) prevMedia(); else nextMedia();
      }
    } catch (err) {
      // ignore
    }
  }, [mediaList, readDirection, nextMedia, prevMedia, clickStateRef, clickTimeoutRef, currentMediaIndexRef, CLICK_STATE_WINDOW]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
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
  }, [mediaList, closeModal, clickStateRef, clickTimeoutRef]);

  // 모달이 열릴 때 body 스크롤 막기
  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [modalOpen]);

  return {
    modal,
    modalOpen,
    modalMedia,
    currentMediaIndex,
    mediaList,
    mediaCount,

    isDownloading,
    downloadProgress,

    viewMode,
    readDirection,
    dualAlignment,

    canGoPrev,
    canGoNext,

    leftIndex,
    rightIndex,

    handleNext,
    handlePrev,
    handleFirst,
    handleLast,

    handleDownloadCurrent,
    handleDownloadAll,

    toggleViewMode,
    toggleReadDirection,
    toggleDualAlignment,

    handlePointerDown,
    handlePointerUp,
    handleClick,
    handleDoubleClick,

    closeModal,
  };
};
