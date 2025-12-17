'use client';

import { FC, memo } from 'react';
import { X, SkipBack, SkipForward, ChevronLeft, ChevronRight, Download, Archive, Loader2, Square, Columns2, ArrowLeftRight, AlignCenterHorizontal, Columns } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeedImage } from './FeedImage';
import { FeedVideo } from './FeedVideo';
import { UseMediaModalControllerReturn } from '../hooks/useMediaModalController';

export interface MediaModalViewProps extends UseMediaModalControllerReturn { }

// 싱글 뷰 모드 컴포넌트
const SingleViewContent = memo(function SingleViewContent({
  modalMedia,
}: {
  modalMedia: UseMediaModalControllerReturn['modalMedia'];
}) {
  if (!modalMedia) return null;

  if (modalMedia.type === 'video') {
    return (
      <FeedVideo
        key={modalMedia.src}
        src={modalMedia.src}
        controls
        autoPlay
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <FeedImage
      src={modalMedia.src}
      alt="Enlarged"
      contain
      className="max-h-full"
      onClick={(e) => e.preventDefault()}
    />
  );
});

// 듀얼 뷰 모드 컴포넌트
const DualViewContent = memo(function DualViewContent({
  currentMediaIndex,
  mediaList,
  readDirection,
  dualAlignment,
  handleNext,
  handlePrev,
}: {
  currentMediaIndex: number | null;
  mediaList: UseMediaModalControllerReturn['mediaList'];
  readDirection: UseMediaModalControllerReturn['readDirection'];
  dualAlignment: UseMediaModalControllerReturn['dualAlignment'];
  handleNext: () => void;
  handlePrev: () => void;
}) {
  // 듀얼 뷰에서는 항상 짝수 인덱스(0, 2, 4...)에서 시작하도록 보정
  const baseLeftIndex = currentMediaIndex != null ? Math.floor(currentMediaIndex / 2) * 2 : null;
  const baseRightIndex = baseLeftIndex != null ? baseLeftIndex + 1 : null;

  // readDirection에 따라 좌우 인덱스 결정
  const leftIndex = readDirection === 'ltr' ? baseLeftIndex : baseRightIndex;
  const rightIndex = readDirection === 'ltr' ? baseRightIndex : baseLeftIndex;

  const renderMedia = (index: number | null) => {
    if (index == null || index >= mediaList.length || !mediaList[index]) return null;

    const media = mediaList[index];
    if (media.type === 'video') {
      return (
        <FeedVideo
          key={media.src}
          src={media.src}
          controls
          autoPlay
          className="max-w-full max-h-full object-contain rounded-lg pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        />
      );
    }

    return (
      <FeedImage
        src={media.src}
        alt={`Image ${index + 1}`}
        contain
        className="max-h-full pointer-events-none"
      />
    );
  };

  return (
    <div className={cn(
      "flex items-center h-full w-full",
      dualAlignment === 'center' ? "justify-center gap-2" : "justify-between gap-4"
    )}>
      {/* Left Image */}
      <div
        className={cn(
          "h-full flex items-center cursor-pointer",
          dualAlignment === 'center' ? "justify-end" : "flex-1 justify-center"
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (readDirection === 'rtl') handleNext(); else handlePrev();
        }}
      >
        {renderMedia(leftIndex)}
      </div>

      {/* Divider - only show in spread mode */}
      {dualAlignment === 'spread' && <div className="w-px h-3/4 bg-border" />}

      {/* Right Image */}
      <div
        className={cn(
          "h-full flex items-center cursor-pointer",
          dualAlignment === 'center' ? "justify-start" : "flex-1 justify-center"
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (readDirection === 'rtl') handlePrev(); else handleNext();
        }}
      >
        {rightIndex != null && rightIndex < mediaList.length && mediaList[rightIndex] ? (
          renderMedia(rightIndex)
        ) : (
          <div className="flex items-center justify-center text-muted-foreground">
            <span className="text-sm">마지막 이미지</span>
          </div>
        )}
      </div>
    </div>
  );
});

// 듀얼 뷰 토글 버튼들 컴포넌트
const DualViewToggleButtons = memo(function DualViewToggleButtons({
  dualAlignment,
  readDirection,
  toggleDualAlignment,
  toggleReadDirection,
}: {
  dualAlignment: UseMediaModalControllerReturn['dualAlignment'];
  readDirection: UseMediaModalControllerReturn['readDirection'];
  toggleDualAlignment: (e: React.MouseEvent) => void;
  toggleReadDirection: (e: React.MouseEvent) => void;
}) {
  return (
    <>
      {/* Dual Alignment Toggle Button - Top Left */}
      <button
        onClick={toggleDualAlignment}
        title={dualAlignment === 'spread' ? '중앙에 모아보기' : '좌우로 분리하기'}
        className={cn(
          "absolute top-4 left-4 z-20 p-2 rounded-full backdrop-blur-sm transition-colors",
          dualAlignment === 'center'
            ? "bg-primary/80 hover:bg-primary"
            : "bg-black/60 hover:bg-black/80"
        )}
      >
        {dualAlignment === 'spread' ? (
          <AlignCenterHorizontal className="w-5 h-5 text-white" />
        ) : (
          <Columns className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Reading Direction Toggle Button - Top Right */}
      <button
        onClick={toggleReadDirection}
        title={readDirection === 'ltr' ? '오른쪽→왼쪽으로 보기' : '왼쪽→오른쪽으로 보기'}
        className={cn(
          "absolute top-4 right-4 z-20 p-2 rounded-full backdrop-blur-sm transition-colors",
          readDirection === 'rtl'
            ? "bg-primary/80 hover:bg-primary"
            : "bg-black/60 hover:bg-black/80"
        )}
      >
        <div className="flex items-center gap-1.5 text-white text-xs font-medium px-1">
          {readDirection === 'ltr' ? (
            <>
              <span>L</span>
              <ArrowLeftRight className="w-4 h-4" />
              <span>R</span>
            </>
          ) : (
            <>
              <span>R</span>
              <ArrowLeftRight className="w-4 h-4" />
              <span>L</span>
            </>
          )}
        </div>
      </button>
    </>
  );
});

// 하단 컨트롤 바 컴포넌트
const BottomControlBar = memo(function BottomControlBar({
  mediaList,
  mediaCount,
  modalMedia,
  currentMediaIndex,
  viewMode,
  isDownloading,
  downloadProgress,
  canGoPrev,
  canGoNext,
  handlePrev,
  handleNext,
  handleFirst,
  handleLast,
  handleDownloadCurrent,
  handleDownloadAll,
  toggleViewMode,
  closeModal,
  clickStateRef,
  clickTimeoutRef,
  CLICK_STATE_WINDOW,
}: {
  mediaList: UseMediaModalControllerReturn['mediaList'];
  mediaCount: number;
  modalMedia: UseMediaModalControllerReturn['modalMedia'];
  currentMediaIndex: number | null;
  viewMode: 1 | 2;
  isDownloading: boolean;
  downloadProgress: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  handlePrev: () => void;
  handleNext: () => void;
  handleFirst: () => void;
  handleLast: () => void;
  handleDownloadCurrent: (e: React.MouseEvent) => Promise<void>;
  handleDownloadAll: (e: React.MouseEvent) => Promise<void>;
  toggleViewMode: (e: React.MouseEvent) => void;
  closeModal: () => void;
  clickStateRef: React.MutableRefObject<{ startIndex: number | null; isLeft: boolean; time: number } | null>;
  clickTimeoutRef: React.MutableRefObject<number | null>;
  CLICK_STATE_WINDOW: number;
}) {
  const handleNavWithClickState = (
    e: React.MouseEvent,
    isLeft: boolean,
    action: () => void
  ) => {
    e.stopPropagation();
    const now = Date.now();
    if (!clickStateRef.current || now - clickStateRef.current.time > CLICK_STATE_WINDOW) {
      clickStateRef.current = { startIndex: currentMediaIndex, isLeft, time: now };
    }
    if (clickTimeoutRef.current) window.clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = window.setTimeout(() => {
      clickTimeoutRef.current = null;
      clickStateRef.current = null;
    }, CLICK_STATE_WINDOW) as unknown as number;
    action();
  };

  const handleNavDoubleClick = (e: React.MouseEvent, isLeft: boolean) => {
    e.stopPropagation();
    const s = clickStateRef.current;
    if (clickTimeoutRef.current) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    clickStateRef.current = null;
    if (isLeft && s?.isLeft && s.startIndex === 0) closeModal();
    if (!isLeft && !s?.isLeft && s?.startIndex === mediaList.length - 1) closeModal();
  };

  const getCounterText = () => {
    if (currentMediaIndex == null) return '';
    if (viewMode === 2) {
      const leftIdx = Math.floor(currentMediaIndex / 2) * 2;
      const rightIdx = Math.min(leftIdx + 1, mediaList.length - 1);
      return leftIdx === rightIdx
        ? `${leftIdx + 1} / ${mediaList.length}`
        : `${leftIdx + 1}-${rightIdx + 1} / ${mediaList.length}`;
    }
    return `${currentMediaIndex + 1} / ${mediaList.length}`;
  };

  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex justify-center pb-4 pt-2"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-3 py-2">
        {/* 브라우징 버튼들 */}
        {mediaList.length > 1 && (
          <>

            {/* Download Current */}
            {modalMedia && (
              <button
                onClick={handleDownloadCurrent}
                title={modalMedia.type === 'video' ? '현재 비디오 다운로드' : '현재 이미지 다운로드'}
                className="p-2 rounded-full hover:bg-white/20 transition-colors"
              >
                <Download className="w-5 h-5 text-white" />
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
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <>
                    <Archive className="w-5 h-5 text-white" />
                    <span className="absolute -top-1 -right-1 text-[9px] bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center font-medium">
                      {mediaCount}
                    </span>
                  </>
                )}
              </button>
            )}

            {/* Divider */}
            {mediaList.length > 1 && <div className="w-px h-5 bg-white/20 mx-1" />}
            {/* Previous */}
            <button
              onClick={(e) => handleNavWithClickState(e, true, handlePrev)}
              onDoubleClick={(e) => handleNavDoubleClick(e, true)}
              title="이전"
              aria-label="previous"
              className={cn(
                "p-1 rounded-full hover:bg-white/20 transition-colors",
                !canGoPrev && "opacity-30 pointer-events-none"
              )}
              aria-disabled={!canGoPrev}
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>

            {/* First */}
            <button
              onClick={(e) => handleNavWithClickState(e, true, handleFirst)}
              onDoubleClick={(e) => handleNavDoubleClick(e, true)}
              title="처음으로"
              aria-label="first"
              className={cn(
                "p-1 rounded-full hover:bg-white/20 transition-colors",
                !canGoPrev && "opacity-30 pointer-events-none"
              )}
              aria-disabled={!canGoPrev}
            >
              <SkipBack className="w-5 h-5 text-white" />
            </button>

            {/* Counter */}
            <div className="px-2 py-1 text-sm text-white/90 font-medium min-w-[70px] text-center">
              {getCounterText()}
            </div>

            {/* Last */}
            <button
              onClick={(e) => handleNavWithClickState(e, false, handleLast)}
              onDoubleClick={(e) => handleNavDoubleClick(e, false)}
              title="마지막으로"
              aria-label="last"
              className={cn(
                "p-1 rounded-full hover:bg-white/20 transition-colors",
                !canGoNext && "opacity-30 pointer-events-none"
              )}
              aria-disabled={!canGoNext}
            >
              <SkipForward className="w-5 h-5 text-white" />
            </button>

            {/* Next */}
            <button
              onClick={(e) => handleNavWithClickState(e, false, handleNext)}
              onDoubleClick={(e) => handleNavDoubleClick(e, false)}
              title="다음"
              aria-label="next"
              className={cn(
                "p-1 rounded-full hover:bg-white/20 transition-colors",
                !canGoNext && "opacity-30 pointer-events-none"
              )}
              aria-disabled={!canGoNext}
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </>
        )}

        {/* Divider */}
        {mediaList.length > 1 && <div className="w-px h-5 bg-white/20 mx-1" />}

        {/* 추가 컨트롤들 */}
        {/* View Mode Toggle */}
        {mediaCount > 1 && (
          <button
            onClick={toggleViewMode}
            title={viewMode === 1 ? '2개씩 보기' : '1개씩 보기'}
            className={cn(
              "p-2 rounded-full hover:bg-white/20 transition-colors",
              viewMode === 2 && "bg-white/20"
            )}
          >
            {viewMode === 1 ? (
              <Columns2 className="w-5 h-5 text-white" />
            ) : (
              <Square className="w-5 h-5 text-white" />
            )}
          </button>
        )}
        {/* Close */}
        <button
          onClick={closeModal}
          title="닫기"
          className="p-2 rounded-full hover:bg-white/20 transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
});

export const MediaModalView: FC<MediaModalViewProps> = (props) => {
  const {
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
  } = props;

  if (!modalOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center",
        "bg-black"
      )}
      onClick={closeModal}
    >
      {/* Media Content */}
      <div
        className={cn(
          "w-full h-full flex items-center justify-center",
          "relative touch-none select-none"
        )}
        onDragStart={(e) => e.preventDefault()}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Dual View Toggle Buttons */}
        {viewMode === 2 && (
          <DualViewToggleButtons
            dualAlignment={dualAlignment}
            readDirection={readDirection}
            toggleDualAlignment={toggleDualAlignment}
            toggleReadDirection={toggleReadDirection}
          />
        )}

        {/* Single View Mode */}
        {viewMode === 1 && (
          <SingleViewContent modalMedia={modalMedia} />
        )}

        {/* Dual View Mode */}
        {viewMode === 2 && (
          <DualViewContent
            currentMediaIndex={currentMediaIndex}
            mediaList={mediaList}
            readDirection={readDirection}
            dualAlignment={dualAlignment}
            handleNext={handleNext}
            handlePrev={handlePrev}
          />
        )}

        {/* Bottom Controls Bar */}
        <BottomControlBar
          mediaList={mediaList}
          mediaCount={mediaCount}
          modalMedia={modalMedia}
          currentMediaIndex={currentMediaIndex}
          viewMode={viewMode}
          isDownloading={isDownloading}
          downloadProgress={downloadProgress}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          handlePrev={handlePrev}
          handleNext={handleNext}
          handleFirst={handleFirst}
          handleLast={handleLast}
          handleDownloadCurrent={handleDownloadCurrent}
          handleDownloadAll={handleDownloadAll}
          toggleViewMode={toggleViewMode}
          closeModal={closeModal}
          clickStateRef={modal.clickStateRef}
          clickTimeoutRef={modal.clickTimeoutRef}
          CLICK_STATE_WINDOW={modal.CLICK_STATE_WINDOW}
        />
      </div>
    </div>
  );
};
