<script lang="ts">
	import { panzoom } from '$lib/panzoom'

	const promise = new Promise<HTMLImageElement>(resolve => {
		const image = new Image()
		image.onload = () => resolve(image)
		image.src = '/Dragon-Clan.jpg?'
	})
</script>

{#await promise then image}
	<canvas use:panzoom={image} />
{/await}

<style global>
	html,
	body,
	canvas {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		user-select: none;
	}

	canvas {
		touch-action: none;
		background-color: #ccc;
		image-rendering: pixelated;
	}
</style>
