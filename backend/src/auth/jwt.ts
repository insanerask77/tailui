import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'tailui_session';

export interface JwtPayload {
  username: string;
  role: 'admin' | 'user';
  namespace: string | null;
}

function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET env var is required');
  return new TextEncoder().encode(s);
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return {
    username:  payload['username']  as string,
    role:      (payload['role']      as 'admin' | 'user') ?? 'admin',
    namespace: (payload['namespace'] as string | null)    ?? null,
  };
}
