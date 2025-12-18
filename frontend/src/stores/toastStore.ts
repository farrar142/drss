import { create } from 'zustand';
import { Toast, ToastType } from '@/ui/toast';
import { ConfirmOptions } from '@/ui/confirm-dialog';

interface ToastStore {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;

  // Shorthand methods
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

interface ConfirmStore {
  isOpen: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;

  confirm: (options: ConfirmOptions) => Promise<boolean>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

// Toast Store
export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (type, message, duration = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast: Toast = { id, type, message, duration };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  success: (message, duration) => get().addToast('success', message, duration),
  error: (message, duration) => get().addToast('error', message, duration),
  warning: (message, duration) => get().addToast('warning', message, duration),
  info: (message, duration) => get().addToast('info', message, duration),
}));

// Confirm Store
export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  isOpen: false,
  options: null,
  resolve: null,

  confirm: (options) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        options,
        resolve,
      });
    });
  },

  handleConfirm: () => {
    const { resolve } = get();
    if (resolve) resolve(true);
    set({ isOpen: false, options: null, resolve: null });
  },

  handleCancel: () => {
    const { resolve } = get();
    if (resolve) resolve(false);
    set({ isOpen: false, options: null, resolve: null });
  },
}));

// Hook for easy usage
export function useToast() {
  const { success, error, warning, info } = useToastStore();
  return { success, error, warning, info };
}

export function useConfirm() {
  const { confirm } = useConfirmStore();
  return confirm;
}
