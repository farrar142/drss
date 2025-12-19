'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  listTaskResults,
  getTaskStats,
  deleteTaskResult,
  clearTaskResults,
  TaskResultSchema,
  TaskStatsSchema,
} from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { useConfirm } from '@/stores/toastStore';
import { useTranslation, interpolate } from '@/stores/languageStore';
import {
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// TaskResultStatus 타입을 직접 정의
type TaskResultStatus = 'pending' | 'running' | 'success' | 'failure';

// STATUS_CONFIG는 컴포넌트 내에서 t를 사용하여 동적으로 생성

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

function formatDate(dateStr: string | null, locale: string = 'ko-KR'): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function TaskResultsPage() {
  const { t, language } = useTranslation();
  const confirm = useConfirm();
  const [results, setResults] = useState<TaskResultSchema[]>([]);
  const [stats, setStats] = useState<TaskStatsSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaskResultStatus | 'all'>('all');
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null]);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const limit = 20;

  // STATUS_CONFIG를 t를 사용하여 동적으로 생성
  const STATUS_CONFIG: Record<TaskResultStatus, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { label: t.tasks.statusPending, color: 'bg-yellow-500', icon: <Clock className="h-4 w-4" /> },
    running: { label: t.tasks.statusRunning, color: 'bg-blue-500', icon: <Loader2 className="h-4 w-4 animate-spin" /> },
    success: { label: t.tasks.statusSuccess, color: 'bg-green-500', icon: <CheckCircle2 className="h-4 w-4" /> },
    failure: { label: t.tasks.statusFailure, color: 'bg-red-500', icon: <XCircle className="h-4 w-4" /> },
  };

  const fetchResults = useCallback(async (cursorValue: string | null = null) => {
    try {
      const params: Record<string, unknown> = {
        limit,
        cursor: cursorValue,
      };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const response = await listTaskResults(params as Parameters<typeof listTaskResults>[0]);
      setResults(response.items);
      setHasNext(response.has_next ?? false);
      setHasPrev(response.has_prev ?? false);
    } catch (error) {
      console.error('Failed to fetch task results:', error);
    }
  }, [statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await getTaskStats();
      setStats(response);
    } catch (error) {
      console.error('Failed to fetch task stats:', error);
    }
  }, []);

  const loadData = useCallback(async (cursorValue: string | null = null) => {
    setLoading(true);
    await Promise.all([fetchResults(cursorValue), fetchStats()]);
    setLoading(false);
  }, [fetchResults, fetchStats]);

  useEffect(() => {
    // Reset cursor history when filter changes
    setCursor(null);
    setCursorHistory([null]);
    loadData(null);
  }, [statusFilter]);

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setCursor(null);
    setCursorHistory([null]);
    await loadData(null);
    setRefreshing(false);
  };

  const handleNextPage = async () => {
    if (results.length > 0 && hasNext) {
      const lastItem = results[results.length - 1];
      const nextCursor = lastItem.created_at;
      setCursorHistory((prev) => [...prev, nextCursor]);
      setCursor(nextCursor);
      await loadData(nextCursor);
    }
  };

  const handlePrevPage = async () => {
    if (cursorHistory.length > 1) {
      const newHistory = cursorHistory.slice(0, -1);
      const prevCursor = newHistory[newHistory.length - 1];
      setCursorHistory(newHistory);
      setCursor(prevCursor);
      await loadData(prevCursor);
    }
  };

  const handleDeleteResult = async (id: number) => {
    try {
      await deleteTaskResult(id);
      await loadData(cursor);
    } catch (error) {
      console.error('Failed to delete task result:', error);
    }
  };

  const handleClearResults = async (status?: TaskResultStatus) => {
    const statusLabel = status ? STATUS_CONFIG[status].label : '';
    const confirmed = await confirm({
      title: t.tasks.deleteResults,
      description: status
        ? interpolate(t.tasks.deleteConfirmWithStatus, { status: statusLabel })
        : t.tasks.deleteConfirm,
      variant: 'destructive',
    });
    if (!confirmed) {
      return;
    }
    try {
      await clearTaskResults(status ? { status } : undefined);
      setCursor(null);
      setCursorHistory([null]);
      await loadData(null);
    } catch (error) {
      console.error('Failed to clear task results:', error);
    }
  };

  return (
    <div className="container mx-auto p-2 sm:p-4 max-w-6xl">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t.tasks.resultsTitle}</h1>
          <p className="text-muted-foreground">{t.tasks.resultsDescription}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {t.common.refresh}
        </Button>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">{t.tasks.total}</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{stats.success}</div>
              <p className="text-xs text-muted-foreground">{t.tasks.statusSuccess}</p>
            </CardContent>
          </Card>
          <Card className="border-red-500/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{stats.failure}</div>
              <p className="text-xs text-muted-foreground">{t.tasks.statusFailure}</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-500/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">{t.tasks.statusPending}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{stats.running}</div>
              <p className="text-xs text-muted-foreground">{t.tasks.statusRunning}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 필터 및 액션 */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-1">
          {(['all', 'success', 'failure', 'pending', 'running'] as const).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter(status);
              }}
            >
              {status === 'all' && t.tasks.statusAll}
              {status === 'success' && <><CheckCircle2 className="h-3 w-3 mr-1" />{t.tasks.statusSuccess}</>}
              {status === 'failure' && <><XCircle className="h-3 w-3 mr-1" />{t.tasks.statusFailure}</>}
              {status === 'pending' && <><Clock className="h-3 w-3 mr-1" />{t.tasks.statusPending}</>}
              {status === 'running' && <><Loader2 className="h-3 w-3 mr-1" />{t.tasks.statusRunning}</>}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stats && stats.failure > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleClearResults('failure')}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t.tasks.deleteFailedResults}
            </Button>
          )}
          {stats && stats.total > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleClearResults()}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t.tasks.deleteAllResults}
            </Button>
          )}
        </div>
      </div>

      {/* 결과 목록 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t.tasks.executionHistory}</CardTitle>
          <CardDescription>
            {stats?.total ? interpolate(t.tasks.totalRecords, { count: stats.total }) : t.tasks.executionHistory}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t.tasks.noRecords}
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((result) => {
                const statusConfig = STATUS_CONFIG[result.status as TaskResultStatus] || STATUS_CONFIG.pending;
                return (
                  <div
                    key={result.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors gap-2"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`p-2 rounded-full ${statusConfig.color} text-white flex-shrink-0`}>
                        {statusConfig.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{result.feed.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(result.created_at, language === 'ko' ? 'ko-KR' : 'en-US')}
                          {result.duration_seconds !== null && (
                            <span className="ml-2">
                              • {formatDuration(result.duration_seconds)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {result.status === 'success' && (
                        <div className="text-sm">
                          <span className="text-green-600 font-medium">
                            +{result.items_created}
                          </span>
                          <span className="text-muted-foreground">
                            /{result.items_found}
                          </span>
                        </div>
                      )}
                      {result.status === 'failure' && result.error_message && (
                        <Badge variant="destructive" className="text-xs truncate max-w-[150px] sm:max-w-xs">
                          <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">
                            {result.error_message.slice(0, 50)}
                            {result.error_message.length > 50 && '...'}
                          </span>
                        </Badge>
                      )}
                      <Badge variant="outline" className="flex-shrink-0">{statusConfig.label}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={() => handleDeleteResult(result.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 페이지네이션 */}
          {(hasPrev || hasNext) && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={!hasPrev || cursorHistory.length <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {t.tasks.page} {cursorHistory.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
