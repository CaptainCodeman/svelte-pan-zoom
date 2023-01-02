# svelte-pan-zoom

Canvas Pan and Zoom action for Svelte, 1Kb minified + gzipped

[See Demo](https://captaincodeman.github.io/svelte-pan-zoom/)

## Usage

Install using you package manager of choice:

    pnpm i svelte-pan-zoom

Import action into page, create options and pass to action.

Options include:

- `width` & `height` in CSS pixels of item to render (will be centered and sized to fit canvas)
- `render` function to draw to canvas (you don't _have_ to draw an image)
- `padding` (optional, default 0)
- `maxZoom` (optional, default 16)

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

    function render(ctx: CanvasRenderingContext2D) {
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
