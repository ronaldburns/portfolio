// One-shot migration: rewrite hardcoded R2 media URLs to relative keys using
// the <Img> / <Video> components. Run: node scripts/migrate-media.mjs
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = 'src/content/projects';
const CDN = 'https://r2-portfolio.ronaldburns.dev';

const isR2 = (url) => url.startsWith(CDN);
const toKey = (url) =>
	decodeURIComponent(url.slice(CDN.length)).replace(/^\/+/, '').trim();
const escAlt = (alt) => alt.replace(/"/g, "'").trim();

let files = (await readdir(DIR)).filter((f) => f.endsWith('.mdx'));
let stats = { files: 0, videos: 0, images: 0, heroes: 0 };

for (const file of files) {
	const path = join(DIR, file);
	let raw = await readFile(path, 'utf8');
	const before = raw;

	// Split frontmatter (---...---) from body so we only touch the body's media.
	const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
	let head = fm ? fm[0] : '';
	let body = fm ? raw.slice(fm[0].length) : raw;

	// Frontmatter hero image -> relative key.
	head = head.replace(/^(image:\s*)(\S+)\s*$/m, (m, k, url) => {
		if (!isR2(url)) return m;
		stats.heroes++;
		return `${k}${toKey(url)}`;
	});

	// <video ...><source src="URL" /></video>  ->  <Video src="KEY" />
	body = body.replace(
		/<video[^>]*>\s*<source\s+src="([^"]+)"\s*\/?>\s*<\/video>/g,
		(m, url) => {
			if (!isR2(url)) return m;
			stats.videos++;
			return `\n\n<Video src="${toKey(url)}" />\n\n`;
		},
	);

	// ![alt](URL)  ->  <Img src="KEY" alt="alt" />   (R2 only; leave other images)
	body = body.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, url) => {
		if (!isR2(url)) return m;
		stats.images++;
		return `\n\n<Img src="${toKey(url)}" alt="${escAlt(alt)}" />\n\n`;
	});

	// Tidy: collapse 3+ blank lines, trim trailing whitespace.
	body = body.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, '');

	raw = head + body;
	if (raw !== before) {
		await writeFile(path, raw);
		stats.files++;
	}
}

console.log(JSON.stringify(stats, null, 2));
