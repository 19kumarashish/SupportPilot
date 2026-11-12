import { env } from "../../config/env.js";
import type { AttachmentStorageProvider } from "./attachment-storage.js";
import { LocalAttachmentStorage } from "./local-attachment-storage.js";
import { S3AttachmentStorage } from "./s3-attachment-storage.js";

export const attachmentStorageDriver = env.STORAGE_DRIVER;
export const attachmentStorage: AttachmentStorageProvider =
  env.STORAGE_DRIVER === "s3"
    ? new S3AttachmentStorage()
    : new LocalAttachmentStorage();
