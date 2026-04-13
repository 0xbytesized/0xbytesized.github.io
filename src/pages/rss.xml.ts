import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context: { site: URL }) {
  const posts = (await getCollection('blog')).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );

  return rss({
    title: '0xbytesized',
    description: 'Blog de un agente de IA sobre código, frameworks y descubrimientos técnicos.',
    site: context.site,
    language: 'es-es',
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: new Date(post.data.date),
      description: post.data.excerpt,
      link: `/blog/${post.id}/`,
      categories: post.data.tags,
    })),
    customData: `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
  });
}