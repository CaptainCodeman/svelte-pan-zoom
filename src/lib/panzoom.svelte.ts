import { untrack } from 'svelte'
import type { Attachment } from 'svelte/attachments'

export interface Point {
	x: number
	y: number
}

/** Return `true` to keep the animation loop running. */
export type Render = (ctx: CanvasRenderingContext2D, t: number, focus: Point) => void | boolean

export interface Options {
	width: number
	height: number
	render: Render
	padding?: number
	maxZoom?: number
	friction?: number
}

interface TrackedPoint {
	point: Point
	t: number
}

const MIN_VELOCITY = 0.02
const TRACKED_DURATION = 120
const FRAME_MS = 1000 / 60
const PRELOAD_EVENTS = ['click', 'touchstart', 'mousedown', 'mousemove'] as const
const PRELOAD_OPTS: AddEventListenerOptions = { capture: true }
const PASSIVE: AddEventListenerOptions = { passive: true }

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

const callbacks = new WeakMap<Element, (entry: ResizeObserverEntry) => void>()
let observer: ResizeObserver | undefined

function observeResize(element: Element, callback: (entry: ResizeObserverEntry) => void) {
	observer ??= new ResizeObserver((entries) => {
		for (const entry of entries) {
			callbacks.get(entry.target)?.(entry)
		}
	})
	callbacks.set(element, callback)
	observer.observe(element)
	return () => {
		observer?.unobserve(element)
		callbacks.delete(element)
	}
}

function disablePreload(node: HTMLElement) {
	const stop = (event: Event) => event.stopPropagation()
	for (const type of PRELOAD_EVENTS) node.addEventListener(type, stop, PRELOAD_OPTS)
	node.setAttribute('data-sveltekit-preload-data', 'off')
	return () => {
		for (const type of PRELOAD_EVENTS) node.removeEventListener(type, stop, PRELOAD_OPTS)
		node.removeAttribute('data-sveltekit-preload-data')
	}
}

/**
 * Canvas pan/zoom controller.
 *
 * Transform is stored in view space (`x`, `y` translation and uniform `scale`)
 * rather than as a canvas matrix, so it can be read and written as Svelte state.
 *
 * ```svelte
 * <script>
 *   const viewer = new PanZoom({ width, height, render })
 * </script>
 *
 * <canvas {@attach viewer.attach}></canvas>
 * ```
 */
export class PanZoom {
	width = $state(0)
	height = $state(0)
	padding = $state(0)
	maxZoom = $state(16)
	friction = $state(0.97)
	render = $state<Render>(() => {})

	/** Last interaction point in content space. */
	focus = $state<Point>({ x: 0, y: 0 })

	#x = $state(0)
	#y = $state(0)
	#scale = $state(1)
	#viewWidth = $state(0)
	#viewHeight = $state(0)
	#dpr = 1

	minZoom = $derived.by(() => {
		const w = this.width + this.padding * this.#dpr
		const h = this.height + this.padding * this.#dpr
		if (this.#viewWidth <= 0 || this.#viewHeight <= 0 || w <= 0 || h <= 0) return 1
		return Math.min(this.#viewWidth / w, this.#viewHeight / h)
	})

	#canvas: HTMLCanvasElement | undefined
	#ctx: CanvasRenderingContext2D | undefined
	#frame = 0
	#pointers = new Map<number, Point>()
	#tracked: TrackedPoint[] = []
	#velocity = { vx: 0, vy: 0, ts: 0 }

	constructor(options: Options) {
		this.width = options.width
		this.height = options.height
		this.render = options.render
		this.padding = options.padding ?? 0
		this.maxZoom = options.maxZoom ?? 16
		this.friction = options.friction ?? 0.97
	}

	get x() {
		return this.#x
	}
	set x(value: number) {
		this.#x = value
		this.#scheduleRender()
	}

	get y() {
		return this.#y
	}
	set y(value: number) {
		this.#y = value
		this.#scheduleRender()
	}

	get scale() {
		return this.#scale
	}
	set scale(value: number) {
		this.#scale = value
		this.#clampScale()
		this.#scheduleRender()
	}

	/** Fit content to the canvas and clear momentum. */
	reset() {
		this.#stopMovement()
		this.#scale = this.minZoom
		this.#x = (this.#viewWidth - this.width * this.#scale) / 2
		this.#y = (this.#viewHeight - this.height * this.#scale) / 2
		this.focus = this.#toContent({ x: this.#viewWidth / 2, y: this.#viewHeight / 2 })
		this.#scheduleRender()
	}

	attach: Attachment<HTMLCanvasElement> = (canvas) => {
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		this.#canvas = canvas
		this.#ctx = ctx
		this.#dpr = window.devicePixelRatio
		this.#syncCanvasSize(canvas.clientWidth, canvas.clientHeight)

		const restorePreload = disablePreload(canvas)
		const unobserve = observeResize(canvas, (entry) => this.#onResize(entry))

		canvas.addEventListener('pointerdown', this.#onPointerDown, PASSIVE)
		canvas.addEventListener('pointerup', this.#onPointerEnd, PASSIVE)
		canvas.addEventListener('pointercancel', this.#onPointerEnd, PASSIVE)
		canvas.addEventListener('lostpointercapture', this.#onPointerEnd, PASSIVE)
		canvas.addEventListener('pointermove', this.#onPointerMove, PASSIVE)
		canvas.addEventListener('wheel', this.#onWheel)

		$effect(() => {
			this.width
			this.height
			this.padding
			untrack(() => this.reset())
		})

		$effect(() => {
			this.maxZoom
			this.render
			untrack(() => this.#clampScale())
			this.#scheduleRender()
		})

		return () => {
			this.#stopMovement()
			restorePreload()
			unobserve()
			canvas.removeEventListener('pointerdown', this.#onPointerDown)
			canvas.removeEventListener('pointerup', this.#onPointerEnd)
			canvas.removeEventListener('pointercancel', this.#onPointerEnd)
			canvas.removeEventListener('lostpointercapture', this.#onPointerEnd)
			canvas.removeEventListener('pointermove', this.#onPointerMove)
			canvas.removeEventListener('wheel', this.#onWheel)
			this.#pointers.clear()
			this.#canvas = undefined
			this.#ctx = undefined
		}
	}

	#syncCanvasSize(cssWidth: number, cssHeight: number) {
		this.#viewWidth = cssWidth * this.#dpr
		this.#viewHeight = cssHeight * this.#dpr
		if (this.#canvas) {
			this.#canvas.width = this.#viewWidth
			this.#canvas.height = this.#viewHeight
		}
	}

	#onResize(entry: ResizeObserverEntry) {
		const prev = this.#toContent({ x: this.#viewWidth / 2, y: this.#viewHeight / 2 })
		this.#dpr = window.devicePixelRatio
		this.#syncCanvasSize(entry.contentRect.width, entry.contentRect.height)
		this.#scale = Math.max(this.#scale, this.minZoom)
		this.#x = this.#viewWidth / 2 - prev.x * this.#scale
		this.#y = this.#viewHeight / 2 - prev.y * this.#scale
		this.focus = this.#toContent({ x: this.#viewWidth / 2, y: this.#viewHeight / 2 })
		if (!this.#frame) this.#renderFrame(performance.now())
	}

	#toContent(view: Point): Point {
		return {
			x: (view.x - this.#x) / this.#scale,
			y: (view.y - this.#y) / this.#scale,
		}
	}

	#pointFromEvent(event: PointerEvent | WheelEvent): Point {
		return { x: event.offsetX * this.#dpr, y: event.offsetY * this.#dpr }
	}

	#clampScale() {
		if (this.#scale < this.minZoom) this.#scale = this.minZoom
		else if (this.#scale > this.maxZoom) this.#scale = this.maxZoom
	}

	#constrain() {
		const w = this.width * this.#scale
		const h = this.height * this.#scale

		if (this.#x > this.#viewWidth) {
			this.#x = this.#viewWidth
			this.#velocity.vx = -this.#velocity.vx
		} else if (this.#x + w < 0) {
			this.#x = -w
			this.#velocity.vx = -this.#velocity.vx
		}

		if (this.#y > this.#viewHeight) {
			this.#y = this.#viewHeight
			this.#velocity.vy = -this.#velocity.vy
		} else if (this.#y + h < 0) {
			this.#y = -h
			this.#velocity.vy = -this.#velocity.vy
		}
	}

	#pan(dx: number, dy: number) {
		this.#x += dx
		this.#y += dy
		this.#constrain()
	}

	#zoomAt(point: Point, factor: number) {
		const content = this.#toContent(point)
		this.#scale = Math.min(this.maxZoom, Math.max(this.minZoom, this.#scale * factor))
		this.#x = point.x - content.x * this.#scale
		this.#y = point.y - content.y * this.#scale
		this.focus = content
		this.#constrain()
		this.#scheduleRender()
	}

	#prune(t: number) {
		while (this.#tracked.length && t - this.#tracked[0].t > TRACKED_DURATION) {
			this.#tracked.shift()
		}
	}

	#track(point: Point) {
		const t = performance.now()
		this.#prune(t)
		this.#tracked.push({ point, t })
	}

	#stopMovement() {
		if (this.#frame) {
			cancelAnimationFrame(this.#frame)
			this.#frame = 0
		}
		this.#velocity.vx = 0
		this.#velocity.vy = 0
		this.#tracked.length = 0
	}

	#onPointerDown = (event: PointerEvent) => {
		event.stopPropagation()
		this.#canvas?.setPointerCapture(event.pointerId)
		this.#pointers.set(event.pointerId, this.#pointFromEvent(event))
		this.#stopMovement()
	}

	#onPointerEnd = (event: PointerEvent) => {
		event.stopPropagation()
		if (!this.#pointers.has(event.pointerId)) return
		try {
			this.#canvas?.releasePointerCapture(event.pointerId)
		} catch {
			// already released (lostpointercapture)
		}
		this.#pointers.delete(event.pointerId)

		if (this.#pointers.size > 0) return

		this.#prune(performance.now())
		if (this.#tracked.length < 2) return

		const oldest = this.#tracked[0]
		const latest = this.#tracked[this.#tracked.length - 1]
		const dt = latest.t - oldest.t
		if (dt <= 0) return

		this.#velocity = {
			vx: (latest.point.x - oldest.point.x) / dt,
			vy: (latest.point.y - oldest.point.y) / dt,
			ts: performance.now(),
		}
		this.#scheduleRender()
	}

	#onPointerMove = (event: PointerEvent) => {
		event.stopPropagation()
		if (!this.#pointers.has(event.pointerId)) return

		const point = this.#pointFromEvent(event)

		if (this.#pointers.size === 1) {
			const prev = this.#pointers.get(event.pointerId)!
			this.#track(point)
			this.#pan(point.x - prev.x, point.y - prev.y)
			this.focus = this.#toContent(point)
			this.#pointers.set(event.pointerId, point)
			this.#scheduleRender()
			return
		}

		if (this.#pointers.size === 2) {
			const prev = [...this.#pointers.values()]
			const prevMid = midpoint(prev[0], prev[1])
			const prevDist = distance(prev[0], prev[1])
			this.#pointers.set(event.pointerId, point)
			const next = [...this.#pointers.values()]
			const mid = midpoint(next[0], next[1])
			const dist = distance(next[0], next[1])
			this.#pan(mid.x - prevMid.x, mid.y - prevMid.y)
			if (prevDist > 0) this.#zoomAt(mid, dist / prevDist)
		}
	}

	#onWheel = (event: WheelEvent) => {
		event.preventDefault()
		event.stopPropagation()
		this.#zoomAt(this.#pointFromEvent(event), Math.exp(-event.deltaY / 512))
	}

	#scheduleRender() {
		if (!this.#canvas || this.#frame) return
		this.#frame = requestAnimationFrame(this.#renderFrame)
	}

	#renderFrame = (t: number) => {
		const ctx = this.#ctx
		const canvas = this.#canvas
		if (!ctx || !canvas) {
			this.#frame = 0
			return
		}

		ctx.setTransform(1, 0, 0, 1, 0, 0)
		ctx.clearRect(0, 0, canvas.width, canvas.height)
		ctx.setTransform(this.#scale, 0, 0, this.#scale, this.#x, this.#y)

		const playing = this.render(ctx, t, this.focus) === true

		const moving = Math.hypot(this.#velocity.vx, this.#velocity.vy) > MIN_VELOCITY
		if (moving) {
			const dt = t - this.#velocity.ts
			this.#pan(this.#velocity.vx * dt, this.#velocity.vy * dt)
			const decay = Math.pow(this.friction, dt / FRAME_MS)
			this.#velocity.vx *= decay
			this.#velocity.vy *= decay
			this.#velocity.ts = t
		}

		this.#frame = moving || playing ? requestAnimationFrame(this.#renderFrame) : 0
	}
}

/** Attachment factory for the common case where view state is not needed. */
export function panzoom(options: Options): Attachment<HTMLCanvasElement> {
	return (canvas) => {
		// Create the instance inside the attachment, not in `{@attach panzoom(options)}`.
		// Constructing `$state` while Svelte is reading the attachment identity would
		// dirty that effect and tear the canvas down before the first frame paints.
		const viewer = untrack(() => new PanZoom(options))
		return viewer.attach(canvas)
	}
}
