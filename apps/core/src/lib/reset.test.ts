// Self-check for the password-reset security invariant. `npm test` runs this.
import assert from 'node:assert'
import { signReset, verifyReset, resetSubject } from './reset'

const hash1 = '$2a$10$oldhashaaaaaaaaaaaaaaaaaa'
const hash2 = '$2a$10$newhashbbbbbbbbbbbbbbbbbb'
const uid = 'user_123'

const token = signReset(uid, hash1)
assert.equal(resetSubject(token), uid, 'subject is the user id')
assert.equal(verifyReset(token, uid, hash1), true, 'valid for the current hash')
assert.equal(verifyReset(token, uid, hash2), false, 'invalid once the password (hash) changes — single use')
assert.equal(verifyReset(token, 'someone_else', hash1), false, 'token is bound to its subject')
assert.equal(verifyReset('garbage.token.here', uid, hash1), false, 'garbage token rejected')
assert.equal(resetSubject('not-a-jwt'), null, 'undecodable token -> null subject')

console.log('reset.test: all assertions passed ✓')
