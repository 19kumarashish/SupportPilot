import { LocalAttachmentStorage } from "../../../infrastructure/storage/local-attachment-storage.js";

export interface AttachmentStorage {
  put(key: string, contents: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const storage = new LocalAttachmentStorage();

export const localAttachmentStorage: AttachmentStorage = {
  put: (key, contents) => storage.upload(key, contents),
  get: (key) => storage.get(key),
  delete: (key) => storage.delete(key),
};
