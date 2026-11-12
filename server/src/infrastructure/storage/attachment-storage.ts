import type { Readable } from "node:stream";

export interface AttachmentStorageProvider {
  upload(key: string, contents: Buffer, contentType: string): Promise<void>;
  getDownloadStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  listKeysByPrefix(prefix: string): Promise<string[]>;
}
