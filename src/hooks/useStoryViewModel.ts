import { useEffect, useState } from 'react';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { LocalBackupService } from '../services/backupService';
import { BACKUP_STORAGE_KEY, BrowserStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

const viewModel = new StoryViewModel(
  new LocalStoryRepository(new BrowserStorageService()),
  new LocalBackupService(new BrowserStorageService(BACKUP_STORAGE_KEY)),
);

export function useStoryViewModel(): StoryViewModel {
  const [, refresh] = useState(0);
  useEffect(() => {
    const unsubscribe = viewModel.subscribe(() => refresh((value) => value + 1));
    viewModel.initialize();
    return unsubscribe;
  }, []);
  return viewModel;
}
