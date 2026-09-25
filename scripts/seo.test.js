import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('public SEO assets', () => {
  it('provides canonical metadata and valid structured data in the initial HTML', () => {
    const html = read('index.html')
    expect(html).toContain('<html lang="id">')
    expect(html).toContain('rel="canonical" href="https://pocket.kurousagi.web.id/"')
    const structured = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
    expect(structured['@graph'].map(item => item['@type'])).toEqual(['WebSite', 'SoftwareApplication'])
    const png = readFileSync(new URL('../public/og-cover.png', import.meta.url))
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630])
  })

  it('lists only the public homepage for discovery', () => {
    expect(read('public/sitemap.xml').match(/<loc>.*?<\/loc>/g)).toEqual(['<loc>https://pocket.kurousagi.web.id/</loc>'])
    expect(read('public/robots.txt')).toContain('Sitemap: https://pocket.kurousagi.web.id/sitemap.xml')
  })

  it('marks login, authentication links, and API responses noindex at the server', () => {
    const { headers } = JSON.parse(read('vercel.json'))
    for (const key of ['page', 'token', 'auth', 'error']) {
      expect(headers.some(rule => rule.has?.some(condition => condition.type === 'query' && condition.key === key) && rule.headers.some(header => header.key === 'X-Robots-Tag' && header.value.includes('noindex')))).toBe(true)
    }
    expect(headers.find(rule => rule.source === '/api/(.*)').headers[0].value).toContain('noindex')
  })
})
