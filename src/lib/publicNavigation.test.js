import { expect, it } from 'vitest'
import { getPublicPage } from './publicNavigation'

it.each([
  ['', 'home'], ['?page=login', 'login'], ['?page=register', 'register'],
  ['?page=invalid', 'home'], ['?auth=email-verified', 'login'],
  ['?auth=reset-password&token=example', 'login'], ['?error=expired', 'login'],
  ['?page=register&token=example', 'login'],
])('routes public entry %s to %s without breaking auth callbacks', (search, page) => {
  expect(getPublicPage(search)).toBe(page)
})
