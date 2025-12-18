'use client';

import React from 'react';
import { ToastContainer } from '@/ui/toast';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { useToastStore, useConfirmStore } from '@/stores/toastStore';

export function ToastProvider() {
  const { toasts, removeToast } = useToastStore();
  
  return <ToastContainer toasts={toasts} onDismiss={removeToast} />;
}

export function ConfirmProvider() {
  const { isOpen, options, handleConfirm, handleCancel } = useConfirmStore();
  
  return (
    <ConfirmDialog
      open={isOpen}
      options={options}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastProvider />
      <ConfirmProvider />
    </>
  );
}
