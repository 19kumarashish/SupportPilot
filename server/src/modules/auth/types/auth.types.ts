export interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "agent";
  isActive: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}