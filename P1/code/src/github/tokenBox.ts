import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Seals GitHub tokens before they are stored, so a copy of the database alone
 * does not give anyone's GitHub access. AES-256-GCM, with a fresh nonce per
 * token; a sealed token is `nonce.tag.ciphertext`, each base64url.
 */
export interface TokenBox {
  seal(token: string): string;
  /** The token, or undefined when it was not sealed with this key or was changed. */
  open(sealed: string): string | undefined;
}

export function tokenBox(secret: string): TokenBox {
  if (secret.length < 32) throw new Error("TOKEN_SECRET must be at least 32 characters.");
  const key = createHash("sha256").update(secret).digest();
  return {
    seal(token) {
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, nonce);
      const sealed = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
      return [nonce, cipher.getAuthTag(), sealed].map((part) => part.toString("base64url")).join(".");
    },
    open(sealed) {
      const [nonce, tag, data] = sealed.split(".").map((part) => Buffer.from(part, "base64url"));
      if (!nonce || !tag || !data || nonce.length !== 12 || tag.length !== 16) return undefined;
      try {
        const decipher = createDecipheriv("aes-256-gcm", key, nonce);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
      } catch {
        return undefined;
      }
    },
  };
}

/**
 * The box configured from the environment, or undefined when TOKEN_SECRET is
 * not set: the server still starts, and sign-in says it is not set up. This
 * is the only place that reads TOKEN_SECRET.
 */
export function tokenBoxFromEnv(): TokenBox | undefined {
  const secret = process.env.TOKEN_SECRET;
  return secret ? tokenBox(secret) : undefined;
}
