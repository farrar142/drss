'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { Button } from '@/ui/button';
import { AlertTriangle, HelpCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/stores/languageStore';

export type ConfirmType = 'danger' | 'warning' | 'info' | 'destructive';

export interface ConfirmOptions {
  title: string;
  description?: string;
  message?: string;
  type?: ConfirmType;
  variant?: 'default' | 'destructive';
  confirmText?: string;
  cancelText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmDialogProps {
  open: boolean;
  options: ConfirmOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const confirmIcons: Record<ConfirmType, React.ReactNode> = {
  danger: <AlertTriangle className="h-6 w-6 text-red-500" />,
  destructive: <AlertTriangle className="h-6 w-6 text-red-500" />,
  warning: <AlertTriangle className="h-6 w-6 text-yellow-500" />,
  info: <HelpCircle className="h-6 w-6 text-blue-500" />,
};

const confirmButtonStyles: Record<ConfirmType, string> = {
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  destructive: 'bg-red-600 hover:bg-red-700 text-white',
  warning: 'bg-yellow-500 hover:bg-yellow-600 text-black',
  info: 'bg-blue-600 hover:bg-blue-700 text-white',
};

export function ConfirmDialog({ open, options, onConfirm, onCancel }: ConfirmDialogProps) {
  const { t } = useTranslation();
  
  if (!options) return null;

  // variant='destructive' -> type='destructive' 매핑
  const type = options.variant === 'destructive' ? 'destructive' : (options.type || 'info');
  const message = options.description || options.message || '';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {confirmIcons[type]}
            <DialogTitle>{options.title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2 whitespace-pre-wrap">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            {options.cancelLabel || options.cancelText || t.common.cancel}
          </Button>
          <Button
            className={cn(confirmButtonStyles[type])}
            onClick={onConfirm}
          >
            {options.confirmLabel || options.confirmText || t.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
