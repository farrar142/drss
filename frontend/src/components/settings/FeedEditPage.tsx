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
  Layers,
  X,
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
  crawlPaginated,
} from '@/services/api';

interface PaginationVariable {
  name: string;
  start: number;
  end: number;
  step: number;
}

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

  // 페이지네이션 크롤링 모달 상태
  const [paginationModalOpen, setPaginationModalOpen] = useState(false);
  const [paginationSourceId, setPaginationSourceId] = useState<number | null>(null);
  const [paginationUrlTemplate, setPaginationUrlTemplate] = useState('');
  const [paginationVariables, setPaginationVariables] = useState<PaginationVariable[]>([
    { name: 'page', start: 1, end: 10, step: 1 }
  ]);
  const [paginationDelayMs, setPaginationDelayMs] = useState(1000);
  const [paginationCrawling, setPaginationCrawling] = useState(false);

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
          setError(t.feed.notFound);
        }
      } catch (err) {
        console.error('Failed to load feed:', err);
        setError(t.feed.loadFailed);
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

        toast.success(t.feed.updated);
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
      setError(t.feed.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  // 소스 추가 버튼
  const handleAddSource = () => {
    if (!feed) {
      toast.warning(t.feed.saveFirst);
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
      title: t.feed.sourceDelete,
      description: `${t.feed.sourceDeleteConfirm}\n${source.url}`,
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await deleteFeedSource(feed.id, source.id);
      // 피드 데이터 다시 로드
      await loadFeed();
    } catch (err) {
      console.error('Failed to delete source:', err);
      toast.error(t.feed.sourceDeleteFailed);
    }
  };

  // 소스 새로고침 버튼
  const handleRefreshSource = async (source: SourceSchema) => {
    try {
      await refreshRssEverythingSource(source.id);
      toast.success(t.feed.sourceRefreshScheduled);
    } catch (err) {
      console.error('Failed to refresh source:', err);
      toast.error(t.feed.sourceRefreshFailed);
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
        toast.success(t.sourceList.configCopied);
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
          toast.success(t.sourceList.configCopied);
        } catch (fallbackErr) {
          console.error('Fallback copy failed:', fallbackErr);
          toast.error(t.sourceList.copyFailedNoClipboard);
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error(t.common.copyFailed);
    }
  };

  // 페이지네이션 크롤링 모달 열기
  const handleOpenPaginationModal = (source: SourceSchema) => {
    setPaginationSourceId(source.id);
    setPaginationUrlTemplate(source.url);
    setPaginationVariables([{ name: 'page', start: 1, end: 10, step: 1 }]);
    setPaginationDelayMs(1000);
    setPaginationModalOpen(true);
  };

  // 페이지네이션 변수 추가
  const handleAddVariable = () => {
    setPaginationVariables([
      ...paginationVariables,
      { name: '', start: 1, end: 10, step: 1 }
    ]);
  };

  // 페이지네이션 변수 제거
  const handleRemoveVariable = (index: number) => {
    setPaginationVariables(paginationVariables.filter((_, i) => i !== index));
  };

  // 페이지네이션 변수 업데이트
  const handleUpdateVariable = (index: number, field: keyof PaginationVariable, value: string | number) => {
    const updated = [...paginationVariables];
    if (field === 'name') {
      updated[index] = { ...updated[index], [field]: value as string };
    } else {
      updated[index] = { ...updated[index], [field]: Number(value) };
    }
    setPaginationVariables(updated);
  };

  // 페이지네이션 크롤링 실행
  const handleStartPaginationCrawl = async () => {
    if (!paginationSourceId) return;

    if (paginationVariables.length === 0) {
      toast.warning(t.sourceList.noVariables);
      return;
    }

    const validVariables = paginationVariables.filter(v => v.name.trim());
    if (validVariables.length === 0) {
      toast.warning(t.sourceList.noVariables);
      return;
    }

    setPaginationCrawling(true);
    try {
      const result = await crawlPaginated({
        source_id: paginationSourceId,
        url_template: paginationUrlTemplate,
        variables: validVariables.map(v => ({
          name: v.name,
          start: v.start,
          end: v.end,
          step: v.step,
        })),
        delay_ms: paginationDelayMs,
      });

      if (result.success) {
        toast.success(t.sourceList.crawlScheduled);
      } else {
        toast.error(t.sourceList.crawlFailed + ': ' + (result.message || ''));
      }
      setPaginationModalOpen(false);
    } catch (err) {
      console.error('Pagination crawl failed:', err);
      toast.error(t.sourceList.crawlFailed);
    } finally {
      setPaginationCrawling(false);
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
            ? t.feed.editDescription
            : t.feed.createDescription}
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
            <h2 className="text-lg font-semibold">{t.sourceList.title}</h2>
            <Button onClick={handleAddSource} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              {t.sourceList.addSource}
            </Button>
          </div>

          {sources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>{t.sourceList.noSources}</p>
              <p className="text-sm mt-1">{t.sourceList.noSourcesHint}</p>
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
                        {t.sourceList.lastCrawled}: {new Date(source.last_crawled_at).toLocaleString()}
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
                      title={t.sourceList.copyConfig}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenPaginationModal(source)}
                      title={t.sourceList.paginationCrawl}
                    >
                      <Layers className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRefreshSource(source)}
                      title={t.common.refresh}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditSource(source)}
                      title={t.common.edit}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteSource(source)}
                      title={t.common.delete}
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

      {/* 페이지네이션 크롤링 모달 */}
      {paginationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">{t.sourceList.paginationCrawl}</h3>
                <p className="text-sm text-muted-foreground">{t.sourceList.paginationCrawlDescription}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPaginationModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* 모달 콘텐츠 */}
            <div className="p-4 space-y-4">
              {/* URL 템플릿 */}
              <div className="space-y-2">
                <Label>{t.sourceList.urlTemplate}</Label>
                <Input
                  value={paginationUrlTemplate}
                  onChange={(e) => setPaginationUrlTemplate(e.target.value)}
                  placeholder={t.sourceList.urlTemplatePlaceholder}
                />
                <p className="text-xs text-muted-foreground">{t.sourceList.urlTemplateHint}</p>
              </div>

              {/* 변수 설정 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t.sourceList.variables}</Label>
                  <Button variant="outline" size="sm" onClick={handleAddVariable}>
                    <Plus className="w-4 h-4 mr-1" />
                    {t.sourceList.addVariable}
                  </Button>
                </div>

                {paginationVariables.map((variable, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                    <div className="flex-1 grid grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs">{t.sourceList.variableName}</Label>
                        <Input
                          value={variable.name}
                          onChange={(e) => handleUpdateVariable(index, 'name', e.target.value)}
                          placeholder="page"
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t.sourceList.variableStart}</Label>
                        <Input
                          type="number"
                          value={variable.start}
                          onChange={(e) => handleUpdateVariable(index, 'start', e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t.sourceList.variableEnd}</Label>
                        <Input
                          type="number"
                          value={variable.end}
                          onChange={(e) => handleUpdateVariable(index, 'end', e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t.sourceList.variableStep}</Label>
                        <Input
                          type="number"
                          value={variable.step}
                          onChange={(e) => handleUpdateVariable(index, 'step', e.target.value)}
                          className="h-8"
                          min={1}
                        />
                      </div>
                    </div>
                    {paginationVariables.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveVariable(index)}
                        className="flex-shrink-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* 딜레이 설정 */}
              <div className="space-y-2">
                <Label>{t.sourceList.delayMs}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={paginationDelayMs}
                    onChange={(e) => setPaginationDelayMs(Number(e.target.value))}
                    className="w-32"
                    min={0}
                    step={100}
                  />
                  <span className="text-muted-foreground">{t.sourceList.delayMsUnit}</span>
                </div>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button
                variant="outline"
                onClick={() => setPaginationModalOpen(false)}
                disabled={paginationCrawling}
              >
                {t.common.cancel}
              </Button>
              <Button
                onClick={handleStartPaginationCrawl}
                disabled={paginationCrawling}
              >
                {paginationCrawling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {paginationCrawling ? t.sourceList.crawling : t.sourceList.startCrawl}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedEditPage;
