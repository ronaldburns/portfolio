import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';

const entries = (await getCollection('projects')).filter((p) => p.data.published !== false);

// Key each OG image by the entry id -> /og/<id>.png
const pages = Object.fromEntries(entries.map((e) => [e.id, e.data]));

export const { getStaticPaths, GET } = await OGImageRoute({
	param: 'route',
	pages,
	getImageOptions: (_path, page) => ({
		title: page.title,
		description: page.description,
		logo: undefined,
		bgGradient: [
			[9, 9, 11],
			[24, 24, 27],
		],
		border: { color: [251, 146, 60], width: 12, side: 'inline-start' },
		padding: 60,
		font: {
			title: { color: [250, 250, 250], size: 64, weight: 'Bold' },
			description: { color: [161, 161, 170], size: 30 },
		},
		format: 'PNG',
	}),
});
