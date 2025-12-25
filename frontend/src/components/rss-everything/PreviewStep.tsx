'use client';

import { Save } from 'lucide-react';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { PreviewPanel } from '@/components/common/PreviewPanel';
import { PreviewItem } from '@/services/api';
import { useTranslation } from '@/stores/languageStore';

interface PreviewStepProps {
  previewItems: PreviewItem[];
  onBack: () => void;
  onContinue: () => void;
}

export function PreviewStep({ previewItems, onBack, onContinue }: PreviewStepProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.rssEverything.previewItems} ({previewItems.length})</CardTitle>
        <CardDescription>
          {t.rssEverything.preview}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PreviewPanel items={previewItems} />

        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={onBack}>
            {t.common.edit}
          </Button>
          <Button className="flex-1" onClick={onContinue}>
            <Save className="mr-2 h-4 w-4" />
            {t.rssEverything.saveFeed}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
