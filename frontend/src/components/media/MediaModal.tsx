'use client';

import { FC } from 'react';
import { UseMediaModalReturn } from '@/hooks/media/useMediaModal';
import { useMediaModalController } from '@/hooks/media/useMediaModalController';
import { MediaModalView } from './MediaModalView';

export interface MediaModalProps {
  modal: UseMediaModalReturn;
}

export const MediaModal: FC<MediaModalProps> = ({ modal }) => {
  const controller = useMediaModalController(modal);
  return <MediaModalView {...controller} />;
};
