import {
  SignJWT,
  jwtVerify,
  type JWTPayload,
} from "jose";

import { env } from "../../config/env.js";

const accessSecret = new TextEncoder().encode(
  env.JWT_ACCESS_SECRET,
);

const refreshSecret = new TextEncoder().encode(
  env.JWT_REFRESH_SECRET,
);

export interface AccessTokenPayload extends JWTPayload {
  userId: string;
  organizationId: string;
  role: "admin" | "agent";
  type: "access";
}

export interface RefreshTokenPayload extends JWTPayload {
  userId: string;
  organizationId: string;
  type: "refresh";
}

export async function generateAccessToken(
  payload: Omit<AccessTokenPayload, "iat" | "exp">,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(accessSecret);
}

export async function generateRefreshToken(
  payload: Omit<RefreshTokenPayload, "iat" | "exp">,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(refreshSecret);
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, accessSecret, {
    algorithms: ["HS256"],
  });

  return payload as AccessTokenPayload;
}

export async function verifyRefreshToken(
  token: string,
): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, refreshSecret, {
    algorithms: ["HS256"],
  });

  return payload as RefreshTokenPayload;
}