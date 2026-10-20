// Shared full-size image viewer for Figure, Gallery and Annotated. Any element with a data-ar-zoom
// URL opens it. The <dialog> is built on first use, and built again after a client-side page swap
// throws the old body away.

let dialog: HTMLDialogElement | null = null;
let opener: HTMLElement | null = null;

function getDialog(): HTMLDialogElement {
	if (dialog?.isConnected) return dialog;
	const d = document.createElement('dialog');
	d.className = 'ar-lightbox';
	d.setAttribute('aria-label', 'Full size image');
	d.innerHTML = `
		<button type="button" class="ar-lightbox__close" aria-label="Close">
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
		</button>
		<figure class="ar-lightbox__figure">
			<img class="ar-lightbox__img" alt="" decoding="async" />
			<figcaption class="ar-lightbox__caption" hidden></figcaption>
		</figure>`;
	// Clicks on the picture or its caption keep it open. The backdrop and the close button close it.
	d.addEventListener('click', (event) => {
		const target = event.target as Element;
		if (!target.closest('.ar-lightbox__img, .ar-lightbox__caption')) d.close();
	});
	d.addEventListener('close', () => {
		opener?.focus({ preventScroll: true });
		opener = null;
	});
	document.body.append(d);
	dialog = d;
	return d;
}

function open(trigger: HTMLElement) {
	const full = trigger.dataset.arZoom;
	if (!full) return;
	const d = getDialog();
	const img = d.querySelector<HTMLImageElement>('.ar-lightbox__img')!;
	const caption = d.querySelector<HTMLElement>('.ar-lightbox__caption')!;
	const thumb = trigger.querySelector('img');

	// Show the copy that is already on screen straight away, then swap in the full file once it loads.
	img.dataset.full = full;
	img.src = thumb?.currentSrc || full;
	if (img.src !== full) {
		const loader = new Image();
		loader.onload = () => {
			if (d.open && img.dataset.full === full) img.src = full;
		};
		loader.src = full;
	}
	img.alt = thumb?.alt ?? '';

	const text =
		trigger.dataset.arCaption ??
		trigger.closest('figure')?.querySelector('.ar-caption')?.textContent?.trim() ??
		'';
	caption.textContent = text;
	caption.hidden = !text;

	opener = trigger;
	d.showModal();
}

document.addEventListener('click', (event) => {
	const trigger = (event.target as Element | null)?.closest<HTMLElement>('[data-ar-zoom]');
	if (trigger) open(trigger);
});
