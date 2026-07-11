export type GoogleClaims = {
  email?: string
  email_verified?: boolean
  hd?: string
}

const GOOGLE_PASSWORD_PREFIX = 'google:'

export const isGoogleAccount = (hash: string) => hash.startsWith(GOOGLE_PASSWORD_PREFIX)
export const passwordDigest = (hash: string) => isGoogleAccount(hash) ? hash.slice(GOOGLE_PASSWORD_PREFIX.length) : hash
export const preserveGoogleLogin = (current: string, hash: string) => isGoogleAccount(current) ? `${GOOGLE_PASSWORD_PREFIX}${hash}` : hash
export const markGooglePassword = (hash: string) => `${GOOGLE_PASSWORD_PREFIX}${hash}`

export function googleEmail(claims: GoogleClaims): { email: string; authoritative: boolean } | null {
  if (!claims.email || claims.email_verified !== true) return null
  const email = claims.email.toLowerCase()
  const domain = email.split('@')[1]
  return {
    email,
    authoritative: domain === 'gmail.com' || (!!claims.hd && claims.hd.toLowerCase() === domain),
  }
}
