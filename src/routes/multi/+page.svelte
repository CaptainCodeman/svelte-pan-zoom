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
		image.src = './svelte-kit-machine.webp'

		function render(ctx: CanvasRenderingContext2D) {
			ctx.drawImage(image, 0, 0)
		}
	})
</script>

<div>
	{#await promise then options}
		<canvas style:width="60%" style:background-color="#ccc" use:panzoom={options} />
		<canvas style:width="40%" style:background-color="#ddd" use:panzoom={options} />
		<canvas style:width="40%" style:background-color="#eee" use:panzoom={options} />
		<canvas style:width="60%" style:background-color="#fff" use:panzoom={options} />
	{/await}
</div>

<style>
	div {
		display: flex;
		flex-wrap: wrap;
	}
	canvas {
		box-sizing: border-box;
		width: 480px;
		height: 480px;
		margin: 0;
		padding: 0;
		user-select: none;
		touch-action: none;
		overscroll-behavior: none;
		-webkit-user-select: none; /* disable selection/Copy of UIWebView */
		-webkit-touch-callout: none; /* disable the IOS popup when long-press on a link */
	}
</style>
