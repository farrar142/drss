'use client';

import React, { useState, useEffect } from 'react';
import { Palette, RotateCcw, Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useThemeStore, applyThemeColors } from '../stores/themeStore';

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
        <h1 className="text-3xl font-bold text-foreground">설정</h1>
      </div>

      {/* Theme Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="w-5 h-5" />
            테마 모드
          </CardTitle>
          <CardDescription>
            라이트, 다크 또는 시스템 설정을 따르도록 선택합니다.
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
              라이트
            </Button>
            <Button
              variant={mode === 'dark' ? 'default' : 'outline'}
              onClick={() => setMode('dark')}
              className="flex-1 gap-2"
            >
              <Moon className="w-4 h-4" />
              다크
            </Button>
            <Button
              variant={mode === 'system' ? 'default' : 'outline'}
              onClick={() => setMode('system')}
              className="flex-1 gap-2"
            >
              <Monitor className="w-4 h-4" />
              시스템
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Primary Color */}
      <Card>
        <CardHeader>
          <CardTitle>주요 색상 (Primary)</CardTitle>
          <CardDescription>
            버튼, 링크, 액센트에 사용되는 주요 색상입니다.
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
              <Label htmlFor="primary-hex">HEX 값</Label>
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
          <CardTitle>보조 색상 (Secondary)</CardTitle>
          <CardDescription>
            보조 버튼과 덜 강조된 요소에 사용됩니다.
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
              <Label htmlFor="secondary-hex">HEX 값</Label>
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
          <CardTitle>프리셋 테마</CardTitle>
          <CardDescription>
            미리 정의된 색상 조합 중 하나를 선택하세요.
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
          기본값으로 초기화
        </Button>
      </div>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>미리보기</CardTitle>
          <CardDescription>
            현재 선택한 색상이 어떻게 보이는지 미리 확인하세요.
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
    </div>
  );
}
