import type { MetadataRoute } from 'next'
import { APP_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Conversations, deal summaries and consent links are personal.
      disallow: ['/api/', '/chat', '/offer/', '/confirm/'],
    },
    sitemap: new URL('/sitemap.xml', APP_URL).toString(),
  }
}
