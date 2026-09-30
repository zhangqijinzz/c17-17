import { createStarterStory, type StoryDocument } from '../models/story';
import { parseStoryBackups, pruneStoryBackups, type StoryBackup } from '../models/storyBackup';
import { sanitizeStory } from '../models/storyRules';
import type { StorageService } from '../services/storageService';

export interface StoryRepository {
  load(): StoryDocument;
  save(story: StoryDocument): void;
  loadBackups(): StoryBackup[];
  saveBackups(backups: StoryBackup[]): void;
}

export class LocalStoryRepository implements StoryRepository {
  constructor(private readonly storage: StorageService) {}

  load(): StoryDocument {
    const raw = this.storage.read();
    if (!raw) return createStarterStory();
    try {
      return sanitizeStory(JSON.parse(raw)) ?? createStarterStory();
    } catch {
      return createStarterStory();
    }
  }

  save(story: StoryDocument): void {
    this.storage.write(JSON.stringify(story));
  }

  loadBackups(): StoryBackup[] {
    const raw = this.storage.readBackups();
    if (!raw) return [];
    try {
      return pruneStoryBackups(parseStoryBackups(JSON.parse(raw)), Date.now());
    } catch {
      return [];
    }
  }

  saveBackups(backups: StoryBackup[]): void {
    this.storage.writeBackups(JSON.stringify(backups));
  }
}
