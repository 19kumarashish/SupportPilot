import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { Readable } from "node:stream";

import { env } from "../../config/env.js";
import type { AttachmentStorageProvider } from "./attachment-storage.js";

const storageRoot = (): string =>
  resolve(env.ATTACHMENT_STORAGE_PATH ?? resolve(process.cwd(), "private-uploads"));

const getStoragePath = (key: string): string => {
  if (!/^[a-zA-Z0-9._/-]+$/.test(key) || key.includes("..")) {
    throw new Error("Invalid attachment storage key");
  }
  const root = storageRoot();
  const path = resolve(root, key);
  const relativePath = relative(root, path);
  if (
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    throw new Error("Attachment path escaped storage root");
  }
  return path;
};

const listFiles = async (directory: string): Promise<string[]> => {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
};

export class LocalAttachmentStorage implements AttachmentStorageProvider {
  async upload(key: string, contents: Buffer): Promise<void> {
    const path = getStoragePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, { flag: "wx", mode: 0o600 });
  }

  async getDownloadStream(key: string): Promise<Readable> {
    const path = getStoragePath(key);
    await stat(path);
    return createReadStream(path);
  }

  async delete(key: string): Promise<void> {
    await rm(getStoragePath(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(getStoragePath(key));
      return true;
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  async listKeysByPrefix(prefix: string): Promise<string[]> {
    const root = storageRoot();
    const files = await listFiles(root);
    return files
      .map((file) => relative(root, file).split("\\").join("/"))
      .filter((key) => key.startsWith(prefix));
  }

  async get(key: string): Promise<Buffer> {
    return readFile(getStoragePath(key));
  }
}
