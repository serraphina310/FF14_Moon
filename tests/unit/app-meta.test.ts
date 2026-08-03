import { describe, expect, it } from 'vitest'
import { APP_NAME, APP_PHASE } from '../../src/app-meta'

describe('application metadata', () => {
  it('identifies the completed result and reliability phase', () => {
    expect(APP_NAME).toBe('FF14_Moon')
    expect(APP_PHASE).toBe('results-reliability-complete')
  })
})
