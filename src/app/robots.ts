import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/admin/', // 🛡️ Keeps Google away from your private admin dashboard!
    },
    sitemap: 'https://khaaliclass.vercel.app/sitemap.xml',
  }
}