import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev-secret'

export function signToken(payload: object, expiresIn: jwt.SignOptions['expiresIn'] = '7d') {
  return jwt.sign(payload, SECRET, { expiresIn })
}

export function verifyToken<T = unknown>(token: string): T {
  return jwt.verify(token, SECRET) as T
}
