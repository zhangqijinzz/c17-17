import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { LocalBackupService, MAX_BACKUPS } from '../services/backupService';
import { MemoryStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

function makeViewModel() {
  const docStorage = new MemoryStorageService();
  const backupStorage = new MemoryStorageService();
  const repository = new LocalStoryRepository(docStorage);
  const backups = new LocalBackupService(backupStorage);
  return {
    docStorage,
    backupStorage,
    repository,
    backups,
    viewModel: new StoryViewModel(repository, backups),
  };
}

describe('story view model', () => {
  it('initializes, edits, persists, and restores the main flow', () => {
    const { repository, backups, viewModel } = makeViewModel();
    viewModel.initialize();
    expect(viewModel.snapshot.status).toBe('ready');
    viewModel.addCharacter('阿洛', '修复师');
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    const scene = viewModel.selectedScene;
    expect(scene?.title).toBe('地下档案室');
    viewModel.toggleCharacter(scene?.id ?? '', viewModel.snapshot.story?.characters[2]?.id ?? '');
    expect(viewModel.snapshot.stats.characters).toBe(3);

    const restored = new StoryViewModel(repository, backups);
    restored.initialize();
    expect(restored.snapshot.story?.scenes.some((item) => item.title === '地下档案室')).toBe(true);
    expect(restored.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);
  });

  it('shows recoverable validation feedback and resets corrupt storage', () => {
    const storage = new MemoryStorageService();
    storage.write('{broken');
    const viewModel = new StoryViewModel(
      new LocalStoryRepository(storage),
      new LocalBackupService(new MemoryStorageService()),
    );
    viewModel.initialize();
    viewModel.addCharacter(' ', '');
    expect(viewModel.snapshot.notice).toContain('至少');
    viewModel.resetProject();
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);
  });

  it('backs up before reset and lets the author restore the previous content', () => {
    const { viewModel } = makeViewModel();
    viewModel.initialize();
    viewModel.addCharacter('阿洛', '修复师');
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    expect(viewModel.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);

    viewModel.resetProject();
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);
    expect(viewModel.snapshot.backups).toHaveLength(1);
    expect(viewModel.snapshot.backups[0].story.characters.some((item) => item.name === '阿洛')).toBe(true);
    expect(viewModel.snapshot.notice).toContain('留底');

    viewModel.restoreBackup();
    expect(viewModel.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);
    expect(viewModel.snapshot.story?.scenes.some((item) => item.title === '地下档案室')).toBe(true);
    expect(viewModel.snapshot.backups).toHaveLength(0);
  });

  it('keeps the backup after refresh / reopen and restores it', () => {
    const { repository, backups, viewModel } = makeViewModel();
    viewModel.initialize();
    viewModel.addCharacter('阿洛', '修复师');
    viewModel.resetProject();
    expect(viewModel.snapshot.backups).toHaveLength(1);

    // Simulate closing and reopening the browser: a new view model over the same storage.
    const reopened = new StoryViewModel(repository, backups);
    reopened.initialize();
    expect(reopened.snapshot.backups).toHaveLength(1);
    reopened.restoreBackup();
    expect(reopened.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);
  });

  it('does not exceed the backup cap across repeated resets', () => {
    const { viewModel } = makeViewModel();
    viewModel.initialize();
    for (let i = 0; i < MAX_BACKUPS + 2; i += 1) {
      viewModel.addCharacter(`人物${i}`, '');
      viewModel.resetProject();
    }
    expect(viewModel.snapshot.backups).toHaveLength(MAX_BACKUPS);
  });

  it('restores a chosen backup from the list', () => {
    const { viewModel } = makeViewModel();
    viewModel.initialize();
    viewModel.addCharacter('阿甲', '');
    viewModel.resetProject();
    viewModel.addCharacter('阿乙', '');
    viewModel.resetProject();
    expect(viewModel.snapshot.backups).toHaveLength(2);

    const older = viewModel.snapshot.backups[1];
    viewModel.restoreBackup(older.id);
    expect(viewModel.snapshot.story?.characters.some((item) => item.name === '阿甲')).toBe(true);
    expect(viewModel.snapshot.story?.characters.some((item) => item.name === '阿乙')).toBe(false);
    expect(viewModel.snapshot.backups).toHaveLength(1);
  });
});
