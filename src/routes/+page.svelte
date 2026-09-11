<script lang="ts">
	import { PanZoom } from '$lib'

	const viewer = new Promise<PanZoom>((resolve) => {
		const image = new Image()
		image.onload = () =>
			resolve(
				new PanZoom({
					width: image.width,
					height: image.height,
					render: (ctx) => ctx.drawImage(image, 0, 0),
				}),
			)
		image.src = './svelte-kit-machine.webp'
	})
</script>

{#await viewer then pz}
	<canvas {@attach pz.attach}></canvas>
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
		pointer-events: none;
	}
	canvas {
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
