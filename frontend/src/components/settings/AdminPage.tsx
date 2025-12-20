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

// ===== 관리자 설정 정의 (번역 적용을 위해 함수로 변환) =====
// 새로운 설정을 추가하려면 이 함수 내의 배열에 필드 정의만 추가하면 됩니다.

const getAdminSettings = (t: ReturnType<typeof useTranslation>['t']): SettingSection[] => [
  {
    title: t.settings.userManagement,
    description: t.settings.userManagementDescription,
    fields: [
      {
        key: 'allow_signup',
        label: t.settings.allowSignup,
        description: t.settings.allowSignupDescription,
        type: 'boolean',
      },
    ],
  },
  {
    title: t.settings.siteSettings,
    description: t.settings.siteSettingsDescription,
    fields: [
      {
        key: 'site_name',
        label: t.settings.siteName,
        description: t.settings.siteNameDescription,
        type: 'text',
        placeholder: 'DRSS',
        maxLength: 100,
      },
    ],
  },
  {
    title: t.settings.feedSettings,
    description: t.settings.feedSettingsDescription,
    fields: [
      {
        key: 'max_feeds_per_user',
        label: t.settings.maxFeedsPerUser,
        description: t.settings.maxFeedsPerUserDescription,
        type: 'range',
        min: 10,
        max: 500,
        step: 10,
        unit: t.common.countUnit,
      },
      {
        key: 'default_refresh_interval',
        label: t.settings.defaultRefreshInterval,
        description: t.settings.defaultRefreshIntervalDescription,
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
  const { t } = useTranslation();
  
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
              <SelectValue placeholder={t.admin.selectPlaceholder} />
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
      setError(t.errors.networkError);
    } finally {
      setLoading(false);
    }
  }, [t]);

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
        toast.info(t.common.none);
        return;
      }

      const updated = await usersRouterUpdateGlobalSettings(changedFields);
      setSettings(updated);
      setLocalSettings(updated as unknown as Record<string, unknown>);
      setHasChanges(false);
      toast.success(t.common.success);
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error(t.common.error);
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
                {t.common.refresh}
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
            <h1 className="text-2xl font-bold">{t.settings.admin}</h1>
            <p className="text-muted-foreground">{t.settings.adminDescription}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={handleReset} size="sm">
              {t.common.cancel}
            </Button>
          )}
          <Button onClick={handleSave} disabled={!hasChanges || saving} size="sm">
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {t.common.save}
          </Button>
        </div>
      </div>

      {/* 설정 섹션들 */}
      <div className="space-y-4 sm:space-y-6">
        {getAdminSettings(t).map((section) => (
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
            {t.common.save}
          </Button>
        </div>
      )}
    </div>
  );
}
