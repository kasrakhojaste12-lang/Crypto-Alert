import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from './jwt'

export interface AuthedRequest extends Request {
  userId?: string
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  try {
    const { sub } = verifyToken<{ sub: string }>(token)
    req.userId = sub
    next()
  } catch {
    res.status(401).json({ error: 'unauthorized' })
  }
}
