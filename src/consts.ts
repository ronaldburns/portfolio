// Global site configuration. Import anywhere with the `import` keyword.

export const SITE_TITLE = 'Ronald Burns';
export const SITE_DESCRIPTION =
	'Game, graphics, and infrastructure engineering — projects and dev logs by Ronald Burns.';

// --- Image handling -------------------------------------------------------
// Media lives in Cloudflare R2, served through the custom domain below.
// Cloudflare Image Transformations (enabled per-zone in the dashboard:
// Images -> Transformations -> "Enable for zone") rewrite requests through
// the /cdn-cgi/image/ path for on-the-fly AVIF/WebP + resizing.
//
// Flip USE_IMAGE_TRANSFORM to `true` AFTER enabling Transformations on the
// zone. Until then we serve the original R2 object directly (which already
// works today), so nothing breaks in local dev or before you enable it.
export const IMAGE_CDN = 'https://r2-portfolio.ronaldburns.dev';
export const USE_IMAGE_TRANSFORM = false;

// Responsive widths emitted in srcset when transforms are on.
export const IMAGE_WIDTHS = [640, 960, 1280, 1920];

// --- Contact / socials ----------------------------------------------------
export const SOCIALS = [
	{ label: 'Email', handle: 'contact@ronaldburns.dev', href: 'mailto:contact@ronaldburns.dev' },
	{ label: '𝕏', handle: '@ayoROJO', href: 'https://x.com/ayoROJO' },
	{ label: 'GitHub', handle: 'ronaldburns', href: 'https://github.com/ronaldburns' },
	{ label: 'LinkedIn', handle: 'ronaldburns', href: 'https://www.linkedin.com/in/ronaldburns/' },
];
