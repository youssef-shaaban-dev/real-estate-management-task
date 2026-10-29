import assert from 'node:assert/strict'
import { jsonError } from '@/lib/auth'

console.log('Testing auth utilities...')

// Test jsonError structure
const res401 = jsonError('Unauthorized', 401)
assert.equal(res401.status, 401)

const res403 = jsonError('Forbidden', 403)
assert.equal(res403.status, 403)

const res404 = jsonError('Not found', 404)
assert.equal(res404.status, 404)

console.log('✔ jsonError response format verified.')
console.log('ALL AUTH UTILITIES TESTS PASSED! 🎉')

