'use client';

import React, { useState, useEffect } from 'react';
import { Palette, RotateCcw, Sun, Moon, Monitor, Type, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Slider } from '@/ui/slider';
import { useThemeStore, applyThemeColors } from '@/stores/themeStore';
import { useSettingsStore, fontSizeLevels, fontSizeConfig, FontSizeLevel } from '@/stores/settingsStore';
import { useTranslation, languageNames, availableLanguages } from '@/stores/languageStore';
import { FeedItemCard } from '@/components/FeedItemCard';
import { RSSItem } from '@/types/rss';

// 더미 피드 아이템
const dummyItem: RSSItem = {
  id: 0,
  feed_id: 0,
  title: '샘플 피드 아이템 제목입니다',
  link: 'https://example.com',
  description: '<p>이것은 피드 아이템의 설명 미리보기입니다. 폰트 사이즈가 어떻게 보이는지 확인할 수 있습니다.</p><p>여러 줄의 텍스트가 포함되어 있어 가독성을 테스트할 수 있습니다.</p>',
  published_at: new Date().toISOString(),
  is_read: false,
  is_favorite: true,
};

// Preset color themes (HEX values)
const presetThemes = [
  { name: 'Purple', primary: '#7c3aed', secondary: '#6366f1' },
  { name: 'Blue', primary: '#3b82f6', secondary: '#6b7280' },
  { name: 'Green', primary: '#16a34a', secondary: '#65a30d' },
  { name: 'Orange', primary: '#f97316', secondary: '#f59e0b' },
  { name: 'Pink', primary: '#ec4899', secondary: '#d946ef' },
  { name: 'Teal', primary: '#0d9488', secondary: '#14b8a6' },
  { name: 'Red', primary: '#dc2626', secondary: '#ef4444' },
  { name: 'Indigo', primary: '#6366f1', secondary: '#8b5cf6' },
];

export default function SettingsPage() {
  const { mode, setMode, colors, setColors, resetColors } = useThemeStore();
  const { fontSizeLevel, setFontSizeLevel, cruiseSpeedPercent, setCruiseSpeedPercent } = useSettingsStore();
  const { t, language, setLanguage } = useTranslation();

  // Local state for color pickers
  const [primaryHex, setPrimaryHex] = useState(colors.primary);
  const [secondaryHex, setSecondaryHex] = useState(colors.secondary);

  // Update local state when store changes
  useEffect(() => {
    setPrimaryHex(colors.primary);
    setSecondaryHex(colors.secondary);
  }, [colors]);

  // Apply theme colors when colors change
  useEffect(() => {
    applyThemeColors(colors);
  }, [colors]);

  const handlePrimaryChange = (hex: string) => {
    setPrimaryHex(hex);
    setColors({ primary: hex });
  };

  const handleSecondaryChange = (hex: string) => {
    setSecondaryHex(hex);
    setColors({ secondary: hex });
  };

  const handlePresetSelect = (preset: typeof presetThemes[0]) => {
    setColors({ primary: preset.primary, secondary: preset.secondary });
  };

  const handleReset = () => {
    resetColors();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-1">
      <div className="flex items-center gap-3 mb-8">
        <Palette className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold text-foreground">{t.settings.title}</h1>
      </div>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t.settings.language}
          </CardTitle>
          <CardDescription>
            {t.settings.languageDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {availableLanguages.map((lang) => (
              <Button
                key={lang}
                variant={language === lang ? 'default' : 'outline'}
                onClick={() => setLanguage(lang)}
                className="flex-1 gap-2"
              >
                {languageNames[lang]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Theme Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="w-5 h-5" />
            {t.theme.mode}
          </CardTitle>
          <CardDescription>
            {t.theme.modeDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={mode === 'light' ? 'default' : 'outline'}
              onClick={() => setMode('light')}
              className="flex-1 gap-2"
            >
              <Sun className="w-4 h-4" />
              {t.theme.light}
            </Button>
            <Button
              variant={mode === 'dark' ? 'default' : 'outline'}
              onClick={() => setMode('dark')}
              className="flex-1 gap-2"
            >
              <Moon className="w-4 h-4" />
              {t.theme.dark}
            </Button>
            <Button
              variant={mode === 'system' ? 'default' : 'outline'}
              onClick={() => setMode('system')}
              className="flex-1 gap-2"
            >
              <Monitor className="w-4 h-4" />
              {t.theme.system}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Primary Color */}
      <Card>
        <CardHeader>
          <CardTitle>{t.theme.primaryColor}</CardTitle>
          <CardDescription>
            {t.theme.primaryColorDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Input
                type="color"
                value={primaryHex}
                onChange={(e) => handlePrimaryChange(e.target.value)}
                className="w-20 h-12 p-1 cursor-pointer"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="primary-hex">{t.theme.hexValue}</Label>
              <Input
                id="primary-hex"
                value={primaryHex}
                onChange={(e) => handlePrimaryChange(e.target.value)}
                placeholder="#000000"
              />
            </div>
            <div
              className="w-24 h-12 rounded-lg border border-border"
              style={{ backgroundColor: primaryHex }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Secondary Color */}
      <Card>
        <CardHeader>
          <CardTitle>{t.theme.secondaryColor}</CardTitle>
          <CardDescription>
            {t.theme.secondaryColorDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Input
                type="color"
                value={secondaryHex}
                onChange={(e) => handleSecondaryChange(e.target.value)}
                className="w-20 h-12 p-1 cursor-pointer"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="secondary-hex">{t.theme.hexValue}</Label>
              <Input
                id="secondary-hex"
                value={secondaryHex}
                onChange={(e) => handleSecondaryChange(e.target.value)}
                placeholder="#000000"
              />
            </div>
            <div
              className="w-24 h-12 rounded-lg border border-border"
              style={{ backgroundColor: secondaryHex }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Preset Themes */}
      <Card>
        <CardHeader>
          <CardTitle>{t.theme.preset}</CardTitle>
          <CardDescription>
            {t.theme.presetDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {presetThemes.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handlePresetSelect(preset)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-lg border border-border",
                  "hover:bg-accent transition-colors",
                  colors.primary === preset.primary && "ring-2 ring-primary"
                )}
              >
                <div className="flex gap-1">
                  <div
                    className="w-6 h-6 rounded-full border border-border"
                    style={{ backgroundColor: preset.primary }}
                  />
                  <div
                    className="w-6 h-6 rounded-full border border-border"
                    style={{ backgroundColor: preset.secondary }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{preset.name}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reset Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleReset} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          {t.theme.resetColors}
        </Button>
      </div>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.preview}</CardTitle>
          <CardDescription>
            {t.settings.previewDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button>Primary 버튼</Button>
            <Button variant="secondary">Secondary 버튼</Button>
            <Button variant="outline">Outline 버튼</Button>
            <Button variant="ghost">Ghost 버튼</Button>
            <Button variant="destructive">Destructive 버튼</Button>
          </div>
          <div className="p-4 rounded-lg bg-accent">
            <p className="text-accent-foreground">Accent 배경 영역</p>
          </div>
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-muted-foreground">Muted 배경 영역</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs">P</span>
            </div>
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
              <span className="text-secondary-foreground text-xs">S</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Font Size */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="w-5 h-5" />
            {t.settings.fontSize}
          </CardTitle>
          <CardDescription>
            {t.settings.fontSizeDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {fontSizeLevels.map((level) => (
              <Button
                key={level}
                variant={fontSizeLevel === level ? 'default' : 'outline'}
                onClick={() => setFontSizeLevel(level)}
                className="flex-1"
                size="sm"
              >
                {level === 'xs' ? t.settings.fontSizeSmall :
                  level === 'sm' ? t.settings.fontSizeDefault :
                    level === 'md' ? t.settings.fontSizeLarge :
                      level === 'lg' ? t.settings.fontSizeExtraLarge :
                        'XL'}
              </Button>
            ))}
          </div>

          {/* Preview */}
          <div className="mt-4 border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">{t.settings.preview}</span>
            </div>
            <div className="p-3">
              <FeedItemCard
                item={dummyItem}
                onMediaClick={() => { }}
                fontSizeOverride={fontSizeLevel}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cruise Speed */}
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.cruiseSpeed}</CardTitle>
          <CardDescription>
            {t.settings.cruiseSpeedDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground whitespace-nowrap">{t.settings.cruiseSpeedSlow}</span>
            <Slider
              value={[cruiseSpeedPercent]}
              onValueChange={([value]) => setCruiseSpeedPercent(value)}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">{t.settings.cruiseSpeedFast}</span>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            {Math.round(cruiseSpeedPercent)}%
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
