'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { feedsRoutersFeedValidateFeed } from '../services/api';

interface FeedPayload {
  url: string;
  title?: string;
  description?: string;
  visible?: boolean;
  custom_headers?: Record<string, unknown>;
  refresh_interval?: number;
  favicon_url?: string;
}

interface FeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<FeedPayload>;
  title?: string;
  submitLabel?: string;
  onSubmit: (payload: FeedPayload) => Promise<any>;
}

export const FeedDialog: React.FC<FeedDialogProps> = ({
  open,
  onOpenChange,
  initial = {},
  title = '피드',
  submitLabel = '저장',
  onSubmit,
}) => {
  const [url, setUrl] = useState(initial.url ?? '');
  const [feedTitle, setFeedTitle] = useState(initial.title ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [faviconUrl, setFaviconUrl] = useState((initial as any).favicon_url ?? '');
  const [visible, setVisible] = useState(initial.visible ?? true);
  const [customHeaders, setCustomHeaders] = useState(initial.custom_headers ? JSON.stringify(initial.custom_headers, null, 2) : '');
  const [refreshInterval, setRefreshInterval] = useState(initial.refresh_interval ?? 5);

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ title: string; description: string; items_count: number; latest_item_date?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setUrl(initial.url ?? '');
      setFeedTitle(initial.title ?? '');
      setDescription(initial.description ?? '');
      setFaviconUrl((initial as any).favicon_url ?? '');
      setVisible(initial.visible ?? true);
      setCustomHeaders(initial.custom_headers ? JSON.stringify(initial.custom_headers, null, 2) : '');
      setRefreshInterval(initial.refresh_interval ?? 5);
      setValidationResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleValidate = async () => {
    if (!url.trim()) {
      alert('URL을 입력하세요.');
      return;
    }
    setValidating(true);
    try {
      let parsedHeaders: any | undefined = undefined;
      if (customHeaders.trim()) parsedHeaders = JSON.parse(customHeaders);
      const result = await feedsRoutersFeedValidateFeed({ url, custom_headers: parsedHeaders });
      setValidationResult(result);
      if (!feedTitle && result.title) setFeedTitle(result.title);
      if (!description && result.description) setDescription(result.description);
    } catch (error) {
      console.error(error);
      alert('피드 검증 실패: ' + ((error as any)?.message || '알 수 없는 오류'));
      setValidationResult(null);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    try {
      let parsedHeaders: any | undefined = undefined;
      if (customHeaders.trim()) {
        try { parsedHeaders = JSON.parse(customHeaders); } catch (e) { alert('커스텀 헤더 JSON이 유효하지 않습니다.'); return; }
      }
      setSubmitting(true);
      const payload: FeedPayload = {
        url,
        title: feedTitle,
        favicon_url: faviconUrl || undefined,
        description,
        visible,
        custom_headers: parsedHeaders,
        refresh_interval: refreshInterval,
      };
      await onSubmit(payload);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            피드 정보를 입력하고 검증하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feed-url">URL</Label>
            <div className="flex gap-2">
              <Input id="feed-url" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
              <Button variant="outline" onClick={handleValidate} disabled={validating} className="shrink-0">
                {validating ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" /></svg>
                    검증 중
                  </>
                ) : '검증'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feed-custom-headers">커스텀 헤더 (JSON)</Label>
            <Textarea id="feed-custom-headers" value={customHeaders} onChange={(e) => setCustomHeaders(e.target.value)} placeholder='예: {"Authorization":"Bearer ..."}' />
          </div>

          {validationResult && (
            <div className="p-3 rounded-lg bg-accent/50 border border-border space-y-1">
              <p className="text-sm font-semibold text-foreground">검증 결과</p>
              <p className="text-sm text-muted-foreground">제목: {validationResult.title}</p>
              <p className="text-sm text-muted-foreground">설명: {validationResult.description}</p>
              <p className="text-sm text-muted-foreground">아이템 수: {validationResult.items_count}</p>
              {validationResult.latest_item_date && (
                <p className="text-sm text-muted-foreground">최신 아이템 날짜: {validationResult.latest_item_date}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="feed-title">제목</Label>
            <Input id="feed-title" value={feedTitle} onChange={(e) => setFeedTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feed-description">설명</Label>
            <Input id="feed-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feed-favicon">Favicon URL</Label>
            <Input id="feed-favicon" placeholder="https://example.com/favicon.ico" value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feed-refresh">새로고침 간격 (분)</Label>
            <Input id="feed-refresh" type="number" min={1} value={refreshInterval} onChange={(e) => setRefreshInterval(Number(e.target.value))} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="feed-visible">표시</Label>
              <p className="text-xs text-muted-foreground">
                끄면 메인/카테고리 화면에서 글이 보이지 않습니다
              </p>
            </div>
            <Switch
              id="feed-visible"
              checked={visible}
              onCheckedChange={setVisible}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>취소</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? '저장 중...' : submitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeedDialog;
