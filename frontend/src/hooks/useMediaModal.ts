'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { RSSItem } from '../types/rss';
import { useMediaModalStore } from '../stores/mediaModalStore';

export interface MediaItem {
  src: string;
  type: 'image' | 'video';
  itemId: number;
}

export interface UseMediaModalOptions {
  items: RSSItem[];
}

export interface UseMediaModalReturn {
  // State
  modalOpen: boolean;
  modalMedia: { type: 'image' | 'video'; src: string; itemId?: number } | null;
  currentMediaIndex: number | null;
  mediaList: MediaItem[];

  // Actions
  openMedia: (src: string, type: 'image' | 'video', itemId?: number) => void;
  closeModal: () => void;
  showMediaAt: (idx: number) => void;
  nextMedia: () => void;
  prevMedia: () => void;

  // Click handling for double-click close at boundaries
  clickStateRef: React.MutableRefObject<{ startIndex: number | null; isLeft: boolean; time: number } | null>;
  clickTimeoutRef: React.MutableRefObject<number | null>;
  currentMediaIndexRef: React.MutableRefObject<number | null>;
  mediaListRef: React.MutableRefObject<MediaItem[]>;
  CLICK_STATE_WINDOW: number;
}

export function useMediaModal({ items }: UseMediaModalOptions): UseMediaModalReturn {
  const [modalOpen, setModalOpenLocal] = useState(false);
  const [modalMedia, setModalMedia] = useState<{ type: 'image' | 'video'; src: string; itemId?: number } | null>(null);
  const mediaListRef = useRef<MediaItem[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState<number | null>(null);

  // Global state for hiding header/tabs when modal is open
  const { setMediaModalOpen } = useMediaModalStore();

  // Sync local state with global store
  const setModalOpen = useCallback((open: boolean) => {
    setModalOpenLocal(open);
    setMediaModalOpen(open);
  }, [setMediaModalOpen]);

  // Keep a ref in sync with currentMediaIndex so click handlers always read the latest value
  const currentMediaIndexRef = useRef<number | null>(null);
  useEffect(() => { currentMediaIndexRef.current = currentMediaIndex; }, [currentMediaIndex]);

  // Click state for double-click handling
  const clickTimeoutRef = useRef<number | null>(null);
  const CLICK_STATE_WINDOW = 400;
  const clickStateRef = useRef<{ startIndex: number | null; isLeft: boolean; time: number } | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        window.clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      clickStateRef.current = null;
    };
  }, []);

  const collectMediaForItem = useCallback((itemId: number): MediaItem[] => {
    const list: MediaItem[] = [];
    const imgRe = /<img[^>]+src=(?:"|')([^"']+)(?:"|')/gi;
    const vidRe = /<video[^>]+src=(?:"|')([^"']+)(?:"|')/gi;

    const normalize = (raw: string, baseUrl?: string) => {
      if (!raw) return raw;
      if (raw.startsWith('//')) return window.location.protocol + raw;
      if (raw.startsWith('/')) {
        try { const origin = baseUrl ? new URL(baseUrl).origin : window.location.origin; return origin + raw; } catch (e) { return raw; }
      }
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) && baseUrl) {
        try { return new URL(raw, baseUrl).toString(); } catch (e) { return raw; }
      }
      return raw;
    };

    const it = items.find(i => i.id === itemId);
    if (!it) return list;

    let m: RegExpExecArray | null;
    while ((m = imgRe.exec(it.description))) {
      if (m[1]) list.push({ src: normalize(m[1], it.link), type: 'image', itemId: it.id });
    }
    while ((m = vidRe.exec(it.description))) {
      if (m[1]) list.push({ src: normalize(m[1], it.link), type: 'video', itemId: it.id });
    }

    return list;
  }, [items]);

  const openMedia = useCallback((src: string, type: 'image' | 'video' = 'image', itemId?: number) => {
    const clickedItem = items.find(it => it.id === itemId);
    let list: MediaItem[] = [];
    if (itemId !== undefined && clickedItem) {
      list = collectMediaForItem(itemId);
    }
    if (list.length === 0) list = [{ src, type, itemId: itemId ?? -1 }];

    mediaListRef.current = list;
    const idx = list.findIndex(it => it.src === src && it.type === type && (itemId == null || it.itemId === itemId));
    setCurrentMediaIndex(idx >= 0 ? idx : 0);
    setModalMedia({ type, src, itemId });
    setModalOpen(true);
  }, [collectMediaForItem, items]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setModalMedia(null);
    setCurrentMediaIndex(null);
  }, []);

  const showMediaAt = useCallback((idx: number) => {
    const list = mediaListRef.current;
    if (!list || idx < 0 || idx >= list.length) return;
    const m = list[idx];
    setCurrentMediaIndex(idx);
    setModalMedia({ src: m.src, type: m.type, itemId: m.itemId });
  }, []);

  const nextMedia = useCallback(() => {
    const list = mediaListRef.current;
    if (!list || list.length <= 1 || currentMediaIndex == null) return;
    const next = currentMediaIndex + 1;
    if (next >= list.length) return; // do not wrap
    showMediaAt(next);
  }, [currentMediaIndex, showMediaAt]);

  const prevMedia = useCallback(() => {
    const list = mediaListRef.current;
    if (!list || list.length <= 1 || currentMediaIndex == null) return;
    const prev = currentMediaIndex - 1;
    if (prev < 0) return; // do not wrap
    showMediaAt(prev);
  }, [currentMediaIndex, showMediaAt]);

  // Keyboard navigation when modal is open
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
      else if (e.key === 'ArrowLeft') prevMedia();
      else if (e.key === 'ArrowRight') nextMedia();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, prevMedia, nextMedia, closeModal]);

  return {
    modalOpen,
    modalMedia,
    currentMediaIndex,
    mediaList: mediaListRef.current,
    openMedia,
    closeModal,
    showMediaAt,
    nextMedia,
    prevMedia,
    clickStateRef,
    clickTimeoutRef,
    currentMediaIndexRef,
    mediaListRef,
    CLICK_STATE_WINDOW,
  };
}
