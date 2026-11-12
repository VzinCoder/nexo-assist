import { employeeIdSchema, employeeRoleSchema, type EmployeeRole } from "@nexo/shared";
import { z } from "zod";

/**
 * Sessão sem biblioteca: `base64url(json) + "." + base64url(HMAC-SHA256)`, assinada com Web Crypto
 * (funciona no proxy e nas rotas). Cookie httpOnly, SameSite=Lax, expira em 8 h.
 */
export const SESSION_COOKIE = "nexo_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const sessionPayloadSchema = z.object({
  employeeId: employeeIdSchema,
  role: employeeRoleSchema,
  name: z.string().min(1),
  email: z.string().min(1),
  exp: z.number().int(),
});
export type Session = z.infer<typeof sessionPayloadSchema>;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  return new Uint8Array(Buffer.from(value, "base64url"));
}

const keyCache = new Map<string, Promise<CryptoKey>>();
function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret);
  if (!key) {
    key = crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
      "verify",
    ]);
    keyCache.set(secret, key);
  }
  return key;
}

export async function signSession(session: Session, secret: string): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify(session)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/** Devolve a sessão se a assinatura confere e não expirou; senão `null`. */
export async function verifySession(
  token: string | undefined | null,
  secret: string,
  now: Date,
): Promise<Session | null> {
  if (!token) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const signatureBytes = fromBase64Url(signature);
  const bodyBytes = fromBase64Url(body);
  if (!signatureBytes || !bodyBytes) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    signatureBytes as Uint8Array<ArrayBuffer>,
    encoder.encode(body),
  );
  if (!valid) return null;
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch {
    return null;
  }
  const parsed = sessionPayloadSchema.safeParse(json);
  if (!parsed.success || parsed.data.exp <= now.getTime()) return null;
  return parsed.data;
}

export function newSession(
  employee: { id: string; role: EmployeeRole; name: string; email: string },
  now: Date,
): Session {
  return {
    employeeId: employee.id,
    role: employee.role,
    name: employee.name,
    email: employee.email,
    exp: now.getTime() + SESSION_TTL_MS,
  };
}

export function isAnalyst(role: EmployeeRole): boolean {
  return role !== "employee";
}

/** Página inicial por papel. */
export function homeFor(role: EmployeeRole): "/chat" | "/console" {
  return isAnalyst(role) ? "/console" : "/chat";
}

export function sessionCookieHeader(token: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookieHeader(secure: boolean): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** Lê um cookie do header `Cookie`. */
export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    if (pair.slice(0, index).trim() === name) return pair.slice(index + 1).trim();
  }
  return undefined;
}

export function getSessionFromRequest(request: Request, secret: string, now: Date): Promise<Session | null> {
  return verifySession(readCookie(request.headers.get("cookie"), SESSION_COOKIE), secret, now);
}
