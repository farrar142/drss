'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/stores/languageStore';

interface FloatingAppBarToggleProps {
  isAppBarHidden: boolean;
  onToggle: () => void;
}

interface Position {
  x: number;
  y: number;
}

const BUTTON_SIZE = 44; // 크루즈 버튼과 동일 (p-3 + w-5 = 44px)
const EDGE_MARGIN = 16;
const STORAGE_KEY = 'floating-button-position';
// 크루즈 버튼과 정렬을 위한 기본값
const DEFAULT_RIGHT = 16; // 오른쪽 여백
const DEFAULT_BOTTOM = 160; // 크루즈 버튼 위

export function FloatingAppBarToggle({ isAppBarHidden, onToggle }: FloatingAppBarToggleProps) {
  const { t } = useTranslation();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const positionRef = useRef<Position>({ x: 0, y: 0 });
  const dragStartPos = useRef<Position>({ x: 0, y: 0 });
  const dragStartTime = useRef<number>(0);
  const initialButtonPos = useRef<Position>({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  // DOM 직접 업데이트 (React state 없이)
  const updateButtonPosition = useCallback((x: number, y: number, animate = false) => {
    if (!buttonRef.current) return;

    if (animate) {
      buttonRef.current.style.transition = 'left 0.2s ease-out, top 0.2s ease-out';
    } else {
      buttonRef.current.style.transition = 'none';
    }

    buttonRef.current.style.left = `${x}px`;
    buttonRef.current.style.top = `${y}px`;
    positionRef.current = { x, y };
  }, []);

  // 화면 경계 내로 위치 제한
  const clampPosition = useCallback((pos: Position): Position => {
    const maxX = window.innerWidth - BUTTON_SIZE - EDGE_MARGIN;
    const maxY = window.innerHeight - BUTTON_SIZE - EDGE_MARGIN;

    return {
      x: Math.max(EDGE_MARGIN, Math.min(pos.x, maxX)),
      y: Math.max(EDGE_MARGIN, Math.min(pos.y, maxY)),
    };
  }, []);

  // 가장 가까운 가장자리로 스냅
  const snapToEdge = useCallback((pos: Position): Position => {
    const centerX = pos.x + BUTTON_SIZE / 2;
    const screenCenterX = window.innerWidth / 2;

    const snappedX = centerX < screenCenterX
      ? EDGE_MARGIN
      : window.innerWidth - BUTTON_SIZE - EDGE_MARGIN;

    return clampPosition({ x: snappedX, y: pos.y });
  }, [clampPosition]);

  // 위치 저장
  const savePosition = useCallback((pos: Position) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  }, []);

  // 초기 위치 로드
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    let initialPos: Position;

    if (saved) {
      try {
        initialPos = JSON.parse(saved);
      } catch {
        // 기본 위치: 우측, 크루즈 버튼 위
        initialPos = {
          x: window.innerWidth - BUTTON_SIZE - DEFAULT_RIGHT,
          y: window.innerHeight - BUTTON_SIZE - DEFAULT_BOTTOM,
        };
      }
    } else {
      // 기본 위치: 우측, 크루즈 버튼 위
      initialPos = {
        x: window.innerWidth - BUTTON_SIZE - DEFAULT_RIGHT,
        y: window.innerHeight - BUTTON_SIZE - DEFAULT_BOTTOM,
      };
    }

    const clampedPos = clampPosition(initialPos);
    updateButtonPosition(clampedPos.x, clampedPos.y);
  }, [clampPosition, updateButtonPosition]);

  // 터치 이벤트 핸들러
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault(); // 클릭 이벤트 방지
    e.stopPropagation();

    const touch = e.touches[0];
    dragStartPos.current = { x: touch.clientX, y: touch.clientY };
    initialButtonPos.current = { ...positionRef.current };
    dragStartTime.current = Date.now();
    hasMoved.current = false;

    // 드래그 시작 시 스케일 업
    if (buttonRef.current) {
      buttonRef.current.style.transform = 'scale(1.1)';
      buttonRef.current.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.2)';
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    const deltaX = touch.clientX - dragStartPos.current.x;
    const deltaY = touch.clientY - dragStartPos.current.y;

    // 5px 이상 이동하면 드래그로 인식
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      hasMoved.current = true;
    }

    if (hasMoved.current) {
      // 드래그 중에는 제한 없이 자유롭게 이동 (경계는 놓을 때만 적용)
      const newX = initialButtonPos.current.x + deltaX;
      const newY = initialButtonPos.current.y + deltaY;
      updateButtonPosition(newX, newY, false);
    }
  }, [updateButtonPosition]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const dragDuration = Date.now() - dragStartTime.current;

    // 스케일 복원
    if (buttonRef.current) {
      buttonRef.current.style.transform = 'scale(1)';
      buttonRef.current.style.boxShadow = '';
    }

    if (hasMoved.current) {
      // 드래그 종료 시 가장자리로 스냅 (애니메이션 적용)
      const snappedPos = snapToEdge(positionRef.current);
      updateButtonPosition(snappedPos.x, snappedPos.y, true);
      savePosition(snappedPos);
    } else if (dragDuration < 300) {
      // 짧은 탭이면 토글
      onToggle();
    }
  }, [snapToEdge, savePosition, onToggle, updateButtonPosition]);

  // 마우스 이벤트 (데스크톱 테스트용)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialButtonPos.current = { ...positionRef.current };
    dragStartTime.current = Date.now();
    hasMoved.current = false;

    // 드래그 시작 시 스케일 업
    if (buttonRef.current) {
      buttonRef.current.style.transform = 'scale(1.1)';
      buttonRef.current.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.2)';
    }

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartPos.current.x;
      const deltaY = e.clientY - dragStartPos.current.y;

      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasMoved.current = true;
        const newX = initialButtonPos.current.x + deltaX;
        const newY = initialButtonPos.current.y + deltaY;
        updateButtonPosition(newX, newY, false);
      }
    };

    const handleMouseUp = () => {
      const dragDuration = Date.now() - dragStartTime.current;

      // 스케일 복원
      if (buttonRef.current) {
        buttonRef.current.style.transform = 'scale(1)';
        buttonRef.current.style.boxShadow = '';
      }

      if (hasMoved.current) {
        const snappedPos = snapToEdge(positionRef.current);
        updateButtonPosition(snappedPos.x, snappedPos.y, true);
        savePosition(snappedPos);
      } else if (dragDuration < 300) {
        onToggle();
      }

      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [snapToEdge, savePosition, onToggle, updateButtonPosition]);

  // 화면 크기 변경 시 위치 재조정
  useEffect(() => {
    const handleResize = () => {
      const clampedPos = clampPosition(positionRef.current);
      updateButtonPosition(clampedPos.x, clampedPos.y, true);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition, updateButtonPosition]);

  return (
    <button
      ref={buttonRef}
      className={cn(
        "fixed z-[100] flex items-center justify-center rounded-full shadow-lg",
        "bg-primary text-primary-foreground",
        "hover:bg-primary/90 active:scale-95",
        "cursor-grab active:cursor-grabbing"
      )}
      style={{
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        touchAction: 'none',
        willChange: 'left, top, transform',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      aria-label={isAppBarHidden ? t.ui.showAppBar : t.ui.hideAppBar}
    >
      {isAppBarHidden ? (
        <Menu className="h-5 w-5 pointer-events-none" />
      ) : (
        <X className="h-5 w-5 pointer-events-none" />
      )}
    </button>
  );
}
