export const DOCUMENT_STORAGE_KEY = 'story-architect.document.v1';
export const BACKUP_STORAGE_KEY = 'story-architect.backup.v1';

export interface StorageService {
  read(): string | null;
  write(value: string): void;
}

export class BrowserStorageService implements StorageService {
  constructor(private readonly key: string = DOCUMENT_STORAGE_KEY) {}

  read(): string | null {
    return window.localStorage.getItem(this.key);
  }

  write(value: string): void {
    window.localStorage.setItem(this.key, value);
  }
}

export class MemoryStorageService implements StorageService {
  private value: string | null = null;

  read(): string | null {
    return this.value;
  }

  write(value: string): void {
    this.value = value;
  }
}
