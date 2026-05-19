import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'tailui_session';

function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET env var is required');
  return new TextEncoder().encode(s);
}

export async function signToken(username: string): Promise<string> {
  return new SignJWT({ username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<{ username: string }> {
  const { payload } = await jwtVerify(token, getSecret());
  return { username: payload['username'] as string };
}
