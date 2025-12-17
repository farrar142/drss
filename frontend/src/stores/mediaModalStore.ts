'use client';

import { create } from 'zustand';

interface MediaModalStore {
  isMediaModalOpen: boolean;
  setMediaModalOpen: (open: boolean) => void;
}

export const useMediaModalStore = create<MediaModalStore>((set) => ({
  isMediaModalOpen: false,
  setMediaModalOpen: (open: boolean) => set({ isMediaModalOpen: open }),
}));
