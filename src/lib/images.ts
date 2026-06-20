import { IMAGE_CDN, IMAGE_WIDTHS, USE_IMAGE_TRANSFORM } from '../consts';

/** Normalize a media reference to a clean key like `projects/slug/file.png`. */
function toKey(src: string): string {
	// Already an absolute URL pointing at the CDN. Strip the origin (and decode
	// any %2F path-encoding left over from the old hardcoded URLs).
	if (src.startsWith(IMAGE_CDN)) {
		return decodeURIComponent(src.slice(IMAGE_CDN.length)).replace(/^\/+/, '');
	}
	return src.replace(/^\/+/, '');
}

/** True when `src` is an external URL we should pass through untouched. */
export function isExternal(src: string): boolean {
	return /^https?:\/\//.test(src) && !src.startsWith(IMAGE_CDN);
}

/** Absolute URL to the original object in R2 (no transformation). */
export function originalUrl(src: string): string {
	if (isExternal(src)) return src;
	return `${IMAGE_CDN}/${toKey(src)}`;
}

/**
 * URL for a transformed image of a given width.
 * Falls back to the original object when transforms are disabled or the
 * source is external.
 */
export function imageUrl(src: string, width?: number): string {
	if (isExternal(src) || !USE_IMAGE_TRANSFORM) return originalUrl(src);
	const key = toKey(src);
	const opts = ['format=auto', 'quality=80', width ? `width=${width}` : 'width=1280']
		.filter(Boolean)
		.join(',');
	return `${IMAGE_CDN}/cdn-cgi/image/${opts}/${key}`;
}

/** Build a responsive srcset across IMAGE_WIDTHS (only when transforms are on). */
export function srcSet(src: string): string | undefined {
	if (isExternal(src) || !USE_IMAGE_TRANSFORM) return undefined;
	return IMAGE_WIDTHS.map((w) => `${imageUrl(src, w)} ${w}w`).join(', ');
}
