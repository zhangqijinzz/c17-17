import { createId, type StoryDocument } from './story';
import { sanitizeStory } from './storyRules';

/** 触发整份内容替换、因而需要留底的动作 */
export type StoryBackupReason = 'restore-example' | 'restore-backup';

export interface StoryBackup {
  id: string;
  createdAt: string;
  reason: StoryBackupReason;
  /** 留底时的故事标题，列表展示用，避免读取整份内容 */
  title: string;
  story: StoryDocument;
}

/** 最多保留的留底份数，防止无限堆积 */
export const BACKUP_LIMIT = 5;
/** 每份留底的最长保留时间：7 天 */
export const BACKUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const backupReasonLabels: Record<StoryBackupReason, string> = {
  'restore-example': '恢复示例前',
  'restore-backup': '还原留底前',
};

/**
 * 按保留策略清理留底：丢弃超过 7 天的，按时间从新到旧排序，只留最近 BACKUP_LIMIT 份。
 */
export function pruneStoryBackups(backups: StoryBackup[], now: number): StoryBackup[] {
  return backups
    .filter((backup) => {
      const createdAt = Date.parse(backup.createdAt);
      return Number.isFinite(createdAt) && now - createdAt <= BACKUP_TTL_MS;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, BACKUP_LIMIT);
}

/**
 * 忽略自动保存时间戳的内容指纹，用于跳过内容完全相同的重复留底。
 */
export function contentSignature(story: StoryDocument): string {
  // updatedAt 由每次保存自动刷新，不代表内容变化，签名时忽略
  return JSON.stringify(story, (key, value) => (key === 'updatedAt' ? undefined : value));
}

export interface RecordBackupResult {
  backups: StoryBackup[];
  /** 实际承载当前内容的留底 id（可能是新建的，也可能是内容相同的已有留底），用于覆盖后一键撤销 */
  backupId: string;
}

/**
 * 在整份内容被替换前留下当前内容的底。
 * 与最近一份留底内容完全相同时不重复创建；最终列表始终经过数量与时长裁剪。
 */
export function recordStoryBackup(
  backups: StoryBackup[],
  story: StoryDocument,
  reason: StoryBackupReason,
  now: number,
): RecordBackupResult {
  const pruned = pruneStoryBackups(backups, now);
  if (pruned.length > 0 && contentSignature(pruned[0].story) === contentSignature(story)) {
    return { backups: pruned, backupId: pruned[0].id };
  }
  const backup: StoryBackup = {
    id: createId('backup'),
    createdAt: new Date(now).toISOString(),
    reason,
    title: story.title,
    story: JSON.parse(JSON.stringify(story)) as StoryDocument,
  };
  return { backups: [backup, ...pruned].slice(0, BACKUP_LIMIT), backupId: backup.id };
}

export interface RestoreBackupResult {
  story: StoryDocument;
  backups: StoryBackup[];
  /** 还原前内容对应的留底 id，用于在通知条上再撤销一次 */
  undoBackupId: string;
}

/**
 * 从留底还原：取出目标内容，同时把「被还原掉的当前内容」也留一份底，
 * 让作者可以在两份内容之间来回切换；被消费的旧留底移除，列表仍受保留策略约束。
 */
export function restoreStoryBackup(
  backups: StoryBackup[],
  backupId: string,
  currentStory: StoryDocument,
  now: number,
): RestoreBackupResult | null {
  const pruned = pruneStoryBackups(backups, now);
  const target = pruned.find((backup) => backup.id === backupId);
  if (!target) return null;
  const remaining = pruned.filter((backup) => backup.id !== backupId);
  const autoEntry = recordStoryBackup(remaining, currentStory, 'restore-backup', now);
  return {
    story: { ...target.story, updatedAt: new Date(now).toISOString() },
    backups: autoEntry.backups,
    undoBackupId: autoEntry.backupId,
  };
}

/**
 * 解析持久化的留底数据，丢弃结构损坏或无法通过故事校验的条目。
 */
export function parseStoryBackups(input: unknown): StoryBackup[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<StoryBackup>;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.title !== 'string'
    ) {
      return [];
    }
    const story = sanitizeStory(candidate.story);
    if (!story) return [];
    const reason: StoryBackupReason = candidate.reason === 'restore-backup' ? 'restore-backup' : 'restore-example';
    return [{ id: candidate.id, createdAt: candidate.createdAt, reason, title: candidate.title, story }];
  });
}
