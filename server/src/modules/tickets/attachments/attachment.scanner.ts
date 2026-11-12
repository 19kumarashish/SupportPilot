import { env } from "../../../config/env.js";
import { createConnection } from "node:net";

export type MalwareScanResult = "clean" | "infected";

export interface MalwareScanner {
  scan(input: {
    contents: Buffer;
    filename: string;
    contentType: string;
  }): Promise<MalwareScanResult>;
}

export class NoopMalwareScanner implements MalwareScanner {
  async scan(): Promise<MalwareScanResult> {
    return "clean";
  }
}

class HttpMalwareScanner implements MalwareScanner {
  constructor(private readonly url: string, private readonly apiKey?: string) {}

  async scan(input: {
    contents: Buffer;
    filename: string;
    contentType: string;
  }): Promise<MalwareScanResult> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        filename: input.filename,
        contentType: input.contentType,
        contentsBase64: input.contents.toString("base64"),
      }),
    });
    if (!response.ok) {
      throw new Error(`Malware scanner returned HTTP ${response.status}`);
    }
    const result: unknown = await response.json();
    if (
      typeof result !== "object" ||
      result === null ||
      !("status" in result) ||
      (result.status !== "clean" && result.status !== "infected")
    ) {
      throw new Error("Malware scanner returned an invalid status");
    }
    return result.status;
  }
}

export class ClamAvMalwareScanner implements MalwareScanner {
  async scan(input: {
    contents: Buffer;
    filename: string;
    contentType: string;
  }): Promise<MalwareScanResult> {
    void input.filename;
    void input.contentType;
    return new Promise<MalwareScanResult>((resolve, reject) => {
      const socket = createConnection({
        host: env.CLAMAV_HOST,
        port: env.CLAMAV_PORT,
      });
      const chunks: Buffer[] = [];
      socket.on("data", (chunk: Buffer) => chunks.push(chunk));
      socket.once("error", reject);
      socket.once("close", () => {
        const response = Buffer.concat(chunks).toString("utf8").trim();
        if (response.endsWith("OK")) resolve("clean");
        else if (response.includes("FOUND")) resolve("infected");
        else reject(new Error(`ClamAV returned an invalid response: ${response}`));
      });
      socket.once("connect", () => {
        socket.write("zINSTREAM\0");
        for (let offset = 0; offset < input.contents.length; offset += 64 * 1024) {
          const chunk = input.contents.subarray(offset, offset + 64 * 1024);
          const length = Buffer.alloc(4);
          length.writeUInt32BE(chunk.length);
          socket.write(length);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4));
        socket.end();
      });
    });
  }
}

export const malwareScanner: MalwareScanner = (() => {
  if (env.MALWARE_SCANNER_DRIVER === "http") {
    return new HttpMalwareScanner(env.MALWARE_SCANNER_URL!, env.MALWARE_SCANNER_API_KEY);
  }
  if (env.MALWARE_SCANNER_DRIVER === "clamav") {
    return new ClamAvMalwareScanner();
  }
  return new NoopMalwareScanner();
})();
