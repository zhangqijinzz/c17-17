import { useState } from 'react';
import type { BackupEntry } from '../services/backupService';

interface RecoveryBannerProps {
  backups: BackupEntry[];
  onRestore: (backupId?: string) => void;
}

const REASON_LABELS: Record<BackupEntry['reason'], string> = {
  reset: '重置前',
};

function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '未知时间';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function RecoveryBanner({ backups, onRestore }: RecoveryBannerProps) {
  const [showList, setShowList] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || backups.length === 0) return null;

  const latest = backups[0];
  return (
    <div className="recovery-banner" role="status">
      <div className="recovery-main">
        <strong>↩ 找到 {backups.length} 份重置前的留底</strong>
        <span>
          最近一份保存于 {formatSavedAt(latest.savedAt)}，可恢复到重置前的内容。留底保留 30
          天、最多 3 份，恢复后该份留底自动移除。
        </span>
      </div>
      <div className="recovery-actions">
        <button className="recovery-primary" onClick={() => onRestore()}>
          恢复刚才的内容
        </button>
        <button className="recovery-toggle" onClick={() => setShowList((value) => !value)}>
          {showList ? '收起列表' : '选择留底'}
        </button>
        <button className="recovery-dismiss" onClick={() => setDismissed(true)} aria-label="关闭提示">
          ×
        </button>
      </div>
      {showList && (
        <ul className="backup-list">
          {backups.map((backup) => (
            <li key={backup.id}>
              <span className="backup-meta">
                {REASON_LABELS[backup.reason]} · {formatSavedAt(backup.savedAt)} · 《{backup.story.title}》 ·{' '}
                {backup.story.characters.length} 人物 / {backup.story.scenes.length} 场景
              </span>
              <button onClick={() => onRestore(backup.id)}>恢复这份</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
