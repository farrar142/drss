'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Save, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Switch } from '@/ui/switch';
import { Slider } from '@/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select';
import { useToast } from '@/stores/toastStore';
import { useTranslation } from '@/stores/languageStore';
import {
  usersRouterGetGlobalSettings,
  usersRouterUpdateGlobalSettings,
  GlobalSettingSchema,
} from '@/services/api';

// ===== 동적 설정 필드 타입 정의 =====

type FieldType = 'text' | 'number' | 'boolean' | 'select' | 'radio' | 'range';

interface BaseFieldConfig {
  key: string;
  label: string;
  description?: string;
  type: FieldType;
}

interface TextFieldConfig extends BaseFieldConfig {
  type: 'text';
  placeholder?: string;
  maxLength?: number;
}

interface NumberFieldConfig extends BaseFieldConfig {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
}

interface BooleanFieldConfig extends BaseFieldConfig {
  type: 'boolean';
}

interface SelectFieldConfig extends BaseFieldConfig {
  type: 'select';
  options: { value: string; label: string }[];
}

interface RadioFieldConfig extends BaseFieldConfig {
  type: 'radio';
  options: { value: string; label: string }[];
}

interface RangeFieldConfig extends BaseFieldConfig {
  type: 'range';
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

type FieldConfig =
  | TextFieldConfig
  | NumberFieldConfig
  | BooleanFieldConfig
  | SelectFieldConfig
  | RadioFieldConfig
  | RangeFieldConfig;

interface SettingSection {
  title: string;
  description?: string;
  fields: FieldConfig[];
}

// ===== 관리자 설정 정의 =====
// 새로운 설정을 추가하려면 이 배열에 필드 정의만 추가하면 됩니다.

const ADMIN_SETTINGS: SettingSection[] = [
  {
    title: '사용자 관리',
    description: '사용자 가입 및 권한 관련 설정',
    fields: [
      {
        key: 'allow_signup',
        label: '회원가입 허용',
        description: '새로운 사용자의 회원가입을 허용합니다. 비활성화하면 기존 사용자만 로그인할 수 있습니다.',
        type: 'boolean',
      },
    ],
  },
  {
    title: '사이트 설정',
    description: '사이트 기본 정보 설정',
    fields: [
      {
        key: 'site_name',
        label: '사이트 이름',
        description: '브라우저 탭과 헤더에 표시될 사이트 이름',
        type: 'text',
        placeholder: 'DRSS',
        maxLength: 100,
      },
    ],
  },
  {
    title: '피드 설정',
    description: '피드 관련 기본값 설정',
    fields: [
      {
        key: 'max_feeds_per_user',
        label: '사용자당 최대 피드 수',
        description: '각 사용자가 생성할 수 있는 최대 피드 개수',
        type: 'range',
        min: 10,
        max: 500,
        step: 10,
        unit: '개',
      },
      {
        key: 'default_refresh_interval',
        label: '기본 새로고침 간격',
        description: '새 피드 생성 시 기본 새로고침 간격 (분)',
        type: 'number',
        min: 1,
        max: 1440,
        step: 1,
      },
    ],
  },
];

// ===== 동적 필드 렌더러 =====

interface FieldRendererProps {
  field: FieldConfig;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}

function FieldRenderer({ field, value, onChange }: FieldRendererProps) {
  switch (field.type) {
    case 'text':
      return (
        <div className="space-y-2">
          <Label htmlFor={field.key}>{field.label}</Label>
          <Input
            id={field.key}
            value={(value as string) || ''}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
          />
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
        </div>
      );

    case 'number':
      return (
        <div className="space-y-2">
          <Label htmlFor={field.key}>{field.label}</Label>
          <Input
            id={field.key}
            type="number"
            value={(value as number) ?? ''}
            onChange={(e) => onChange(field.key, Number(e.target.value))}
            min={field.min}
            max={field.max}
            step={field.step}
            className="w-32"
          />
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
        </div>
      );

    case 'boolean':
      return (
        <div className="flex items-center justify-between py-2">
          <div className="space-y-1">
            <Label htmlFor={field.key}>{field.label}</Label>
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
          <Switch
            id={field.key}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(field.key, checked)}
          />
        </div>
      );

    case 'select':
      return (
        <div className="space-y-2">
          <Label htmlFor={field.key}>{field.label}</Label>
          <Select
            value={String(value)}
            onValueChange={(v) => onChange(field.key, v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
        </div>
      );

    case 'radio':
      return (
        <div className="space-y-2">
          <Label>{field.label}</Label>
          <RadioGroup
            value={String(value)}
            onValueChange={(v) => onChange(field.key, v)}
            className="flex flex-col space-y-1"
          >
            {field.options.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`${field.key}-${option.value}`} />
                <Label htmlFor={`${field.key}-${option.value}`}>{option.label}</Label>
              </div>
            ))}
          </RadioGroup>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
        </div>
      );

    case 'range':
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor={field.key}>{field.label}</Label>
            <span className="text-sm font-medium">
              {value as number}{field.unit && ` ${field.unit}`}
            </span>
          </div>
          <Slider
            id={field.key}
            value={[value as number]}
            onValueChange={([v]) => onChange(field.key, v)}
            min={field.min}
            max={field.max}
            step={field.step || 1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{field.min}{field.unit && ` ${field.unit}`}</span>
            <span>{field.max}{field.unit && ` ${field.unit}`}</span>
          </div>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
        </div>
      );

    default:
      return null;
  }
}

// ===== 메인 컴포넌트 =====

export default function AdminPage() {
  const toast = useToast();
  const { t } = useTranslation();
  
  const [settings, setSettings] = useState<GlobalSettingSchema | null>(null);
  const [localSettings, setLocalSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await usersRouterGetGlobalSettings();
      setSettings(data);
      setLocalSettings(data as unknown as Record<string, unknown>);
      setHasChanges(false);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('설정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleChange = (key: string, value: unknown) => {
    setLocalSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      // 변경된 필드만 전송
      const changedFields: Record<string, unknown> = {};
      for (const key of Object.keys(localSettings)) {
        if (localSettings[key] !== (settings as unknown as Record<string, unknown>)[key]) {
          changedFields[key] = localSettings[key];
        }
      }
      
      if (Object.keys(changedFields).length === 0) {
        toast.info('변경된 내용이 없습니다.');
        return;
      }

      const updated = await usersRouterUpdateGlobalSettings(changedFields);
      setSettings(updated);
      setLocalSettings(updated as unknown as Record<string, unknown>);
      setHasChanges(false);
      toast.success('설정이 저장되었습니다.');
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error('설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      setLocalSettings(settings as unknown as Record<string, unknown>);
      setHasChanges(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-2 sm:p-4 max-w-4xl">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <p className="text-lg font-medium">{error}</p>
              <Button onClick={loadSettings}>
                <RefreshCw className="w-4 h-4 mr-2" />
                다시 시도
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-2 sm:p-4 max-w-4xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">관리자 설정</h1>
            <p className="text-muted-foreground">시스템 전역 설정을 관리합니다</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={handleReset} size="sm">
              취소
            </Button>
          )}
          <Button onClick={handleSave} disabled={!hasChanges || saving} size="sm">
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            저장
          </Button>
        </div>
      </div>

      {/* 설정 섹션들 */}
      <div className="space-y-4 sm:space-y-6">
        {ADMIN_SETTINGS.map((section) => (
          <Card key={section.title}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{section.title}</CardTitle>
              {section.description && (
                <CardDescription>{section.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {section.fields.map((field) => (
                <FieldRenderer
                  key={field.key}
                  field={field}
                  value={localSettings[field.key]}
                  onChange={handleChange}
                />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 하단 저장 버튼 (모바일에서 편의성) */}
      {hasChanges && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center sm:hidden">
          <Button onClick={handleSave} disabled={saving} className="shadow-lg">
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            변경사항 저장
          </Button>
        </div>
      )}
    </div>
  );
}
