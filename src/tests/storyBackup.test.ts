import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import {
  BACKUP_LIMIT,
  BACKUP_TTL_MS,
  contentSignature,
  parseStoryBackups,
  pruneStoryBackups,
  recordStoryBackup,
  restoreStoryBackup,
  type StoryBackup,
} from '../models/storyBackup';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-09-29T12:00:00.000Z').getTime();

function storyWith(title: string) {
  return { ...createStarterStory(), title, updatedAt: new Date(now).toISOString() };
}

function makeBackup(title: string, createdAtMs: number, overrides: Partial<StoryBackup> = {}): StoryBackup {
  return {
    id: `backup-${title}-${createdAtMs}`,
    createdAt: new Date(createdAtMs).toISOString(),
    reason: 'restore-example',
    title,
    story: storyWith(title),
    ...overrides,
  };
}

describe('story backup retention rules', () => {
  it('keeps at most BACKUP_LIMIT backups, newest first', () => {
    const backups = Array.from({ length: BACKUP_LIMIT + 3 }, (_, index) =>
      makeBackup(`故事${index}`, now - index * 60_000),
    );
    const pruned = pruneStoryBackups(backups, now);
    expect(pruned).toHaveLength(BACKUP_LIMIT);
    expect(pruned[0].title).toBe('故事0');
    expect(pruned.some((backup) => backup.title === '故事5')).toBe(false);
  });

  it('drops backups older than 7 days', () => {
    const backups = [
      makeBackup('正好七天', now - BACKUP_TTL_MS),
      makeBackup('过期', now - BACKUP_TTL_MS - 1),
      makeBackup('最新', now),
    ];
    const titles = pruneStoryBackups(backups, now).map((backup) => backup.title);
    expect(titles).toEqual(['最新', '正好七天']);
  });

  it('records a backup before replacement and caps the list', () => {
    const existing = Array.from({ length: BACKUP_LIMIT }, (_, index) =>
      makeBackup(`旧${index}`, now - (index + 1) * 60_000),
    );
    const current = storyWith('正在写的故事');
    const result = recordStoryBackup(existing, current, 'restore-example', now);
    expect(result.backups).toHaveLength(BACKUP_LIMIT);
    expect(result.backups[0].title).toBe('正在写的故事');
    expect(result.backupId).toBe(result.backups[0].id);
    expect(result.backups.some((backup) => backup.title === `旧${BACKUP_LIMIT - 1}`)).toBe(false);
  });

  it('does not stack a duplicate when the newest backup has identical content', () => {
    const current = storyWith('同一个故事');
    const first = recordStoryBackup([], current, 'restore-example', now);
    const sameContent = { ...current, updatedAt: new Date(now + 5000).toISOString() };
    const second = recordStoryBackup(first.backups, sameContent, 'restore-example', now + 5000);
    expect(second.backups).toHaveLength(1);
    expect(second.backupId).toBe(first.backupId);
  });

  it('ignores updatedAt when comparing content', () => {
    const a = storyWith('故事');
    const b = { ...a, updatedAt: new Date(now + DAY).toISOString() };
    expect(contentSignature(a)).toBe(contentSignature(b));
  });

  it('restores a backup while keeping the current content as a new backup', () => {
    const longWork = storyWith('写了很久的故事');
    const record = recordStoryBackup([], longWork, 'restore-example', now);
    // 覆盖后作者在示例项目上停留了一天，然后从留底还原
    const exampleNow = { ...createStarterStory(), updatedAt: new Date(now + DAY).toISOString() };
    const restored = restoreStoryBackup(record.backups, record.backupId, exampleNow, now + DAY);
    expect(restored).not.toBeNull();
    expect(restored!.story.title).toBe('写了很久的故事');
    // 被还原掉的示例内容同样留了一份底，可以再切回去
    expect(restored!.backups).toHaveLength(1);
    expect(restored!.backups[0].title).toBe(createStarterStory().title);
    expect(restored!.backups[0].reason).toBe('restore-backup');
    // 被消费的旧留底已由自动留底接管
    expect(restored!.backups.some((backup) => backup.id === record.backupId)).toBe(false);
  });

  it('returns null when restoring an unknown or expired backup', () => {
    const backups = [makeBackup('过期故事', now - BACKUP_TTL_MS - DAY)];
    expect(restoreStoryBackup(backups, backups[0].id, storyWith('当前'), now)).toBeNull();
    expect(restoreStoryBackup([], 'missing', storyWith('当前'), now)).toBeNull();
  });

  it('parses persisted backups and discards corrupt entries', () => {
    const valid = makeBackup('有效', now);
    const parsed = parseStoryBackups([
      valid,
      { id: 'x', createdAt: 'bad-date', title: '时间坏掉', reason: 'restore-example', story: storyWith('时间坏掉') },
      { id: 'y', createdAt: new Date(now).toISOString(), title: '故事坏掉', reason: 'restore-example', story: null },
      null,
      { id: 'z', createdAt: new Date(now).toISOString(), title: '未知原因', reason: 'something-else', story: storyWith('未知原因') },
    ]);
    // 结构合法（含无法解析的日期）的条目保留给清理阶段处理
    expect(parsed).toHaveLength(3);
    expect(parsed[0].title).toBe('有效');
    expect(parsed[2].reason).toBe('restore-example');
    // 仓储加载时会做时间裁剪，无法解析日期的条目在此被丢弃
    const pruned = pruneStoryBackups(parsed, now);
    expect(pruned).toHaveLength(2);
    expect(pruned.some((backup) => backup.title === '时间坏掉')).toBe(false);
  });
});
