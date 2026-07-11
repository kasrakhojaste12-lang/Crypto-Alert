import assert from 'node:assert'
import { googleEmail, isGoogleAccount, markGooglePassword, passwordDigest, preserveGoogleLogin } from './google'

assert.deepEqual(googleEmail({ email: 'User@Gmail.com', email_verified: true }), {
  email: 'user@gmail.com', authoritative: true,
})
assert.deepEqual(googleEmail({ email: 'user@example.com', email_verified: true, hd: 'example.com' }), {
  email: 'user@example.com', authoritative: true,
})
assert.deepEqual(googleEmail({ email: 'user@example.com', email_verified: true }), {
  email: 'user@example.com', authoritative: false,
})
assert.equal(googleEmail({ email_verified: true }), null)
assert.equal(googleEmail({ email: 'user@gmail.com', email_verified: false }), null)
assert.equal(isGoogleAccount(markGooglePassword('hash')), true)
assert.equal(passwordDigest(markGooglePassword('hash')), 'hash')
assert.equal(preserveGoogleLogin(markGooglePassword('old'), 'new'), markGooglePassword('new'))
assert.equal(preserveGoogleLogin('old', 'new'), 'new')

console.log('google.test: all assertions passed ✓')
