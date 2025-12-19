'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Rss,
  Globe,
  FileText,
  Check,
  AlertCircle,
  Loader2,
  Copy,
} from 'lucide-react';
import { Label } from '@/ui/label';
import { Input } from '@/ui/input';
import { Button } from '@/ui/button';
import { Switch } from '@/ui/switch';
import { useTranslation } from '@/stores/languageStore';
import { useTabStore, FeedEditContext } from '@/stores/tabStore';
import { useRSSStore } from '@/stores/rssStore';
import { useToast, useConfirm } from '@/stores/toastStore';
import {
  FeedSchema,
  SourceSchema,
  createFeed,
  updateFeed,
  listFeeds,
  deleteFeedSource,
  refreshRssEverythingSource,
} from '@/services/api';

interface FeedEditPageProps {
  context?: FeedEditContext;
}

const SOURCE_TYPE_INFO: Record<string, { icon: React.ReactNode; label: string }> = {
  rss: {
    icon: <Rss className="w-4 h-4" />,
    label: 'RSS/Atom',
  },
  page_scraping: {
    icon: <Globe className="w-4 h-4" />,
    label: 'Page Scraping',
  },
  detail_page_scraping: {
    icon: <FileText className="w-4 h-4" />,
    label: 'Detail Page Scraping',
  },
};

export const FeedEditPage: React.FC<FeedEditPageProps> = ({ context }) => {
  const { t } = useTranslation();
  const { openTab, updateTab, panels, activePanelId } = useTabStore();
  const { categories, feeds: storeFeeds, addFeed, updateFeed: updateFeedInStore } = useRSSStore();
  const toast = useToast();
  const confirm = useConfirm();

  // 피드 정보
  const [feed, setFeed] = useState<FeedSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 폼 필드
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [visible, setVisible] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [categoryId, setCategoryId] = useState<number | undefined>(context?.categoryId);

  // 피드 데이터 로드 (스토어에서 먼저 찾고, 없으면 API 호출)
  const loadFeed = useCallback(async () => {
    if (context?.mode === 'edit' && context.feedId) {
      setLoading(true);
      setError(null);
      try {
        // 먼저 스토어에서 피드를 찾음
        let foundFeed = storeFeeds.find(f => f.id === context.feedId);

        // 스토어에 없으면 API 호출
        if (!foundFeed) {
          const feeds = await listFeeds();
          foundFeed = feeds.find(f => f.id === context.feedId);
        }

        if (foundFeed) {
          setFeed(foundFeed);
          setTitle(foundFeed.title);
          setDescription(foundFeed.description || '');
          setFaviconUrl(foundFeed.favicon_url || '');
          setVisible(foundFeed.visible);
          setRefreshInterval(foundFeed.refresh_interval || 60);
          setCategoryId(foundFeed.category_id);
        } else {
          setError('피드를 찾을 수 없습니다.');
        }
      } catch (err) {
        console.error('Failed to load feed:', err);
        setError('피드 로드에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
  }, [context, storeFeeds]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // 피드 저장
  const handleSave = async () => {
    if (!title.trim()) {
      toast.warning(t.rssEverything.feedNameRequired);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (context?.mode === 'edit' && context.feedId) {
        // 피드 수정
        const updatedFeed = await updateFeed(context.feedId, {
          title,
          description,
          favicon_url: faviconUrl || undefined,
          visible,
          refresh_interval: refreshInterval,
          category_id: categoryId,
        });
        setFeed(updatedFeed);
        updateFeedInStore(updatedFeed);

        // 탭 제목 업데이트
        const activePanel = panels.find(p => p.id === activePanelId);
        const activeTab = activePanel?.tabs.find(tab => tab.id === activePanel?.activeTabId);
        if (activeTab) {
          updateTab(activeTab.id, { title: `${updatedFeed.title} - ${t.common.edit}` });
        }

        toast.success('피드가 업데이트되었습니다.');
      } else if (context?.mode === 'create' && categoryId) {
        // 피드 생성 - 소스 없이 피드만 생성
        const newFeed = await createFeed({
          category_id: categoryId,
          title,
          description,
          visible,
          refresh_interval: refreshInterval,
        });

        addFeed(newFeed);
        setFeed(newFeed);

        // context를 edit 모드로 전환
        const activePanel = panels.find(p => p.id === activePanelId);
        const activeTab = activePanel?.tabs.find(tab => tab.id === activePanel?.activeTabId);
        if (activeTab) {
          updateTab(activeTab.id, {
            title: `${newFeed.title} - ${t.common.edit}`,
            resourceId: newFeed.id,
            feedEditContext: {
              mode: 'edit',
              feedId: newFeed.id,
            },
          });
        }

        toast.success(t.rssEverything.createSuccess);
      }
    } catch (err) {
      console.error('Failed to save feed:', err);
      setError('피드 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 소스 추가 버튼
  const handleAddSource = () => {
    if (!feed) {
      toast.warning('먼저 피드를 저장하세요.');
      return;
    }

    openTab({
      type: 'rss-everything',
      title: `${t.rssEverything.title} - ${feed.title}`,
      path: '/rss-everything',
      resourceId: feed.id,
      context: {
        mode: 'create',
        feedId: feed.id,
      },
    });
  };

  // 소스 수정 버튼
  const handleEditSource = (source: SourceSchema) => {
    if (!feed) return;

    openTab({
      type: 'rss-everything',
      title: `${source.url.substring(0, 30)}... - ${t.common.edit}`,
      path: '/rss-everything',
      resourceId: source.id,
      context: {
        mode: 'edit',
        feedId: feed.id,
        sourceId: source.id,
      },
    });
  };

  // 소스 삭제 버튼
  const handleDeleteSource = async (source: SourceSchema) => {
    if (!feed) return;
    const confirmed = await confirm({
      title: '소스 삭제',
      description: `이 소스를 삭제하시겠습니까?\n${source.url}`,
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await deleteFeedSource(feed.id, source.id);
      // 피드 데이터 다시 로드
      await loadFeed();
    } catch (err) {
      console.error('Failed to delete source:', err);
      toast.error('소스 삭제에 실패했습니다.');
    }
  };

  // 소스 새로고침 버튼
  const handleRefreshSource = async (source: SourceSchema) => {
    try {
      await refreshRssEverythingSource(source.id);
      toast.success('소스 새로고침이 예약되었습니다.');
    } catch (err) {
      console.error('Failed to refresh source:', err);
      toast.error('소스 새로고침에 실패했습니다.');
    }
  };

  // 소스 JSON 복사 함수
  const handleCopySource = async (source: SourceSchema) => {
    const sourceConfig = {
      source_type: source.source_type,
      url: source.url,
      item_selector: source.item_selector,
      title_selector: source.title_selector,
      link_selector: source.link_selector,
      description_selector: source.description_selector,
      date_selector: source.date_selector,
      image_selector: source.image_selector,
      detail_title_selector: source.detail_title_selector,
      detail_description_selector: source.detail_description_selector,
      detail_content_selector: source.detail_content_selector,
      detail_date_selector: source.detail_date_selector,
      detail_image_selector: source.detail_image_selector,
      exclude_selectors: source.exclude_selectors,
      date_formats: source.date_formats,
      date_locale: source.date_locale,
      use_browser: source.use_browser,
      wait_selector: source.wait_selector,
      timeout: source.timeout,
      custom_headers: source.custom_headers,
    };

    try {
      // Clipboard API 사용 가능 여부 확인
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(JSON.stringify(sourceConfig, null, 2));
        toast.success('소스 설정이 클립보드에 복사되었습니다.');
      } else {
        // Fallback: 텍스트 선택 방식
        const textArea = document.createElement('textarea');
        textArea.value = JSON.stringify(sourceConfig, null, 2);
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          document.execCommand('copy');
          toast.success('소스 설정이 클립보드에 복사되었습니다.');
        } catch (fallbackErr) {
          console.error('Fallback copy failed:', fallbackErr);
          toast.error('복사에 실패했습니다. 브라우저가 클립보드 접근을 지원하지 않습니다.');
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('복사에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isEditMode = context?.mode === 'edit' && feed !== null;
  const sources = feed?.sources || [];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* 헤더 */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">
          {isEditMode ? `${feed?.title} - ${t.common.edit}` : t.feed.add}
        </h1>
        <p className="text-muted-foreground">
          {isEditMode
            ? '피드 정보를 수정하고 소스를 관리하세요.'
            : '새 피드를 생성하세요. 저장 후 소스를 추가할 수 있습니다.'}
        </p>
      </div>

      {/* 오류 메시지 */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* 피드 정보 폼 */}
      <div className="space-y-6 p-6 border rounded-lg bg-card">
        <h2 className="text-lg font-semibold">{t.rssEverything.feedInfo}</h2>

        <div className="grid gap-4">
          {/* 카테고리 선택 */}
          <div className="space-y-2">
            <Label>{t.rssEverything.selectCategory}</Label>
            <select
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="w-full h-10 px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isEditMode}
            >
              <option value="">-- {t.rssEverything.selectCategory} --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* 피드 이름 */}
          <div className="space-y-2">
            <Label>{t.rssEverything.feedName}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.rssEverything.feedNamePlaceholder}
            />
          </div>

          {/* 설명 */}
          <div className="space-y-2">
            <Label>{t.rssEverything.descriptionLabel}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.rssEverything.descriptionPlaceholder}
            />
          </div>

          {/* Favicon URL */}
          <div className="space-y-2">
            <Label>Favicon URL</Label>
            <div className="flex items-center gap-2">
              {faviconUrl && (
                <img
                  src={faviconUrl}
                  alt="favicon"
                  className="w-6 h-6 rounded-sm object-cover"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
              <Input
                value={faviconUrl}
                onChange={(e) => setFaviconUrl(e.target.value)}
                placeholder="https://example.com/favicon.ico"
                className="flex-1"
              />
            </div>
          </div>

          {/* 새로고침 간격 */}
          <div className="space-y-2">
            <Label>{t.rssEverything.refreshInterval}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="w-24"
                min={1}
              />
              <span className="text-muted-foreground">{t.rssEverything.refreshIntervalUnit}</span>
            </div>
          </div>

          {/* 공개 여부 */}
          <div className="flex items-center gap-3">
            <Switch
              checked={visible}
              onCheckedChange={setVisible}
              id="visible"
            />
            <Label htmlFor="visible">{t.feed.visible}</Label>
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || !title.trim() || (!isEditMode && !categoryId)}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saving ? t.rssEverything.saving : t.common.save}
          </Button>
        </div>
      </div>

      {/* 소스 목록 (수정 모드에서만) */}
      {isEditMode && (
        <div className="space-y-4 p-6 border rounded-lg bg-card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">소스 목록</h2>
            <Button onClick={handleAddSource} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              소스 추가
            </Button>
          </div>

          {sources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>등록된 소스가 없습니다.</p>
              <p className="text-sm mt-1">위의 &quot;소스 추가&quot; 버튼을 클릭하여 소스를 추가하세요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  {/* 소스 타입 아이콘 */}
                  <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
                    {SOURCE_TYPE_INFO[source.source_type]?.icon || <Rss className="w-4 h-4" />}
                  </div>

                  {/* 소스 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {SOURCE_TYPE_INFO[source.source_type]?.label || source.source_type}
                      </span>
                      {source.is_active ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {source.url}
                    </p>
                    {source.last_crawled_at && (
                      <p className="text-xs text-muted-foreground">
                        마지막 크롤링: {new Date(source.last_crawled_at).toLocaleString()}
                      </p>
                    )}
                    {source.last_error && (
                      <p className="text-xs text-destructive truncate">
                        {source.last_error}
                      </p>
                    )}
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopySource(source)}
                      title="설정 복사"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRefreshSource(source)}
                      title="새로고침"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditSource(source)}
                      title="수정"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteSource(source)}
                      title="삭제"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FeedEditPage;
