# Article components

Building blocks for long-form project posts. Import the ones you use right after the frontmatter:

```mdx
import Figure from '../../components/article/Figure.astro';
```

Every `src` and `poster` is an R2 key (`projects/<slug>/<file>`) or an absolute URL. `width` and `height` are
the media's pixel size. They reserve the space so nothing jumps while the page loads, so always pass the real
numbers. The media components take a `caption` string, or a `caption` slot when the caption needs code or links.
Captioned figures are numbered for you (Fig. 1, Fig. 2, ...), so "see Fig. 3" in the text works. A figure without
a caption gets no number.

```mdx
<Figure src="projects/toon/rim.png" alt="Rim light on the hair" width={3027} height={1974}>
  <span slot="caption">The rim comes from <code>CustomDepth</code>, see <a href="/projects/toon-shading-part1/">part 1</a>.</span>
</Figure>
```

## Media

**Figure.** An image. Clicking it opens the full-size viewer (Esc, the backdrop or the close button closes it).
`crop` trims the image in the article only. `zoom={false}` turns the viewer off.

```mdx
<Figure src="projects/toon/rim.png" alt="Rim light on the hair" width={3027} height={1974} caption="Rim light from custom depth." />
<Figure src="projects/toon/wide.png" alt="..." width={3027} height={1974} crop={{ aspect: '21/9', position: '50% 30%' }} />
```

**Compare.** Before/after slider for two shots from the same camera. Before is on the left. `start` is where the
divider begins, in percent (default 50). Readers can drag, tap, or use the arrow keys, Page Up/Down, Home and End.

```mdx
<Compare before="projects/toon/lambert.png" after="projects/toon/ramp.png" beforeLabel="Lambert" afterLabel="Toon ramp" alt="The same scene lit two ways" width={3027} height={1974} />
```

**Loop.** A silent clip that loops (H.264 mp4, plus an optional `webm` that is tried first). It plays only while
on screen, always shows a pause button, and starts paused for readers who prefer reduced motion. `label` is the
clip's text alternative for screen readers. It is not shown on the page.

```mdx
<Loop src="projects/ik/reach.mp4" webm="projects/ik/reach.webm" poster="projects/ik/reach.jpg" width={1640} height={900} label="Arm IK tracking a moving target" caption="Two-bone IK with pole vector." />
```

**Player.** A clip with sound. Native controls, never autoplays, and loads nothing until the reader presses play.

```mdx
<Player src="projects/talk/demo.mp4" poster="projects/talk/demo.jpg" width={1920} height={1080} caption="Walkthrough with commentary." />
```

**Annotated.** An image with numbered markers. `x` and `y` are percent of the image from the top left. The
legend under the image repeats each label and is the text alternative, so write labels that stand on their own.

```mdx
<Annotated src="projects/toon/hero.png" alt="Character in the test scene" width={3027} height={1972}
  points={[{ x: 31, y: 42, label: 'Hair rim from custom depth' }, { x: 64, y: 70, label: 'Two-tone ramp shadow' }]} />
```

**Gallery.** A labelled grid of related views (buffers, A/B/C). `cols` is 2, 3 or 4 (default 2). Phones always
get two columns. Every item opens in the viewer.

```mdx
<Gallery cols={3} caption="Three G-buffer views of one frame." items={[
  { src: 'projects/toon/normal.png', alt: 'World normals', label: 'World normal', width: 3027, height: 1974 },
  { src: 'projects/toon/nov.png', alt: 'N dot V', label: 'NoV', width: 3027, height: 1974 }]} />
```

## Text

**Lede.** The opening paragraph, set larger.

```mdx
<Lede>I wanted toon shading that still reacts to every light in the scene.</Lede>
```

**Facts.** A compact at-a-glance strip. Put it right after the lede.

```mdx
<Facts items={[{ label: 'Engine', value: 'Unreal Engine 5.4' }, { label: 'Role', value: 'Solo' }, { label: 'Time', value: '3 weeks' }]} />
```

**Callout.** An aside. `tone` is `note` (default), `warn` or `win`. The title is optional and is a plain
sentence, never "Label:". Markdown works inside.

```mdx
<Callout tone="warn" title="This only works in the deferred renderer">The forward path never reads the **G-buffer**.</Callout>
```

**Stats.** A row of big numbers.

```mdx
<Stats items={[{ value: '194', label: 'automation tests passing' }, { value: '0.4 ms', label: 'GPU cost at 1440p' }]} />
```

**Flow.** Boxes joined by arrows. `body` is optional. Up to four steps run left to right on wider screens;
five or more run top to bottom, as every flow does on a phone.

```mdx
<Flow caption="How an impact becomes a sound." steps={[{ title: 'Sources', body: 'Anim notifies, physics contacts' }, { title: 'Router' }, { title: 'Mixer', body: 'Per-bus limits' }]} />
```

**PullQuote.** A line lifted out of the text and set large. Leave out the quote marks.

```mdx
<PullQuote cite="Ronald, after the third rewrite">The fastest shader is the one you delete.</PullQuote>
```

**Disclaimer.** A visible notice box for fan work, licensing and similar small print.

```mdx
<Disclaimer title="Fan work">Characters and names belong to their owners. This project is not affiliated with them.</Disclaimer>
```

## Plain markdown

- Tables are styled automatically and scroll sideways on phones. Right-align number columns with `---:` in the
  separator row. Digits are tabular, so they line up.
- Keys: `<kbd>Ctrl</kbd> + <kbd>S</kbd>`.
- Code fences use Shiki. `title="ToonShading.ush"` after the language shows a file name, and `{3-5}` highlights lines.
