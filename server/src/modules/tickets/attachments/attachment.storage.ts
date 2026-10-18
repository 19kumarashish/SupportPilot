import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface AttachmentStorage {
  put(key: string, contents: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const getStoragePath = (key: string): string => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
    throw new Error("Invalid server-generated attachment key");
  }

  const root = resolve(
    process.env.ATTACHMENT_STORAGE_PATH ?? resolve(process.cwd(), "private-uploads"),
  );
  const path = resolve(root, key);
  if (dirname(path) !== root) {
    throw new Error("Attachment path escaped storage root");
  }
  return path;
};

export const localAttachmentStorage: AttachmentStorage = {
  async put(key, contents) {
    const path = getStoragePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, { flag: "wx", mode: 0o600 });
  },

  async get(key) {
    return readFile(getStoragePath(key));
  },

  async delete(key) {
    await rm(getStoragePath(key), { force: true });
  },
};
