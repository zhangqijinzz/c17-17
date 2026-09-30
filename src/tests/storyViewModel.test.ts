import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { MemoryStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

describe('story view model', () => {
  it('initializes, edits, persists, and restores the main flow', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    expect(viewModel.snapshot.status).toBe('ready');
    viewModel.addCharacter('阿洛', '修复师');
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    const scene = viewModel.selectedScene;
    expect(scene?.title).toBe('地下档案室');
    viewModel.toggleCharacter(scene?.id ?? '', viewModel.snapshot.story?.characters[2]?.id ?? '');
    expect(viewModel.snapshot.stats.characters).toBe(3);

    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.scenes.some((item) => item.title === '地下档案室')).toBe(true);
    expect(restored.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);
  });

  it('shows recoverable validation feedback and resets corrupt storage', () => {
    const storage = new MemoryStorageService();
    storage.write('{broken');
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    viewModel.addCharacter(' ', '');
    expect(viewModel.snapshot.notice).toContain('至少');
    viewModel.resetProject();
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);
  });

  it('backs up the current story before restoring the example and allows undo', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    viewModel.addScene('我写了很久的第三幕', '这一幕解释了所有伏笔。');
    const longWorkTitle = viewModel.snapshot.story?.title;
    expect(longWorkTitle).toBe(createStarterStory().title);

    viewModel.resetProject();
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);
    expect(viewModel.snapshot.backups).toHaveLength(1);
    expect(viewModel.snapshot.undoBackupId).not.toBe('');
    expect(viewModel.snapshot.notice).toContain('留底');

    // 通知条一键撤销：误点前的内容完整回来
    viewModel.undoLastReplace();
    expect(viewModel.snapshot.story?.scenes.some((scene) => scene.title === '我写了很久的第三幕')).toBe(true);
  });

  it('keeps backups with the project across a reload', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    viewModel.addScene('只存在于本地的秘密场景', '刷新后也找得回来。');
    viewModel.resetProject();

    const reopened = new StoryViewModel(repository);
    reopened.initialize();
    expect(reopened.snapshot.story?.id).toBe(createStarterStory().id);
    expect(reopened.snapshot.backups).toHaveLength(1);

    // 关掉浏览器再打开后，从侧栏还原留底
    reopened.restoreBackup(reopened.snapshot.backups[0].id);
    expect(reopened.snapshot.story?.scenes.some((scene) => scene.title === '只存在于本地的秘密场景')).toBe(true);
  });

  it('caps backups when resetting repeatedly instead of piling up', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    for (let index = 0; index < 8; index += 1) {
      viewModel.addScene(`第 ${index} 版的独有场景`, '每一版都略有不同。');
      viewModel.resetProject();
    }
    expect(viewModel.snapshot.backups.length).toBeLessThanOrEqual(5);
    expect(viewModel.snapshot.backups).toHaveLength(5);
    // 最新留底在最前面
    expect(viewModel.snapshot.backups[0].title).toBe(createStarterStory().title);
  });

  it('does not create a redundant backup when resetting without content changes', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    viewModel.resetProject();
    viewModel.resetProject();
    expect(viewModel.snapshot.backups).toHaveLength(1);
  });
});
