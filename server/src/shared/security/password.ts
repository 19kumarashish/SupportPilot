import bcrypt from "bcryptjs";

async function loadArgon2() {
  try {
    const module = await import("argon2");
    return module.default ?? module;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const argon2 = await loadArgon2();

  if (argon2) {
    return argon2.hash(password, {
      type: argon2.argon2id,
    });
  }

  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  if (passwordHash.startsWith("$argon2")) {
    const argon2 = await loadArgon2();

    if (!argon2) {
      throw new Error(
        "Argon2 native dependency is unavailable in this environment. Please migrate the stored hash to bcrypt before continuing.",
      );
    }

    return argon2.verify(passwordHash, password);
  }

  return bcrypt.compare(password, passwordHash);
}