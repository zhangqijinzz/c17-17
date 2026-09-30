import { createId, type StoryDocument } from '../models/story';
import type { StorageService } from './storageService';

/** 留底份数上限：只保留最近 N 次整体替换前的内容，超出后自动丢弃最旧的一份。 */
export const MAX_BACKUPS = 3;
/** 留底最长保留天数：超过该天数的留底在启动和写入时自动清除。 */
export const BACKUP_MAX_AGE_DAYS = 30;

/**
 * 触发整体替换的原因。留底时记录，便于日后区分「重置前 / 导入前」等场景。
 * 目前只有 reset；将来新增整体替换入口（新建项目、导入项目等）时在此扩展。
 */
export type BackupReason = 'reset';

export interface BackupEntry {
  id: string;
  savedAt: string;
  reason: BackupReason;
  story: StoryDocument;
}

export interface BackupService {
  /** 返回当前仍在保留期内的留底，按保存时间倒序（最新在前）。 */
  list(): BackupEntry[];
  /** 把替换前的完整故事内容留底；若超出份数上限，自动丢弃最旧的留底。 */
  add(story: StoryDocument, reason: BackupReason): BackupEntry;
  /** 恢复完成后移除对应留底。 */
  remove(id: string): void;
  /** 清除超过保留期限的留底。 */
  prune(): void;
}

const MAX_AGE_MS = BACKUP_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

function isBackupEntry(value: unknown): value is BackupEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BackupEntry>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.savedAt === 'string' &&
    candidate.story != null &&
    typeof candidate.story === 'object'
  );
}

export class LocalBackupService implements BackupService {
  constructor(private readonly storage: StorageService) {}

  list(): BackupEntry[] {
    const cutoff = Date.now() - MAX_AGE_MS;
    return this.readAll()
      .filter((entry) => {
        const time = new Date(entry.savedAt).getTime();
        return Number.isFinite(time) && time >= cutoff;
      })
      .sort((a, b) => {
        if (a.savedAt === b.savedAt) return 0;
        return a.savedAt < b.savedAt ? 1 : -1;
      });
  }

  add(story: StoryDocument, reason: BackupReason): BackupEntry {
    const entry: BackupEntry = {
      id: createId('backup'),
      savedAt: new Date().toISOString(),
      reason,
      story,
    };
    const next = [entry, ...this.readAll()].slice(0, MAX_BACKUPS);
    this.writeAll(next);
    return entry;
  }

  remove(id: string): void {
    this.writeAll(this.readAll().filter((entry) => entry.id !== id));
  }

  prune(): void {
    const valid = this.list();
    if (valid.length !== this.readAll().length) this.writeAll(valid);
  }

  private readAll(): BackupEntry[] {
    const raw = this.storage.read();
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isBackupEntry);
    } catch {
      return [];
    }
  }

  private writeAll(entries: BackupEntry[]): void {
    this.storage.write(JSON.stringify(entries));
  }
}
