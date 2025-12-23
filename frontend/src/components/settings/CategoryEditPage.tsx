'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertCircle,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import { Label } from '@/ui/label';
import { Input } from '@/ui/input';
import { Button } from '@/ui/button';
import { Switch } from '@/ui/switch';
import { useTranslation } from '@/stores/languageStore';
import { useTabStore, CategoryEditContext } from '@/stores/tabStore';
import { useRSSStore } from '@/stores/rssStore';
import { useToast } from '@/stores/toastStore';
import {
  CategorySchema,
  createCategory,
  updateCategory,
  listCategories,
} from '@/services/api';

interface CategoryEditPageProps {
  context?: CategoryEditContext;
}

export const CategoryEditPage: React.FC<CategoryEditPageProps> = ({ context }) => {
  const { t } = useTranslation();
  const { updateTab, panels, activePanelId } = useTabStore();
  const { categories: storeCategories, addCategory, updateCategory: updateCategoryInStore } = useRSSStore();
  const toast = useToast();

  // 카테고리 정보
  const [category, setCategory] = useState<CategorySchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 폼 필드
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visible, setVisible] = useState(true);
  const [isPublic, setIsPublic] = useState(false);

  // 카테고리 데이터 로드 (스토어에서 먼저 찾고, 없으면 API 호출)
  const loadCategory = useCallback(async () => {
    if (context?.mode === 'edit' && context.categoryId) {
      setLoading(true);
      setError(null);
      try {
        // 먼저 스토어에서 카테고리를 찾음
        let foundCategory = storeCategories.find(c => c.id === context.categoryId) as CategorySchema | undefined;

        // 스토어에 없으면 API 호출
        if (!foundCategory) {
          const categories = await listCategories();
          foundCategory = categories.find(c => c.id === context.categoryId);
        }

        if (foundCategory) {
          setCategory(foundCategory);
          setName(foundCategory.name);
          setDescription(foundCategory.description || '');
          setVisible(foundCategory.visible);
          setIsPublic((foundCategory as any).is_public ?? false);
        } else {
          setError(t.category.empty);
        }
      } catch (err) {
        console.error('Failed to load category:', err);
        setError(t.common.error);
      } finally {
        setLoading(false);
      }
    }
  }, [context, storeCategories, t]);

  useEffect(() => {
    loadCategory();
  }, [loadCategory]);

  // 카테고리 저장
  const handleSave = async () => {
    if (!name.trim()) {
      toast.warning(t.category.name + ' ' + t.errors.required);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (context?.mode === 'edit' && context.categoryId) {
        // 카테고리 수정
        const updatedCategory = await updateCategory(context.categoryId, {
          name,
          description,
          visible,
          is_public: isPublic,
          // is_public은 백엔드 스키마가 업데이트되면 추가
          // is_public: isPublic,
        } as any);
        setCategory(updatedCategory);
        updateCategoryInStore({ ...updatedCategory, visible: updatedCategory.visible ?? true } as any);

        // 탭 제목 업데이트
        const activePanel = panels.find(p => p.id === activePanelId);
        const activeTab = activePanel?.tabs.find(tab => tab.id === activePanel?.activeTabId);
        if (activeTab) {
          updateTab(activeTab.id, { title: `${updatedCategory.name} - ${t.common.edit}` });
        }

        toast.success(t.common.success);
      } else if (context?.mode === 'create') {
        // 카테고리 생성
        const newCategory = await createCategory({
          name,
          description,
          visible,
          is_public: isPublic,
        } as any);

        addCategory({ ...newCategory, visible: newCategory.visible ?? true } as any);
        setCategory(newCategory);

        // context를 edit 모드로 전환
        const activePanel = panels.find(p => p.id === activePanelId);
        const activeTab = activePanel?.tabs.find(tab => tab.id === activePanel?.activeTabId);
        if (activeTab) {
          updateTab(activeTab.id, {
            title: `${newCategory.name} - ${t.common.edit}`,
            resourceId: newCategory.id,
            categoryEditContext: {
              mode: 'edit',
              categoryId: newCategory.id,
            },
          });
        }

        toast.success(t.common.success);
      }
    } catch (err) {
      console.error('Failed to save category:', err);
      setError(t.common.error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isEditMode = context?.mode === 'edit' && category !== null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* 헤더 */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold">
            {isEditMode ? `${category?.name} - ${t.common.edit}` : t.category.add}
          </h1>
        </div>
        <p className="text-muted-foreground">
          {isEditMode
            ? t.category.edit
            : t.category.add}
        </p>
      </div>

      {/* 오류 메시지 */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* 카테고리 정보 폼 */}
      <div className="space-y-6 p-6 border rounded-lg bg-card">
        <h2 className="text-lg font-semibold">{t.category.edit}</h2>

        <div className="grid gap-4">
          {/* 카테고리 이름 */}
          <div className="space-y-2">
            <Label>{t.category.name}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.category.namePlaceholder}
            />
          </div>

          {/* 설명 */}
          <div className="space-y-2">
            <Label>{t.category.description}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.category.descriptionPlaceholder}
            />
          </div>

          {/* 표시 여부 */}
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="category-visible">{t.category.visible}</Label>
              <p className="text-xs text-muted-foreground">
                {t.feed.visibleDescription}
              </p>
            </div>
            <Switch
              id="category-visible"
              checked={visible}
              onCheckedChange={setVisible}
            />
          </div>

          {/* 공개 여부 (RSS Export) */}
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="category-public">RSS 피드 공개</Label>
              <p className="text-xs text-muted-foreground">
                /rss 엔드포인트에서 공개할지 여부를 설정합니다
              </p>
            </div>
            <Switch
              id="category-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saving ? t.common.loading : t.common.save}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CategoryEditPage;
