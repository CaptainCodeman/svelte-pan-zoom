<script lang="ts">
	import '../app.css'
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

<div>
	<h1>Svelte Pan Zoom</h1>
	<p>Use swipe & pinch touch gestures or mouse click+drag & wheel to pan and zoom image</p>
</div>

<style>
	div {
		font-family: Arial, Helvetica, sans-serif;
		position: absolute;
		top: 16px;
		left: 16px;
	}
	canvas {
		position: absolute;
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		user-select: none;
		touch-action: none;
		background-color: #ccc;
		overscroll-behavior: none;
		-webkit-user-select: none; /* disable selection/Copy of UIWebView */
		-webkit-touch-callout: none; /* disable the IOS popup when long-press on a link */
	}
</style>
