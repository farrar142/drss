'use client';

import { Loader2, Save } from 'lucide-react';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { useTranslation } from '@/stores/languageStore';

interface SaveStepProps {
  isSaving: boolean;
  onBack: () => void;
  onSave: () => void;
}

export function SaveStep({
  isSaving,
  onBack,
  onSave,
}: SaveStepProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t.rssEverything.addSource}
        </CardTitle>
        <CardDescription>
          {t.rssEverything.addSourceDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          설정을 확인하고 소스를 저장합니다.
        </p>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            {t.common.cancel}
          </Button>
          <Button
            className="flex-1"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.rssEverything.saving}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {t.rssEverything.addSource}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
