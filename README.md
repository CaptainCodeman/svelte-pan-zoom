# svelte-pan-zoom

![minified](https://img.shields.io/bundlephobia/min/svelte-pan-zoom/0.0.8?style=for-the-badge)
![minified + zipped](https://img.shields.io/bundlephobia/minzip/svelte-pan-zoom/0.0.8?style=for-the-badge)

Canvas Pan and Zoom action for Svelte

[See Demo](https://captaincodeman.github.io/svelte-pan-zoom/)
[Multiple Instances](https://captaincodeman.github.io/svelte-pan-zoom/multi)

## Usage

Install using you package manager of choice:

    pnpm i svelte-pan-zoom

Import action into page, create options and pass to action.

Options include:

- `width` & `height` in CSS pixels of item to render (will be centered and sized to fit canvas)
- `render` function to render to canvas (you're not limited to rendering a single image)
- `padding` (optional, default 0)
- `maxZoom` (optional, default 16)
- `friction` how much momentum will be continued (optional, default to 0.97)

NOTE: if you set friction to 1, any movement will never stop, so you'll have re-invented the DVD screen saver!

Your render function will be passed the canvas 2d render context _and_ the animation timer plus the "focus" point (the point last zoomed or interacted with). It can return true if you want to reschedule another animation frame to be rendered. This is useful if what you are rendering is also itself being animated.

## Example

```svelte
<script lang="ts">
  import { panzoom, type Options } from '$lib'

  const promise = new Promise<Options>(resolve => {
    const image = new Image()

    image.onload = () =>
      resolve({
        width: image.width,
        height: image.height,
        render,
      })
    image.src = './svelte-kit-machine.png'

    function render(ctx: CanvasRenderingContext2D, t: number) {
      ctx.drawImage(image, 0, 0)
    }
  })
</script>

{#await promise then options}
  <canvas use:panzoom={options} />
{/await}

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
