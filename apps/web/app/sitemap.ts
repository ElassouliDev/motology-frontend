import type { MetadataRoute } from 'next'
import { APP_URL } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: new URL('/', APP_URL).toString(), changeFrequency: 'weekly', priority: 1 },
    { url: new URL('/search', APP_URL).toString(), changeFrequency: 'daily', priority: 0.8 },
  ]
}
