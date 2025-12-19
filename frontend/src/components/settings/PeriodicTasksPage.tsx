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
import { useTranslation, interpolate } from '@/stores/languageStore';
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

export default function PeriodicTasksPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { t, language } = useTranslation();
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

  // formatInterval을 컴포넌트 내부에서 정의 (t 접근을 위해)
  const formatInterval = (interval: { every: number; period: string } | null): string => {
    if (!interval) return '-';
    const { every, period } = interval;
    const periodLabels: Record<string, string> = {
      minutes: t.tasks.timeMinutes,
      hours: t.tasks.timeHours,
      days: t.tasks.timeDays,
      seconds: t.tasks.timeSeconds,
    };
    return `${every}${periodLabels[period] || period}`;
  };

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
      title: t.tasks.deleteTask,
      description: t.tasks.deleteTaskConfirm,
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
      toast.warning(t.tasks.enterValidInterval);
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
    <div className="container mx-auto p-2 sm:p-4 max-w-6xl">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t.tasks.periodicTitle}</h1>
          <p className="text-muted-foreground">{t.tasks.periodicDescription}</p>
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

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">{t.tasks.total}</p>
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
                  <p className="text-sm text-muted-foreground">{t.tasks.enabled}</p>
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
                  <p className="text-sm text-muted-foreground">{t.tasks.disabled}</p>
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
          {t.tasks.statusAll}
        </Button>
        <Button
          variant={enabledFilter === true ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setEnabledFilter(true); setPage(0); }}
        >
          <Play className="h-4 w-4 mr-1" />
          {t.tasks.enabled}
        </Button>
        <Button
          variant={enabledFilter === false ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setEnabledFilter(false); setPage(0); }}
        >
          <Pause className="h-4 w-4 mr-1" />
          {t.tasks.disabled}
        </Button>
      </div>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle>{t.tasks.scheduleList}</CardTitle>
          <CardDescription>
            {interpolate(t.tasks.totalTasks, { count: total })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t.tasks.noTasks}
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
                          <><Play className="h-3 w-3 mr-1" />{t.tasks.enabled}</>
                        ) : (
                          <><Pause className="h-3 w-3 mr-1" />{t.tasks.disabled}</>
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
                            <span className="text-xs">{t.tasks.minutes}</span>
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
                      <span>{t.tasks.runCount}: {task.total_run_count}</span>
                      <span>{t.tasks.lastRun}: {formatDate(task.last_run_at, language === 'ko' ? 'ko-KR' : 'en-US')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleToggleTask(task.id)}
                      title={task.enabled ? t.tasks.disable : t.tasks.enable}
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
                      title={t.common.delete}
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
                {t.common.back}
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
                {t.common.next}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
