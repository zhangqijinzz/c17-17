import { describe, expect, it } from 'vitest';
import { createStarterStory, type StoryDocument } from '../models/story';
import { LocalBackupService, MAX_BACKUPS } from '../services/backupService';
import { MemoryStorageService } from '../services/storageService';

function makeStory(title: string): StoryDocument {
  return { ...createStarterStory(), title };
}

describe('backup service', () => {
  it('snapshots the replaced content and removes it after restore', () => {
    const storage = new MemoryStorageService();
    const backups = new LocalBackupService(storage);
    const original = makeStory('写了很久的故事');

    const entry = backups.add(original, 'reset');
    expect(entry.story.title).toBe('写了很久的故事');
    expect(backups.list()).toHaveLength(1);
    expect(backups.list()[0].story.title).toBe('写了很久的故事');

    backups.remove(entry.id);
    expect(backups.list()).toHaveLength(0);
  });

  it('persists across service instances (survives refresh / reopen)', () => {
    const storage = new MemoryStorageService();
    const first = new LocalBackupService(storage);
    first.add(makeStory('跨刷新留底'), 'reset');

    const reopened = new LocalBackupService(storage);
    expect(reopened.list()).toHaveLength(1);
    expect(reopened.list()[0].story.title).toBe('跨刷新留底');
  });

  it('keeps only the most recent N backups, dropping the oldest', () => {
    const storage = new MemoryStorageService();
    const backups = new LocalBackupService(storage);
    for (let i = 0; i < MAX_BACKUPS + 2; i += 1) {
      backups.add(makeStory(`第 ${i} 次重置前`), 'reset');
    }

    const list = backups.list();
    expect(list).toHaveLength(MAX_BACKUPS);
    expect(list[0].story.title).toBe(`第 ${MAX_BACKUPS + 1} 次重置前`);
    expect(list[MAX_BACKUPS - 1].story.title).toBe('第 2 次重置前');
  });

  it('prunes backups older than 30 days', () => {
    const storage = new MemoryStorageService();
    const backups = new LocalBackupService(storage);
    const expired = backups.add(makeStory('过期留底'), 'reset');

    // Manually age the stored entry beyond the retention window.
    const raw = JSON.parse(storage.read() ?? '[]') as Array<{ savedAt: string }>;
    raw[0].savedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    storage.write(JSON.stringify(raw));

    backups.add(makeStory('新鲜留底'), 'reset');
    const list = backups.list();
    expect(list.some((entry) => entry.id === expired.id)).toBe(false);
    expect(list).toHaveLength(1);
    expect(list[0].story.title).toBe('新鲜留底');
  });

  it('returns an empty list when storage is corrupt or empty', () => {
    const storage = new MemoryStorageService();
    expect(new LocalBackupService(storage).list()).toEqual([]);
    storage.write('{broken');
    expect(new LocalBackupService(storage).list()).toEqual([]);
  });
});
