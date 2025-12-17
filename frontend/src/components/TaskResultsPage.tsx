'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  feedsRoutersTaskResultsListTaskResults,
  feedsRoutersTaskResultsGetTaskStats,
  feedsRoutersTaskResultsDeleteTaskResult,
  feedsRoutersTaskResultsClearTaskResults,
  TaskResultSchema,
  TaskStatsSchema,
  TaskResultStatus,
} from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
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
  Filter,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select';

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
  const [results, setResults] = useState<TaskResultSchema[]>([]);
  const [stats, setStats] = useState<TaskStatsSchema | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaskResultStatus | 'all'>('all');
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const limit = 20;

  const fetchResults = useCallback(async () => {
    try {
      const params: Record<string, unknown> = {
        limit,
        offset: page * limit,
      };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      const response = await feedsRoutersTaskResultsListTaskResults(params as Parameters<typeof feedsRoutersTaskResultsListTaskResults>[0]);
      setResults(response.items);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to fetch task results:', error);
    }
  }, [page, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await feedsRoutersTaskResultsGetTaskStats();
      setStats(response);
    } catch (error) {
      console.error('Failed to fetch task stats:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchResults(), fetchStats()]);
    setLoading(false);
  }, [fetchResults, fetchStats]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDeleteResult = async (id: number) => {
    try {
      await feedsRoutersTaskResultsDeleteTaskResult(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete task result:', error);
    }
  };

  const handleClearResults = async (status?: TaskResultStatus) => {
    if (!confirm(status ? `모든 ${status} 상태의 결과를 삭제하시겠습니까?` : '모든 결과를 삭제하시겠습니까?')) {
      return;
    }
    try {
      await feedsRoutersTaskResultsClearTaskResults(status ? { status } : undefined);
      await loadData();
    } catch (error) {
      console.error('Failed to clear task results:', error);
    }
  };

  const totalPages = Math.ceil(total / limit);

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
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as TaskResultStatus | 'all');
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="상태 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failure">Failure</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="running">Running</SelectItem>
            </SelectContent>
          </Select>
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
          {total > 0 && (
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
            총 {total}개의 기록 중 {page * limit + 1}-{Math.min((page + 1) * limit, total)}
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
                const statusConfig = STATUS_CONFIG[result.status];
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
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
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
