import type { RequestHandler } from "express";
import { rateLimit, type Options, type Store } from "express-rate-limit";
import { Redis } from "ioredis";
import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";

class RedisFixedWindowStore implements Store {
  private readonly client: Redis;
  readonly prefix: string;
  private windowMs: number;

  constructor(prefix: string, windowMs: number) {
    this.client = new Redis(env.REDIS_URL ?? "redis://127.0.0.1:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    this.prefix = prefix;
    this.windowMs = windowMs;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string) {
    if (this.client.status !== "ready") {
      await this.client.connect().catch(() => undefined);
    }

    if (this.client.status !== "ready") {
      throw new Error("Rate-limit store is unavailable");
    }

    const redisKey = `${this.prefix}:${key}`;
    const count = await this.client.incr(redisKey);
    if (count === 1) {
      await this.client.pexpire(redisKey, this.windowMs);
    }
    const ttl = await this.client.pttl(redisKey);
    return {
      totalHits: count,
      resetTime: new Date(Date.now() + Math.max(ttl, 0)),
    };
  }

  localKeys = false;

  async get(key: string) {
    if (this.client.status !== "ready") return undefined;
    const count = await this.client.get(`${this.prefix}:${key}`);
    const ttl = await this.client.pttl(`${this.prefix}:${key}`);
    if (count === null) return undefined;
    return {
      totalHits: Number(count),
      resetTime: ttl > 0 ? new Date(Date.now() + ttl) : undefined,
    };
  }

  decrement(key: string): void {
    void this.client.decr(`${this.prefix}:${key}`);
  }

  resetKey(key: string): void {
    void this.client.del(`${this.prefix}:${key}`);
  }

  resetAll(): void {
    void this.client.keys(`${this.prefix}:*`).then((keys) => {
      if (keys.length > 0) void this.client.del(...keys);
    });
  }

  async shutdown() {
    await this.client.quit().catch(() => undefined);
  }
}

const rejectLimit = () => {
  throw new AppError(
    429,
    "RATE_LIMIT_EXCEEDED",
    "Too many requests. Please retry later.",
  );
};

export const createApiRateLimiters = (): {
  apiLimiter: RequestHandler;
  loginLimiter: RequestHandler;
  signupLimiter: RequestHandler;
  verificationLimiter: RequestHandler;
} => {
  if (env.NODE_ENV === "test") {
    const noOp: RequestHandler = (_request, _response, next) => next();
    return {
      apiLimiter: noOp,
      loginLimiter: noOp,
      signupLimiter: noOp,
      verificationLimiter: noOp,
    };
  }

  const redisStore = (prefix: string): Store | undefined => env.REDIS_URL
    ? new RedisFixedWindowStore(prefix, 60_000)
    : undefined;
  const withStore = (prefix: string): { store: Store } | Record<string, never> => {
    const store = redisStore(prefix);
    return store ? { store } : {};
  };
  const common: Partial<Options> = {
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, _response, _next, _options) => rejectLimit(),
  };

  const apiLimiter: RequestHandler = rateLimit({
    ...common,
    windowMs: 60_000,
    limit: 300,
    ...withStore("supportpilot:rate:api"),
  });

  const loginLimiter: RequestHandler = rateLimit({
    ...common,
    windowMs: 15 * 60_000,
    limit: 10,
    ...withStore("supportpilot:rate:login"),
  });

  const signupLimiter: RequestHandler = rateLimit({
    ...common,
    windowMs: 60 * 60_000,
    limit: 5,
    ...withStore("supportpilot:rate:signup"),
  });

  const verificationLimiter: RequestHandler = rateLimit({
    ...common,
    windowMs: 15 * 60_000,
    limit: 10,
    ...withStore("supportpilot:rate:verification"),
  });

  return { apiLimiter, loginLimiter, signupLimiter, verificationLimiter };
};
