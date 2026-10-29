import assert from 'node:assert/strict'
import { verifyGatewaySignature } from '@/lib/services/gateway.service'

console.log('Testing gateway signature calculation against official test vector...')

// Test vector from brief:
// source: idbill_8f3a2c|paidtrue|paid_amount210050|paid_at2026-04-01 00:30:12 +0800|transaction_idTX-000123|transaction_statuscompleted
// signature: 06994fab2d674e7829144eaa2204631716d3c099b503d38945e92b6296531641
// key: test_x_signature_key

const fields = {
  id: 'bill_8f3a2c',
  paid: 'true',
  paid_amount: '210050',
  paid_at: '2026-04-01 00:30:12 +0800',
  transaction_id: 'TX-000123',
  transaction_status: 'completed',
}

const key = 'test_x_signature_key'
const expectedSignature = '06994fab2d674e7829144eaa2204631716d3c099b503d38945e92b6296531641'

// 1. Valid signature
const valid = verifyGatewaySignature(fields, expectedSignature, key)
assert.equal(valid, true, 'Official test vector signature must be valid')
console.log('✔ Official HMAC-SHA256 test vector passed.')

// 2. Tampered field (amount changed)
const tamperedFields = { ...fields, paid_amount: '210051' }
const invalidAmount = verifyGatewaySignature(tamperedFields, expectedSignature, key)
assert.equal(invalidAmount, false, 'Tampered amount must fail signature verification')
console.log('✔ Tampered payload rejected.')

// 3. Forged signature
const invalidSig = verifyGatewaySignature(fields, '0000000000000000000000000000000000000000000000000000000000000000', key)
assert.equal(invalidSig, false, 'Wrong signature must fail')
console.log('✔ Invalid signature rejected.')

// 4. Missing signature
const missingSig = verifyGatewaySignature(fields, undefined, key)
assert.equal(missingSig, false, 'Missing signature must fail')
console.log('✔ Missing signature rejected.')

console.log('ALL GATEWAY SIGNATURE TESTS PASSED! 🎉')

