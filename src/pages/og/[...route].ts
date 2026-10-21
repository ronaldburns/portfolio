import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import CanvasKitInit, { type Canvas, type TextStyle } from 'canvaskit-wasm/full';
import sharp from 'sharp';
import { originalUrl } from '../../lib/images';

// Link preview cards for Discord, X and the like, served at /og/<id>.jpg. A post with a hero image gets that
// image, signed in a bottom corner. A post without one gets its title on a dark card. sharp handles the
// pictures and CanvasKit draws the text with the site's own Cal Sans, so a card built on the CI runner
// matches one built here whatever fonts the machine has. Runs at build time only.

const W = 1200;
const H = 630;
const JPEG = { quality: 88, mozjpeg: true, chromaSubsampling: '4:4:4' } as const;

const CanvasKit = await CanvasKitInit({
	locateFile: (file) => createRequire(import.meta.url).resolve(`canvaskit-wasm/bin/full/${file}`),
});
const fonts = CanvasKit.TypefaceFontProvider.Make();
fonts.registerFont(await readFile(path.join(process.cwd(), 'public/fonts/CalSans-SemiBold.ttf')), 'Cal Sans');

const WHITE = CanvasKit.Color(250, 250, 250);
const MUTED = CanvasKit.Color(161, 161, 170);
const INK = CanvasKit.Color(24, 24, 27);

function paragraph(text: string, style: TextStyle, width: number) {
	const builder = CanvasKit.ParagraphBuilder.MakeFromFontProvider(
		new CanvasKit.ParagraphStyle({ textStyle: { fontFamilies: ['Cal Sans'], ...style } }),
		fonts,
	);
	builder.addText(text);
	const p = builder.build();
	builder.delete();
	p.layout(width);
	return p;
}

// Draws onto a transparent card-sized layer and returns it as a PNG.
function layer(draw: (canvas: Canvas) => void) {
	const surface = CanvasKit.MakeSurface(W, H)!;
	const canvas = surface.getCanvas();
	canvas.clear(CanvasKit.TRANSPARENT);
	draw(canvas);
	const image = surface.makeImageSnapshot();
	const png = Buffer.from(image.encodeToBytes()!);
	image.delete();
	surface.delete();
	return png;
}

type Corner = 'left' | 'right';

// Writes the name with its baseline at `baseline`, `inset` px in from the left or right edge.
function sign(canvas: Canvas, corner: Corner, inset: number, baseline: number, style: TextStyle) {
	const name = paragraph('Ronald Burns', { fontSize: 30, ...style }, W);
	const x = corner === 'left' ? inset : W - inset - name.getLongestLine();
	canvas.drawParagraph(name, x, baseline - name.getLineMetrics()[0].baseline);
	name.delete();
}

// The name on a hero comes in two tones, each drawn once per bottom corner. The light one has a dark shadow
// for dark and mid-tone pictures, and the dark one a pale glow for bright ones.
const LIGHT: TextStyle = {
	color: WHITE,
	shadows: [
		{ color: CanvasKit.Color(0, 0, 0, 0.55), blurRadius: 16 },
		{ color: CanvasKit.Color(0, 0, 0, 0.4), blurRadius: 3, offset: [0, 1] },
	],
};
const DARK: TextStyle = { color: INK, shadows: [{ color: CanvasKit.Color(255, 255, 255, 0.5), blurRadius: 12 }] };
const signature = {
	left: {
		light: layer((canvas) => sign(canvas, 'left', 48, H - 50, LIGHT)),
		dark: layer((canvas) => sign(canvas, 'left', 48, H - 50, DARK)),
	},
	right: {
		light: layer((canvas) => sign(canvas, 'right', 48, H - 50, LIGHT)),
		dark: layer((canvas) => sign(canvas, 'right', 48, H - 50, DARK)),
	},
};

// Darkens the corners a little so the name never sits on the brightest part of the frame.
const vignette = Buffer.from(
	`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
		<defs>
			<radialGradient id="v" cx="50%" cy="45%" r="75%">
				<stop offset="60%" stop-color="#09090b" stop-opacity="0"/>
				<stop offset="100%" stop-color="#09090b" stop-opacity="0.45"/>
			</radialGradient>
		</defs>
		<rect width="100%" height="100%" fill="url(#v)"/>
	</svg>`,
);

// A soft patch of shade centred on the name, for a corner so busy the name would land on other text. It's
// dark under the light name and pale under the dark one.
function scrim(corner: Corner, tone: 'light' | 'dark') {
	const [color, opacity] = tone === 'light' ? ['#09090b', 0.7] : ['#fafafa', 0.8];
	return Buffer.from(
		`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<radialGradient id="s">
					<stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/>
					<stop offset="0.5" stop-color="${color}" stop-opacity="${opacity * 0.6}"/>
					<stop offset="1" stop-color="${color}" stop-opacity="0"/>
				</radialGradient>
			</defs>
			<ellipse cx="${corner === 'left' ? 140 : W - 140}" cy="${H - 60}" rx="300" ry="110" fill="url(#s)"/>
		</svg>`,
	);
}

async function heroCard(src: string) {
	const res = await fetch(originalUrl(src));
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const input = Buffer.from(await res.arrayBuffer());
	// GIFs and animated WebPs give their first frame.
	const frame = () => sharp(input, { pages: 1 }).flatten({ background: '#09090b' });
	const { width = W, height = H, pageHeight = height } = await frame().metadata();

	let picture;
	const aspect = width / pageHeight;
	if (aspect > 1.5 && aspect < 2.4) {
		// Close enough to the card's shape to crop. The attention crop keeps the most striking part.
		picture = frame().resize(W, H, { fit: 'cover', position: 'attention' });
	} else {
		// Cropping a portrait shot or a long banner to the card's shape would lose most of it, so the whole
		// image sits on a blurred, darkened copy of itself.
		const whole = await frame().resize(W - 96, H - 96, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
		picture = frame()
			.resize(W, H, { fit: 'cover' })
			.blur(30)
			.modulate({ brightness: 0.45, saturation: 0.8 })
			.composite([{ input: whole.data, raw: whole.info }]);
	}
	const { data, info } = await picture.raw().toBuffer({ resolveWithObject: true });
	const hero = () => sharp(data, { raw: info });

	// Measures the strip the name would cover in a bottom corner. Its Laplacian sharpness runs high on text and
	// UI and low on open floor or sky.
	const strip = async (left: number) => {
		const png = await hero().extract({ left, top: H - 110, width: 300, height: 110 }).png().toBuffer();
		const { sharpness, channels } = await sharp(png).stats();
		return { sharpness, bright: (channels[0].mean + channels[1].mean + channels[2].mean) / 3 > 150 };
	};
	const right = await strip(W - 300);
	const left = await strip(0);

	// Sign bottom right unless that corner is busy and the bottom left is much calmer.
	const corner = right.sharpness > 2 && left.sharpness < right.sharpness * 0.6 ? 'left' : 'right';
	const under = corner === 'left' ? left : right;
	const tone = under.bright ? 'dark' : 'light';
	const layers = [{ input: vignette }];
	if (under.sharpness > 2) layers.push({ input: scrim(corner, tone) });
	layers.push({ input: signature[corner][tone] });
	return hero().composite(layers).jpeg(JPEG).toBuffer();
}

function titleCard(title: string) {
	const png = layer((canvas) => {
		// A soft light from the top left, so the card doesn't read as an empty black box.
		const light = CanvasKit.Shader.MakeRadialGradient(
			[180, 0],
			900,
			[CanvasKit.Color(39, 39, 42), CanvasKit.Color(9, 9, 11)],
			null,
			CanvasKit.TileMode.Clamp,
		);
		const paint = new CanvasKit.Paint();
		paint.setShader(light);
		canvas.drawPaint(paint);
		paint.delete();
		light.delete();

		// The biggest size that keeps the title to three lines, set bottom left. Then the narrowest measure
		// that keeps the same number of lines, so they come out about even and nothing dangles on its own.
		const style = (size: number) => ({ color: WHITE, fontSize: size, heightMultiplier: 1.08, letterSpacing: -size / 100 });
		let size = 96;
		let heading = paragraph(title, style(size), 1000);
		while (heading.getLineMetrics().length > 3 && size > 56) {
			heading.delete();
			size -= 4;
			heading = paragraph(title, style(size), 1000);
		}
		const count = heading.getLineMetrics().length;
		let narrow = 0;
		let wide = 1000;
		while (wide - narrow > 2) {
			const width = (narrow + wide) / 2;
			heading.layout(width);
			if (heading.getLineMetrics().length > count) narrow = width;
			else wide = width;
		}
		heading.layout(wide);
		const lines = heading.getLineMetrics();
		canvas.drawParagraph(heading, 72, H - 64 - lines[lines.length - 1].baseline);
		heading.delete();

		sign(canvas, 'left', 72, 86, { color: MUTED });
	});
	return sharp(png).jpeg(JPEG).toBuffer();
}

export const getStaticPaths = (async () => {
	const entries = (await getCollection('projects')).filter((p) => p.data.published !== false);
	return entries.map((entry) => ({ params: { route: `${entry.id}.jpg` }, props: { entry } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
	const { id, data } = (props as { entry: CollectionEntry<'projects'> }).entry;
	let card: Buffer | undefined;
	if (data.image) {
		try {
			card = await heroCard(data.image);
		} catch (e) {
			console.warn(`[og] ${id} falls back to its title card. The hero failed with ${e}`);
		}
	}
	card ??= await titleCard(data.title);
	return new Response(new Uint8Array(card), { headers: { 'Content-Type': 'image/jpeg' } });
};
