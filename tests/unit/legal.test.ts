import { describe, expect, it } from 'vitest'
import { correspondingSourceUrl } from '../../src/legal'

describe('corresponding source link', () => {
  it('links a deployed build to its exact source revision', () => {
    expect(
      correspondingSourceUrl(
        'https://github.com/example/ff14-moon/',
        '0123456789abcdef',
      ),
    ).toBe('https://github.com/example/ff14-moon/tree/0123456789abcdef')
  })

  it('falls back to the repository when a revision is unavailable', () => {
    expect(correspondingSourceUrl('https://github.com/example/ff14-moon')).toBe(
      'https://github.com/example/ff14-moon',
    )
    expect(correspondingSourceUrl()).toBeUndefined()
  })
})
