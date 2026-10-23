import test from 'node:test'
import assert from 'node:assert/strict'
import { agePhrase, duration, exclusionText, mw, percent, signed } from './format.js'

test('gate-time formatting', () => {
  assert.equal(duration(20), '20 min')
  assert.equal(duration(140), '2 h 20 m')
  assert.equal(duration(120), '2 h')
  assert.match(agePhrase(20), /^20-minute-old/)
  assert.equal(mw(undefined), '-')
  assert.equal(signed(-5.4, 1), '−5.4')
  assert.equal(signed(0), '0')
  assert.equal(percent(17.9), '17.9%')
  assert.equal(exclusionText({ outage_half_hours: 3, missing: 0 }), 'outage half hours: 3')
  assert.equal(exclusionText({ missingActual: 2, outageZero: 1 }), 'missing actual: 2 · outage zero: 1')
})
