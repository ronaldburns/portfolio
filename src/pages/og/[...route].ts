import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import CanvasKitInit, { type Canvas, type Paragraph, type TextStyle } from 'canvaskit-wasm/full';
import sharp from 'sharp';
import { originalUrl } from '../../lib/images';

// Link preview cards for Discord, X and the like, served at /og/<id>.jpg. Every card is the same template, so one
// in a feed reads as mine before anyone reads the words: my name in the top left where the site's header has it,
// the post's date over its title, and the hero image in a rounded plate on the right. A post without a hero gets
// a bigger title instead. The bottom left stays clear because X lays its own headline box there. sharp handles
// the pictures and CanvasKit draws the text with the site's own fonts, so a card built on the CI runner matches
// one built here whatever fonts the machine has. Runs at build time only.

const W = 1200;
const H = 630;
const JPEG = { quality: 88, mozjpeg: true, chromaSubsampling: '4:4:4' } as const;
// The margin on every side, and where the hero's plate starts.
const M = 60;
const PLATE_X = 520;
const PLATE_RADIUS = 18;
// Cap heights in em, measured from each font's H.
const CAP = 0.7;
const DATE_CAP = 0.67;
const NAME_SIZE = 36;
const DATE_SIZE = 26;
// From the date's baseline to the title's cap top.
const DATE_GAP = 30;

const CanvasKit = await CanvasKitInit({
	locateFile: (file) => createRequire(import.meta.url).resolve(`canvaskit-wasm/bin/full/${file}`),
});
const fonts = CanvasKit.TypefaceFontProvider.Make();
fonts.registerFont(await readFile(path.join(process.cwd(), 'public/fonts/CalSans-SemiBold.ttf')), 'Cal Sans');
fonts.registerFont(await readFile(path.join(process.cwd(), 'src/assets/fonts/atkinson-regular.woff')), 'Atkinson');

// Zinc-900 rather than the page's near-black, so a card keeps its edge on X's black and Discord's dark grey.
// Purple only marks the name and the plate's frame. The name is Tailwind's purple-400, the site's accent, and the
// frame is Radix's purple 7, the step its dark purple scale keeps for borders.
const GROUND = CanvasKit.Color(24, 24, 27);
const WHITE = CanvasKit.Color(250, 250, 250);
const MUTED = CanvasKit.Color(161, 161, 170);
const PURPLE = CanvasKit.Color(194, 122, 255);
const FRAME = CanvasKit.Color(102, 66, 130);

function paragraph(text: string, style: TextStyle, family = 'Cal Sans') {
	const builder = CanvasKit.ParagraphBuilder.MakeFromFontProvider(
		new CanvasKit.ParagraphStyle({ textStyle: { fontFamilies: [family], ...style } }),
		fonts,
	);
	builder.addText(text);
	const p = builder.build();
	builder.delete();
	// Nothing here wraps on its own. Titles come in already broken into lines.
	p.layout(100000);
	return p;
}

// Draws p with its first baseline at y, then frees it.
function drawAt(canvas: Canvas, p: Paragraph, x: number, y: number) {
	canvas.drawParagraph(p, x, y - p.getLineMetrics()[0].baseline);
	p.delete();
}

// Words never split. A spaced hyphen rides with the word before it, so "Toon Shading - Part 1" can't start a line
// with the hyphen.
function words(text: string) {
	const out: string[] = [];
	for (const word of text.split(/\s+/)) {
		if (word === '-' && out.length) out[out.length - 1] += ' -';
		else out.push(word);
	}
	return out;
}

// Measures lines at one text style, remembering each width because the line breaking asks for the same lines
// many times over.
function measurer(style: TextStyle) {
	const widths = new Map<string, number>();
	return (line: string) => {
		let width = widths.get(line);
		if (width === undefined) {
			const p = paragraph(line, style);
			width = p.getMaxIntrinsicWidth();
			p.delete();
			widths.set(line, width);
		}
		return width;
	};
}

// Fills lines up to width, measuring each candidate line whole.
function fillLines(list: string[], measure: (line: string) => number, width: number) {
	const lines: string[] = [];
	let line = '';
	for (const word of list) {
		const next = line ? `${line} ${word}` : word;
		if (line && measure(next) > width) {
			lines.push(line);
			line = word;
		} else line = next;
	}
	if (line) lines.push(line);
	return lines;
}

// Tries every way to break the words into count lines that fit, and keeps the evenest: the least squared shortfall
// against the longest line. A title is a dozen words at most, so that's a few hundred tries.
function balance(list: string[], measure: (line: string) => number, width: number, count: number) {
	let best: { lines: string[]; cost: number; longest: number } | undefined;
	const visit = (start: number, left: number, lines: string[]) => {
		if (left === 1) {
			const all = [...lines, list.slice(start).join(' ')];
			const widths = all.map(measure);
			const longest = Math.max(...widths);
			if (longest > width) return;
			const cost = widths.reduce((sum, w) => sum + (longest - w) ** 2, 0);
			if (!best || cost < best.cost - 1e-6 || (Math.abs(cost - best.cost) <= 1e-6 && longest < best.longest)) {
				best = { lines: all, cost, longest };
			}
			return;
		}
		for (let end = start + 1; end <= list.length - left + 1; end++) {
			const line = list.slice(start, end).join(' ');
			if (measure(line) > width) break;
			visit(end, left - 1, [...lines, line]);
		}
	};
	visit(0, count, []);
	return best ? best.lines : fillLines(list, measure, width);
}

// The title at the biggest size from max down to min whose words fit in maxLines lines of width, broken as evenly
// as possible. Its height runs from the first line's cap top to the last line's baseline.
function setTitle(text: string, { max, min, width, maxLines }: { max: number; min: number; width: number; maxLines: number }) {
	const style = (size: number): TextStyle => ({ color: WHITE, fontSize: size, heightMultiplier: 1.04, letterSpacing: -size / 100 });
	const list = words(text);
	let size = max;
	let measure = measurer(style(size));
	while (size > min && (fillLines(list, measure, width).length > maxLines || Math.max(...list.map(measure)) > width)) {
		size -= 2;
		measure = measurer(style(size));
	}
	const lines = balance(list, measure, width, fillLines(list, measure, width).length);
	const p = paragraph(lines.join('\n'), style(size));
	const metrics = p.getLineMetrics();
	return { p, size, height: CAP * size + metrics[metrics.length - 1].baseline - metrics[0].baseline };
}

async function fetchHero(src: string) {
	const res = await fetch(originalUrl(src));
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return Buffer.from(await res.arrayBuffer());
}

async function aspectOf(input: Buffer) {
	const { width = W, height = H, pageHeight = height } = await sharp(input, { pages: 1 }).metadata();
	return width / pageHeight;
}

// A GIF or animated WebP gives its middle frame, since the first is often a blank lead-in.
async function frameOf(input: Buffer) {
	const { pages = 1 } = await sharp(input).metadata();
	return sharp(input, { page: Math.floor(pages / 2), pages: 1 }).flatten({ background: '#18181b' });
}

// The picture cropped to the plate around its most striking part, with the frame drawn just inside the edge.
async function drawPlate(canvas: Canvas, input: Buffer, x: number, y: number, w: number, h: number) {
	const { data, info } = await (await frameOf(input))
		.resize(w, h, { fit: 'cover', position: 'attention' })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const picture = CanvasKit.MakeImage(
		{
			width: info.width,
			height: info.height,
			alphaType: CanvasKit.AlphaType.Unpremul,
			colorType: CanvasKit.ColorType.RGBA_8888,
			colorSpace: CanvasKit.ColorSpace.SRGB,
		},
		data,
		info.width * 4,
	)!;
	canvas.save();
	canvas.clipRRect(CanvasKit.RRectXY(CanvasKit.XYWHRect(x, y, w, h), PLATE_RADIUS, PLATE_RADIUS), CanvasKit.ClipOp.Intersect, true);
	canvas.drawImage(picture, x, y);
	canvas.restore();
	picture.delete();

	const paint = new CanvasKit.Paint();
	paint.setStyle(CanvasKit.PaintStyle.Stroke);
	paint.setStrokeWidth(2);
	paint.setColor(FRAME);
	paint.setAntiAlias(true);
	canvas.drawRRect(CanvasKit.RRectXY(CanvasKit.XYWHRect(x + 1, y + 1, w - 2, h - 2), PLATE_RADIUS - 1, PLATE_RADIUS - 1), paint);
	paint.delete();
}

async function card(title: string, date: string, hero?: Buffer) {
	const surface = CanvasKit.MakeSurface(W, H)!;
	try {
		const canvas = surface.getCanvas();
		canvas.clear(GROUND);
		drawAt(canvas, paragraph('Ronald Burns', { color: PURPLE, fontSize: NAME_SIZE, letterSpacing: -NAME_SIZE / 100 }), M, M + CAP * NAME_SIZE);
		const dateLine = paragraph(date, { color: MUTED, fontSize: DATE_SIZE }, 'Atkinson');

		const aspect = hero ? await aspectOf(hero) : 0;
		if (hero && aspect > 3) {
			// A banner is too thin for the plate on the right, so it runs the full width under the title.
			const heading = setTitle(title, { max: 72, min: 48, width: W - 2 * M - 60, maxLines: 2 });
			const plateH = Math.min(240, Math.round((W - 2 * M) / aspect));
			const group = DATE_CAP * DATE_SIZE + DATE_GAP + heading.height + 56 + plateH;
			const top = Math.max(140, (150 + 560) / 2 - group / 2);
			drawAt(canvas, dateLine, M, top + DATE_CAP * DATE_SIZE);
			drawAt(canvas, heading.p, M - 2, top + DATE_CAP * DATE_SIZE + DATE_GAP + CAP * heading.size);
			await drawPlate(canvas, hero, M, Math.round(top + group - plateH), W - 2 * M, plateH);
		} else {
			if (hero) await drawPlate(canvas, hero, PLATE_X, M, W - M - PLATE_X, H - 2 * M);
			const heading = hero
				? setTitle(title, { max: 58, min: 36, width: PLATE_X - M - 52, maxLines: 4 })
				: setTitle(title, { max: 92, min: 56, width: W - 2 * M - 60, maxLines: 3 });
			// The date and title centre between the name and the bottom quarter.
			const group = DATE_CAP * DATE_SIZE + DATE_GAP + heading.height;
			const top = (150 + 472) / 2 - group / 2;
			drawAt(canvas, dateLine, M, top + DATE_CAP * DATE_SIZE);
			drawAt(canvas, heading.p, M - 2, top + DATE_CAP * DATE_SIZE + DATE_GAP + CAP * heading.size);
		}

		const image = surface.makeImageSnapshot();
		const png = Buffer.from(image.encodeToBytes()!);
		image.delete();
		return await sharp(png).removeAlpha().jpeg(JPEG).toBuffer();
	} finally {
		surface.delete();
	}
}

export const getStaticPaths = (async () => {
	const entries = (await getCollection('projects')).filter((p) => p.data.published !== false);
	return entries.map((entry) => ({ params: { route: `${entry.id}.jpg` }, props: { entry } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
	const { id, data } = (props as { entry: CollectionEntry<'projects'> }).entry;
	// The same call the post header's FormattedDate makes, so the two always agree.
	const date = data.date.toLocaleDateString('en-us', { year: 'numeric', month: 'short', day: 'numeric' });
	let jpeg: Buffer | undefined;
	if (data.image) {
		try {
			jpeg = await card(data.title, date, await fetchHero(data.image));
		} catch (e) {
			console.warn(`[og] ${id} gets a card without its hero, which failed with ${e}`);
		}
	}
	jpeg ??= await card(data.title, date);
	return new Response(new Uint8Array(jpeg), { headers: { 'Content-Type': 'image/jpeg' } });
};
