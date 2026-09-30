const STORAGE_KEY = 'story-architect.document.v1';
const BACKUP_STORAGE_KEY = 'story-architect.backups.v1';

export interface StorageService {
  read(): string | null;
  write(value: string): void;
  readBackups(): string | null;
  writeBackups(value: string): void;
}

export class BrowserStorageService implements StorageService {
  read(): string | null {
    return window.localStorage.getItem(STORAGE_KEY);
  }

  write(value: string): void {
    window.localStorage.setItem(STORAGE_KEY, value);
  }

  readBackups(): string | null {
    return window.localStorage.getItem(BACKUP_STORAGE_KEY);
  }

  writeBackups(value: string): void {
    window.localStorage.setItem(BACKUP_STORAGE_KEY, value);
  }
}

export class MemoryStorageService implements StorageService {
  private value: string | null = null;
  private backups: string | null = null;

  read(): string | null {
    return this.value;
  }

  write(value: string): void {
    this.value = value;
  }

  readBackups(): string | null {
    return this.backups;
  }

  writeBackups(value: string): void {
    this.backups = value;
  }
}
