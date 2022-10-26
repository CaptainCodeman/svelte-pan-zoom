<script lang="ts">
	import { panzoom } from '$lib/panzoom'

	const image = new Image()
	const promise = new Promise<void>(resolve => {
		image.onload = () => resolve()
		image.src = '/Dragon-Clan.jpg?'
	})
</script>

{#await promise then}
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
