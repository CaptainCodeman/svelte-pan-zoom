# svelte-pan-zoom

![minified](https://img.shields.io/bundlephobia/min/svelte-pan-zoom/0.1.0?style=for-the-badge)
![minified + zipped](https://img.shields.io/bundlephobia/minzip/svelte-pan-zoom/0.1.0?style=for-the-badge)

Canvas pan and zoom as a Svelte 5 [attachment](https://svelte.dev/docs/svelte/@attach).

[See Demo](https://captaincodeman.github.io/svelte-pan-zoom/)
[Multiple Instances](https://captaincodeman.github.io/svelte-pan-zoom/multi)

Requires **Svelte 5.29+**.

## Usage

Install using your package manager of choice:

    pnpm i svelte-pan-zoom

Create a `PanZoom` instance (or the `panzoom` factory) and attach it to a canvas.

Options include:

- `width` & `height` of the item to render (centered and sized to fit the canvas)
- `render` function to draw into the canvas (you're not limited to a single image)
- `padding` (optional, default 0)
- `maxZoom` (optional, default 16)
- `friction` how much momentum continues (optional, default 0.97)

NOTE: if you set friction to 1, any movement will never stop, so you'll have re-invented the DVD screen saver!

Your render function is passed the canvas 2d context, the animation time, and the "focus" point (the point last zoomed or interacted with). Return `true` to request another animation frame — useful if what you are rendering is itself animated.

The view transform (`x`, `y`, `scale`) is Svelte `$state`, so you can read it in the template or set it to pan/zoom programmatically. `width`, `height`, `padding`, `maxZoom`, `friction`, and `render` are also reactive: change them on the instance without re-attaching.

SvelteKit preload listeners are silenced on the canvas automatically, for smoother rAF animations.

## Example

```svelte
<script lang="ts">
	import { PanZoom } from 'svelte-pan-zoom'

	let { image }: { image: CanvasImageSource & { width: number; height: number } } = $props()

	const viewer = new PanZoom({
		width: image.width,
		height: image.height,
		render: (ctx) => {
			ctx.drawImage(image, 0, 0)
		},
	})
</script>

<canvas {@attach viewer.attach}></canvas>

<style>
	canvas {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		user-select: none;
		touch-action: none;
		background-color: #ccc;
		overscroll-behavior: none;
		-webkit-user-select: none; /* disable selection/Copy of UIWebView */
		-webkit-touch-callout: none; /* disable the IOS popup when long-press on a link */
	}
</style>
```

When you don't need the instance, the factory returns an attachment directly:

```svelte
<canvas {@attach panzoom({ width, height, render })}></canvas>
```
