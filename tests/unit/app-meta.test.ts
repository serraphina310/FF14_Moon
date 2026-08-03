import { describe, expect, it } from 'vitest'
import { APP_NAME, APP_PHASE } from '../../src/app-meta'

describe('application metadata', () => {
  it('identifies the validated browser technical phase', () => {
    expect(APP_NAME).toBe('FF14_Moon')
    expect(APP_PHASE).toBe('browser-technical-validated')
  })
})
