'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  listPeriodicTasks,
  getPeriodicTaskStats,
  togglePeriodicTask,
  deletePeriodicTask,
  updatePeriodicTask,
  PeriodicTaskSchema,
} from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Input } from '@/ui/input';
import { useToast, useConfirm } from '@/stores/toastStore';
import {
  RefreshCw,
  Trash2,
  Play,
  Pause,
  Clock,
  ChevronLeft,
  ChevronRight,
  Timer,
  Edit2,
  Check,
  X,
} from 'lucide-react';

interface TaskStats {
  total: number;
  enabled: number;
  disabled: number;
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

function formatInterval(interval: { every: number; period: string } | null): string {
  if (!interval) return '-';
  const { every, period } = interval;
  const periodLabels: Record<string, string> = {
    minutes: '분',
    hours: '시간',
    days: '일',
    seconds: '초',
  };
  return `${every}${periodLabels[period] || period}`;
}

export default function PeriodicTasksPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tasks, setTasks] = useState<PeriodicTaskSchema[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [enabledFilter, setEnabledFilter] = useState<boolean | 'all'>('all');
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingInterval, setEditingInterval] = useState<string>('');
  const limit = 20;

  const fetchTasks = useCallback(async () => {
    try {
      const params: Record<string, unknown> = {
        limit,
        offset: page * limit,
      };
      if (enabledFilter !== 'all') {
        params.enabled = enabledFilter;
      }

      const response = await listPeriodicTasks(params as Parameters<typeof listPeriodicTasks>[0]);
      setTasks(response.items);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to fetch periodic tasks:', error);
    }
  }, [page, enabledFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await getPeriodicTaskStats() as unknown as TaskStats;
      setStats(response);
    } catch (error) {
      console.error('Failed to fetch task stats:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchTasks(), fetchStats()]);
    setLoading(false);
  }, [fetchTasks, fetchStats]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleToggleTask = async (id: number) => {
    try {
      await togglePeriodicTask(id);
      await loadData();
    } catch (error) {
      console.error('Failed to toggle periodic task:', error);
    }
  };

  const handleDeleteTask = async (id: number) => {
    const confirmed = await confirm({
      title: '태스크 삭제',
      description: '이 주기적 태스크를 삭제하시겠습니까?',
      variant: 'destructive',
    });
    if (!confirmed) {
      return;
    }
    try {
      await deletePeriodicTask(id);
      await loadData();
    } catch (error) {
      console.error('Failed to delete periodic task:', error);
    }
  };

  const handleStartEditInterval = (task: PeriodicTaskSchema) => {
    setEditingTaskId(task.id);
    setEditingInterval(task.interval?.every.toString() || '');
  };

  const handleCancelEditInterval = () => {
    setEditingTaskId(null);
    setEditingInterval('');
  };

  const handleSaveInterval = async (taskId: number) => {
    const intervalMinutes = parseInt(editingInterval, 10);
    if (isNaN(intervalMinutes) || intervalMinutes <= 0) {
      toast.warning('올바른 분 단위 값을 입력하세요.');
      return;
    }
    try {
      await updatePeriodicTask(taskId, { interval_minutes: intervalMinutes });
      setEditingTaskId(null);
      setEditingInterval('');
      await loadData();
    } catch (error) {
      console.error('Failed to update interval:', error);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Periodic Tasks</h1>
          <p className="text-muted-foreground">피드 자동 업데이트 스케줄 관리</p>
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

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">전체</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Play className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">활성</p>
                  <p className="text-2xl font-bold text-green-600">{stats.enabled}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Pause className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-muted-foreground">비활성</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.disabled}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={enabledFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setEnabledFilter('all'); setPage(0); }}
        >
          전체
        </Button>
        <Button
          variant={enabledFilter === true ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setEnabledFilter(true); setPage(0); }}
        >
          <Play className="h-4 w-4 mr-1" />
          활성
        </Button>
        <Button
          variant={enabledFilter === false ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setEnabledFilter(false); setPage(0); }}
        >
          <Pause className="h-4 w-4 mr-1" />
          비활성
        </Button>
      </div>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle>스케줄 목록</CardTitle>
          <CardDescription>
            총 {total}개의 주기적 태스크
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              등록된 주기적 태스크가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={task.enabled ? 'default' : 'secondary'}>
                        {task.enabled ? (
                          <><Play className="h-3 w-3 mr-1" />활성</>
                        ) : (
                          <><Pause className="h-3 w-3 mr-1" />비활성</>
                        )}
                      </Badge>
                      <span className="font-medium truncate">{task.feed_title || 'Unknown Feed'}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {editingTaskId === task.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={editingInterval}
                              onChange={(e) => setEditingInterval(e.target.value)}
                              className="w-20 h-6 text-xs"
                              min={1}
                            />
                            <span className="text-xs">분</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleSaveInterval(task.id)}
                            >
                              <Check className="h-3 w-3 text-green-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={handleCancelEditInterval}
                            >
                              <X className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            {formatInterval(task.interval)}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => handleStartEditInterval(task)}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </span>
                      <span>실행 횟수: {task.total_run_count}</span>
                      <span>마지막 실행: {formatDate(task.last_run_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleToggleTask(task.id)}
                      title={task.enabled ? '비활성화' : '활성화'}
                    >
                      {task.enabled ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteTask(task.id)}
                      title="삭제"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                이전
              </Button>
              <span className="text-sm text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                다음
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
