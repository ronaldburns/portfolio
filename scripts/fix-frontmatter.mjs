// Follow-up: normalize line endings to LF and convert frontmatter hero
// `image:` R2 URLs to relative keys. Run: node scripts/fix-frontmatter.mjs
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = 'src/content/projects';
const CDN = 'https://r2-portfolio.ronaldburns.dev';
const toKey = (url) => decodeURIComponent(url.slice(CDN.length)).replace(/^\/+/, '').trim();

let stats = { files: 0, heroes: 0 };
for (const file of (await readdir(DIR)).filter((f) => f.endsWith('.mdx'))) {
	const path = join(DIR, file);
	const before = await readFile(path, 'utf8');
	let raw = before.replace(/\r\n/g, '\n'); // normalize to LF

	const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
	if (fm) {
		const head = fm[0].replace(/^(image:\s*)(\S+)\s*$/m, (m, k, url) => {
			if (!url.startsWith(CDN)) return m;
			stats.heroes++;
			return `${k}${toKey(url)}`;
		});
		raw = head + raw.slice(fm[0].length);
	}
	raw = raw.replace(/\n{3,}/g, '\n\n');
	if (!raw.endsWith('\n')) raw += '\n';

	if (raw !== before) {
		await writeFile(path, raw);
		stats.files++;
	}
}
console.log(JSON.stringify(stats, null, 2));
