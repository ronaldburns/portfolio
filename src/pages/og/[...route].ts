import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';
import sharp from 'sharp';
import { originalUrl } from '../../lib/images';

const entries = (await getCollection('projects')).filter((p) => p.data.published !== false);

// Key each OG image by the entry id -> /og/<id>.png
const pages = Object.fromEntries(entries.map((e) => [e.id, e.data]));

// --- Cinematic backgrounds -------------------------------------------------
// astro-og-canvas can only draw a flat gradient or a raw bgImage, so we bake
// the polish in ourselves: each hero image is downscaled, heavily blurred and
// darkened, then a radial vignette + bottom gradient are composited on top so
// the title/description always sit on a legible dark band. The result is fed
// back in as the card's `bgImage`. Runs at build time (Node), output PNGs are
// static — nothing here touches the Cloudflare Worker runtime.

const OG_W = 1200;
const OG_H = 630;
const BG_DIR = path.join(process.cwd(), 'node_modules', '.cache', 'og-bg');

// Vignette + bottom-fade overlay, baked once (same for every card).
const overlay = Buffer.from(
	`<svg width="${OG_W}" height="${OG_H}" xmlns="http://www.w3.org/2000/svg">
		<defs>
			<radialGradient id="vig" cx="50%" cy="42%" r="78%">
				<stop offset="50%" stop-color="#09090b" stop-opacity="0"/>
				<stop offset="100%" stop-color="#09090b" stop-opacity="0.78"/>
			</radialGradient>
			<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
				<stop offset="45%" stop-color="#09090b" stop-opacity="0.1"/>
				<stop offset="100%" stop-color="#09090b" stop-opacity="0.9"/>
			</linearGradient>
		</defs>
		<rect width="100%" height="100%" fill="#09090b" opacity="0.3"/>
		<rect width="100%" height="100%" fill="url(#vig)"/>
		<rect width="100%" height="100%" fill="url(#fade)"/>
		<rect x="0" y="0" width="12" height="100%" fill="#fb923c"/>
	</svg>`,
);

// Signature of the look (overlay + pipeline). Bump-free cache busting: any
// tweak to the overlay below changes this, so stale backgrounds regenerate.
const RECIPE = createHash('sha1').update(overlay).update('b0.62-s0.9-blur26').digest('hex').slice(0, 6);

/** Build (or reuse a cached) blurred, vignetted background for one hero image. */
async function buildBackground(id: string, src: string): Promise<string | null> {
	const hash = createHash('sha1').update(src).digest('hex').slice(0, 8);
	const out = path.join(BG_DIR, `${id.replace(/[^\w-]/g, '-')}-${hash}-${RECIPE}.png`);
	if (existsSync(out)) return out;
	try {
		const res = await fetch(originalUrl(src));
		if (!res.ok) return null;
		const input = Buffer.from(await res.arrayBuffer());
		const png = await sharp(input)
			.resize(OG_W, OG_H, { fit: 'cover', position: 'attention' })
			.modulate({ brightness: 0.62, saturation: 0.9 })
			.blur(26)
			.composite([{ input: overlay, top: 0, left: 0 }])
			.png()
			.toBuffer();
		await mkdir(BG_DIR, { recursive: true });
		await writeFile(out, png);
		return out;
	} catch {
		return null; // fall back to the gradient card
	}
}

await mkdir(BG_DIR, { recursive: true });
const backgrounds = new Map<string, string>();
await Promise.all(
	entries.map(async (e) => {
		if (!e.data.image) return;
		const bg = await buildBackground(e.id, e.data.image);
		if (bg) backgrounds.set(e.id, bg);
	}),
);

export const { getStaticPaths, GET } = await OGImageRoute({
	param: 'route',
	pages,
	getImageOptions: (path, page) => {
		const bg = backgrounds.get(path);
		return {
			title: page.title,
			description: page.description,
			logo: undefined,
			// Cinematic blurred hero when we have one; brand gradient otherwise.
			...(bg
				? { bgImage: { path: bg, fit: 'cover' as const } }
				: {
						bgGradient: [
							[9, 9, 11],
							[24, 24, 27],
						] as [number, number, number][],
					}),
			border: { color: [251, 146, 60], width: 12, side: 'inline-start' },
			padding: 60,
			font: {
				title: { color: [250, 250, 250], size: 64, weight: 'Bold' },
				description: { color: [228, 228, 231], size: 30 },
			},
			format: 'PNG',
		};
	},
});
