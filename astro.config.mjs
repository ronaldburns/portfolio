// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import {
	transformerMetaHighlight,
	transformerNotationHighlight,
	transformerNotationDiff,
} from '@shikijs/transformers';

import tailwindcss from '@tailwindcss/vite';
import { remarkReadingTime } from './remark-reading-time.mjs';

// Render an optional `title="..."` in a code fence's meta as a title bar
// (via CSS on [data-code-title]). No-op when no title is given.
function transformerCodeTitle() {
	return {
		name: 'code-title',
		pre(node) {
			const raw = this.options.meta?.__raw ?? '';
			const m = raw.match(/title="([^"]+)"/);
			if (m) node.properties['data-code-title'] = m[1];
		},
	};
}

// Wrap each markdown table in a scroll box, so a wide table scrolls sideways on a phone instead of
// spilling out of the column. Only src/styles/article.css styles the wrapper, so older posts look the same.
function rehypeTableScroll() {
	const wrap = (node) => {
		if (!node.children) return;
		node.children = node.children.map((child) => {
			if (child.type === 'element' && child.tagName === 'table') {
				return { type: 'element', tagName: 'div', properties: { className: ['ar-table'] }, children: [child] };
			}
			wrap(child);
			return child;
		});
	};
	return (tree) => wrap(tree);
}

// https://astro.build/config
export default defineConfig({
  site: 'https://ronaldburns.dev',
  integrations: [mdx(), sitemap()],

  markdown: {
    remarkPlugins: [remarkReadingTime],
    rehypePlugins: [rehypeTableScroll],
    shikiConfig: {
      theme: 'github-dark',
      transformers: [
        transformerMetaHighlight(),
        transformerNotationHighlight(),
        transformerNotationDiff(),
        transformerCodeTitle(),
      ],
    },
  },

  fonts: [
      {
          provider: fontProviders.local(),
          name: 'Atkinson',
          cssVariable: '--font-atkinson',
          fallbacks: ['sans-serif'],
          options: {
              variants: [
                  {
                      src: ['./src/assets/fonts/atkinson-regular.woff'],
                      weight: 400,
                      style: 'normal',
                      display: 'swap',
                  },
                  {
                      src: ['./src/assets/fonts/atkinson-bold.woff'],
                      weight: 700,
                      style: 'normal',
                      display: 'swap',
                  },
              ],
          },
      },
	],

  vite: {
    plugins: [tailwindcss()],
  },
});