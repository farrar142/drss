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

const STATUS_CONFIG: Record<TaskResultStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500', icon: <Clock className="h-4 w-4" /> },
  running: { label: 'Running', color: 'bg-blue-500', icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  success: { label: 'Success', color: 'bg-green-500', icon: <CheckCircle2 className="h-4 w-4" /> },
  failure: { label: 'Failure', color: 'bg-red-500', icon: <XCircle className="h-4 w-4" /> },
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function TaskResultsPage() {
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
    const confirmed = await confirm({
      title: '결과 삭제',
      description: status ? `모든 ${status} 상태의 결과를 삭제하시겠습니까?` : '모든 결과를 삭제하시겠습니까?',
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
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Task Results</h1>
          <p className="text-muted-foreground">피드 수집 작업의 실행 내역</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{stats.success}</div>
              <p className="text-xs text-muted-foreground">Success</p>
            </CardContent>
          </Card>
          <Card className="border-red-500/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{stats.failure}</div>
              <p className="text-xs text-muted-foreground">Failure</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-500/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card className="border-blue-500/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{stats.running}</div>
              <p className="text-xs text-muted-foreground">Running</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 필터 및 액션 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          {(['all', 'success', 'failure', 'pending', 'running'] as const).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter(status);
              }}
            >
              {status === 'all' && 'All'}
              {status === 'success' && <><CheckCircle2 className="h-3 w-3 mr-1" />Success</>}
              {status === 'failure' && <><XCircle className="h-3 w-3 mr-1" />Failure</>}
              {status === 'pending' && <><Clock className="h-3 w-3 mr-1" />Pending</>}
              {status === 'running' && <><Loader2 className="h-3 w-3 mr-1" />Running</>}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {stats && stats.failure > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleClearResults('failure')}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              실패 기록 삭제
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
              전체 삭제
            </Button>
          )}
        </div>
      </div>

      {/* 결과 목록 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">실행 내역</CardTitle>
          <CardDescription>
            {stats?.total ? `총 ${stats.total}개의 기록` : '기록 목록'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              기록이 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((result) => {
                const statusConfig = STATUS_CONFIG[result.status as TaskResultStatus] || STATUS_CONFIG.pending;
                return (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${statusConfig.color} text-white`}>
                        {statusConfig.icon}
                      </div>
                      <div>
                        <div className="font-medium">{result.feed.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(result.created_at)}
                          {result.duration_seconds !== null && (
                            <span className="ml-2">
                              • {formatDuration(result.duration_seconds)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
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
                        <div className="max-w-xs">
                          <Badge variant="destructive" className="text-xs truncate max-w-full">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {result.error_message.slice(0, 50)}
                            {result.error_message.length > 50 && '...'}
                          </Badge>
                        </div>
                      )}
                      <Badge variant="outline">{statusConfig.label}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
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
                페이지 {cursorHistory.length}
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
