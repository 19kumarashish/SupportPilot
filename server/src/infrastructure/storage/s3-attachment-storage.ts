import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";

import { env } from "../../config/env.js";
import type { AttachmentStorageProvider } from "./attachment-storage.js";

export class S3AttachmentStorage implements AttachmentStorageProvider {
  private readonly client = new S3Client({
    region: env.S3_REGION!,
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
    forcePathStyle: Boolean(env.S3_ENDPOINT),
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? "",
    },
  });

  async upload(key: string, contents: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: contents,
      ContentType: contentType,
    }));
  }

  async getDownloadStream(key: string): Promise<Readable> {
    const result = await this.client.send(new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    }));
    if (!result.Body) throw new Error("S3 attachment response had no body");
    return result.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "NotFound") return false;
      throw error;
    }
  }

  async listKeysByPrefix(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const result = await this.client.send(new ListObjectsV2Command({
        Bucket: env.S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }));
      keys.push(...(result.Contents ?? []).flatMap((item) => item.Key ? [item.Key] : []));
      continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (continuationToken);
    return keys;
  }
}
