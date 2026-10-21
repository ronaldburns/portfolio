import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import CanvasKitInit, { type Canvas, type Color, type TextStyle } from 'canvaskit-wasm/full';
import sharp from 'sharp';
import { originalUrl } from '../../lib/images';

// Link preview cards for Discord, X and the like, served at /og/<id>.jpg. Every card has my name in the top
// left, where the site's header has it. A post with a hero image gets that image and nothing else, since every
// platform already prints the title as text and X lays its own title box over the bottom of the image. A post
// without one gets its title under the name on a dark card, kept clear of that bottom quarter. sharp handles
// the pictures and CanvasKit draws the text with the site's own Cal Sans, so a card built on the CI runner
// matches one built here whatever fonts the machine has. Runs at build time only.

const W = 1200;
const H = 630;
const JPEG = { quality: 88, mozjpeg: true, chromaSubsampling: '4:4:4' } as const;
// Cal Sans capitals stand 0.7 em tall, measured from its H.
const CAP = 0.7;
// Where the name sits on every card, in the site header's corner.
const NAME_X = 60;
const NAME_BASELINE = 84;
const NAME_SIZE = 40;

const CanvasKit = await CanvasKitInit({
	locateFile: (file) => createRequire(import.meta.url).resolve(`canvaskit-wasm/bin/full/${file}`),
});
const fonts = CanvasKit.TypefaceFontProvider.Make();
fonts.registerFont(await readFile(path.join(process.cwd(), 'public/fonts/CalSans-SemiBold.ttf')), 'Cal Sans');

const WHITE = CanvasKit.Color(250, 250, 250);
const MUTED = CanvasKit.Color(161, 161, 170);

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

function nameParagraph(color: Color, shadows?: TextStyle['shadows']) {
	return paragraph('Ronald Burns', { color, fontSize: NAME_SIZE, shadows }, W);
}

function drawName(canvas: Canvas, color: Color, shadows?: TextStyle['shadows']) {
	const name = nameParagraph(color, shadows);
	canvas.drawParagraph(name, NAME_X, NAME_BASELINE - name.getLineMetrics()[0].baseline);
	name.delete();
}

const NAME_WIDTH = (() => {
	const name = nameParagraph(WHITE);
	const width = name.getLongestLine();
	name.delete();
	return width;
})();

// A soft light from the top left, so a card with nothing but text or a thin banner on it doesn't read as an
// empty black box.
function drawBackdrop(canvas: Canvas) {
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
}
const backdrop = layer(drawBackdrop);

// The name's corner fades into a soft copy of the picture along an ellipse, full strength around the name and
// gone by x = 660 or y = 240.
const VIGNETTE = Buffer.alloc(W * H);
for (let y = 0; y < H; y++) {
	for (let x = 0; x < W; x++) {
		const t = Math.min(1, Math.max(0, (1 - Math.hypot(x / 660, y / 240)) / 0.45));
		VIGNETTE[y * W + x] = Math.round(t * t * (3 - 2 * t) * 255);
	}
}

// A flat colour over the same corner, at a fraction of the vignette's strength.
function wash(background: { r: number; g: number; b: number }, opacity: number) {
	const alpha = Buffer.alloc(W * H);
	for (let i = 0; i < alpha.length; i++) alpha[i] = Math.round(VIGNETTE[i] * opacity);
	return sharp({ create: { width: W, height: H, channels: 3, background } })
		.joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } })
		.png()
		.toBuffer();
}

// On most pictures the name is white with a soft dark halo. Where the corner is bright it's near black with a
// light halo, over a light wash.
const onDark = {
	name: layer((canvas) =>
		drawName(canvas, WHITE, [
			{ color: CanvasKit.Color(0, 0, 0, 0.5), blurRadius: 14 },
			{ color: CanvasKit.Color(0, 0, 0, 0.35), blurRadius: 3, offset: [0, 1] },
		]),
	),
	wash: await wash({ r: 9, g: 9, b: 11 }, 0.3),
};
const onBright = {
	name: layer((canvas) =>
		drawName(canvas, CanvasKit.Color(24, 24, 27), [
			{ color: CanvasKit.Color(255, 255, 255, 0.7), blurRadius: 14 },
			{ color: CanvasKit.Color(255, 255, 255, 0.5), blurRadius: 3 },
		]),
	),
	wash: await wash({ r: 250, g: 250, b: 250 }, 0.45),
};

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
		// image sits on a blurred, darkened copy of itself. A banner blown up that far turns into a smear, so it
		// gets the title cards' backdrop instead. A picture that would reach under the name drops below it.
		let whole = await frame().resize(W - 96, H - 96, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
		let top = Math.round((H - whole.info.height) / 2);
		if (top < NAME_BASELINE + 24 && (W - whole.info.width) / 2 < NAME_X + NAME_WIDTH + 24) {
			whole = await frame().resize(W - 96, H - 160, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
			top = 112;
		}
		const behind = aspect >= 2.4
			? sharp(backdrop)
			: frame().resize(W, H, { fit: 'cover' }).blur(30).modulate({ brightness: 0.45, saturation: 0.8 });
		picture = behind.composite([{ input: whole.data, raw: whole.info, left: Math.round((W - whole.info.width) / 2), top }]);
	}
	// Compositing can add an alpha channel, and sharp would strip it before the composite if asked in the same
	// pipeline, so that happens in a second pass.
	const flat = await picture.raw().toBuffer({ resolveWithObject: true });
	const { data, info } = await sharp(flat.data, { raw: flat.info }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
	const hero = () => sharp(data, { raw: info });

	// Measures the name's corner. Laplacian sharpness runs high on text and UI and low on open floor or sky, and
	// a third-size copy catches big lettering that full size misses.
	const corner = await hero().extract({ left: 0, top: 0, width: 480, height: 140 }).png().toBuffer();
	const { sharpness, channels } = await sharp(corner).stats();
	const { sharpness: coarse } = await sharp(await sharp(corner).resize(160, 47).png().toBuffer()).stats();
	const brightness = (channels[0].mean + channels[1].mean + channels[2].mean) / 3;
	const bright = brightness > 190;

	// Around the name the picture softens, blurred where it's busy so UI text can't tangle with the letters. A
	// bright corner gets a light wash and a dark name. Any other corner dims until it's no brighter than about 72
	// of 255 and keeps the white name, so a dark render barely changes.
	let soft = hero();
	if (Math.max(sharpness, coarse) > 2.2) soft = soft.blur(16);
	if (!bright) soft = soft.modulate({ brightness: Math.min(1, 72 / Math.max(brightness, 1)) });
	const frost = await sharp(await soft.raw().toBuffer(), { raw: { width: W, height: H, channels: 3 } })
		.joinChannel(VIGNETTE, { raw: { width: W, height: H, channels: 1 } })
		.png()
		.toBuffer();
	const look = bright ? onBright : onDark;
	return hero()
		.composite([{ input: frost }, { input: look.wash }, { input: look.name }])
		.jpeg(JPEG)
		.toBuffer();
}

function titleCard(title: string) {
	const png = layer((canvas) => {
		drawBackdrop(canvas);
		drawName(canvas, MUTED);

		// The biggest size that keeps the title to three lines. Then the narrowest measure that keeps the same
		// number of lines, so they come out about even and nothing dangles on its own.
		const style = (size: number): TextStyle => ({ color: WHITE, fontSize: size, heightMultiplier: 1.06, letterSpacing: -size / 100 });
		let size = 92;
		let heading = paragraph(title, style(size), 1040);
		while (heading.getLineMetrics().length > 3 && size > 56) {
			heading.delete();
			size -= 2;
			heading = paragraph(title, style(size), 1040);
		}
		const count = heading.getLineMetrics().length;
		let narrow = 0;
		let wide = 1040;
		while (wide - narrow > 2) {
			const width = (narrow + wide) / 2;
			heading.layout(width);
			if (heading.getLineMetrics().length > count) narrow = width;
			else wide = width;
		}
		heading.layout(wide);

		// Centred between the name and the bottom quarter, where X lays its own title box over the card.
		const lines = heading.getLineMetrics();
		const capTop = (130 + 472) / 2 - (CAP * size + lines[lines.length - 1].baseline - lines[0].baseline) / 2;
		canvas.drawParagraph(heading, NAME_X - 2, capTop - lines[0].baseline + CAP * size);
		heading.delete();
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
