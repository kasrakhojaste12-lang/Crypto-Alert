import jwt from 'jsonwebtoken'

// Stateless password-reset tokens: a JWT keyed by JWT_SECRET + the user's
// current password hash. The key changes the instant the password changes, so
// a reset link works exactly once and needs no DB table.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const key = (passwordHash: string) => `${JWT_SECRET}.${passwordHash}`

export function signReset(userId: string, passwordHash: string) {
  return jwt.sign({ sub: userId, purpose: 'pwreset' }, key(passwordHash), { expiresIn: '30m' })
}

// The subject (user id) is needed to load the user (and thus the hash) before
// we can verify — read it without verifying, then verifyReset confirms it.
export function resetSubject(token: string): string | null {
  const d = jwt.decode(token) as { sub?: string } | null
  return d?.sub ?? null
}

// Valid only if the token matches this user's current hash (i.e. still unused).
export function verifyReset(token: string, userId: string, passwordHash: string): boolean {
  try {
    const v = jwt.verify(token, key(passwordHash)) as { sub?: string; purpose?: string }
    return v.purpose === 'pwreset' && v.sub === userId
  } catch {
    return false
  }
}
