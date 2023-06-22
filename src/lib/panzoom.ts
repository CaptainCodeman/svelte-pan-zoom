import { disablePreload } from 'svelte-disable-preload'
import { resize } from 'svelte-resize-observer-action'

export interface Point {
  x: number
  y: number
}

interface TrackedPoint {
  point: Point
  t: number   // time
}

interface Velocity {
  vx: number
  vy: number
  ts: number
}

// some basic 2d geometry
const distance = (p1: Point, p2: Point) => Math.hypot(p1.x - p2.x, p1.y - p2.y)
const midpoint = (p1: Point, p2: Point) => <Point>{ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
const subtract = (p1: Point, p2: Point) => <Point>{ x: p1.x - p2.x, y: p1.y - p2.y }

const MIN_VELOCITY = 0.02
const TRACKED_DURATION = 120

// return boolean indicates if rAF renders should be scheduled
// (i.e. there may be some animation that has to play)
type Render = (ctx: CanvasRenderingContext2D, t: number, focus: Point) => void | boolean

export interface Options {
  width: number
  height: number
  render: Render
  padding?: number
  maxZoom?: number
  friction?: number
}

export function panzoom(canvas: HTMLCanvasElement, options: Options) {
  const dpr = window.devicePixelRatio
  const ctx = canvas.getContext('2d')!
  const rAF = requestAnimationFrame

  let minZoom: number
  let width: number
  let height: number
  let render: Render
  let padding: number
  let maxZoom: number
  let friction: number
  let view_width = canvas.width = canvas.clientWidth * dpr
  let view_height = canvas.height = canvas.clientHeight * dpr
  let focus: Point
  let frame = 0
  let velocity: Velocity = { vx: 0, vy: 0, ts: 0 }

  // active pointer count and positions
  const pointers = new Map<number, Point>()

  // tracking for momentum
  const tracked: TrackedPoint[] = []

  function initialize(options: Options) {
    ({ width, height, render, padding, maxZoom, friction } = { padding: 0, maxZoom: 16, friction: 0.97, ...options })

    minZoom = Math.min(
      canvas.width / (width + (padding * dpr)),
      canvas.height / (height + (padding * dpr))
    )

    // transform so that 0, 0 is center of image in center of canvas
    ctx.resetTransform()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.scale(minZoom, minZoom)
    ctx.translate(-width / 2, -height / 2)

    stopMovement()

    focus = toImageSpace({ x: canvas.width / 2, y: canvas.height / 2 })

    scheduleRender()
  }

  initialize(options)

  const preloadAction = disablePreload(canvas)
  const resizeAction = resize(canvas, entry => {
    const rect = entry.contentRect
    const prev = toImageSpace({ x: view_width / 2, y: view_height / 2 })
    const transform = ctx.getTransform()

    view_width = rect.width * dpr
    view_height = rect.height * dpr

    canvas.width = view_width
    canvas.height = view_height

    minZoom = Math.min(
      canvas.width / (options.width + (padding * dpr)),
      canvas.height / (options.height + (padding * dpr))
    )

    ctx.setTransform(transform)

    focus = toImageSpace({ x: view_width / 2, y: view_height / 2 })

    ctx.translate(focus.x - prev.x, focus.y - prev.y)

    // if not animating, we need to repaint
    if (!frame) {
      renderFrame(performance.now())
    }
  })

  // prune the tracked events based on age
  function prune(t: number) {
    while (tracked.length && t - tracked[0].t > TRACKED_DURATION) {
      tracked.shift()
    }
  }

  function track(point: Point) {
    const t = performance.now()

    prune(t)

    tracked.push({ point, t })
  }

  function stopMovement() {
    if (frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }

    velocity.vx = 0
    velocity.vy = 0
    tracked.length = 0
  }

  // constrain image to viewport and "bounce" off trailing image edges
  function checkBounds() {
    const tl = toImageSpace({ x: 0, y: 0 })
    const br = toImageSpace({ x: canvas.width, y: canvas.height })

    if (tl.x > width) {
      ctx.translate(tl.x - width, 0)
      velocity.vx = -velocity.vx
    }

    if (tl.y > height) {
      ctx.translate(0, tl.y - height)
      velocity.vy = -velocity.vy
    }

    if (br.x < 0) {
      ctx.translate(br.x, 0)
      velocity.vx = -velocity.vx
    }

    if (br.y < 0) {
      ctx.translate(0, br.y)
      velocity.vy = -velocity.vy
    }
  }

  function onpointerdown(event: PointerEvent) {
    event.stopPropagation()
    canvas.setPointerCapture(event.pointerId)

    const point = pointFromEvent(event)
    pointers.set(event.pointerId, point)

    stopMovement()
  }

  function onpointerend(event: PointerEvent) {
    event.stopPropagation()
    canvas.releasePointerCapture(event.pointerId)

    pointers.delete(event.pointerId)

    // if last pointer, check for velocity
    if (pointers.size === 0) {
      prune(performance.now())

      if (tracked.length > 1) {
        // calc movement
        const oldest = tracked[0]
        const latest = tracked[tracked.length - 1]

        // calc velocity
        const x = latest.point.x - oldest.point.x
        const y = latest.point.y - oldest.point.y
        const t = latest.t - oldest.t

        velocity = {
          vx: x / t,
          vy: y / t,
          ts: performance.now()
        }

        scheduleRender()
      }
    }
  }

  function onpointermove(event: PointerEvent) {
    event.stopPropagation()

    // ignore if pointer not pressed
    if (!pointers.has(event.pointerId)) return

    const point = pointFromEvent(event)

    switch (pointers.size) {
      // single pointer move (pan)
      case 1: {
        const curr = toImageSpace(point)
        track(curr)

        const prev = pointers.get(event.pointerId)!
        const diff = subtract(curr, toImageSpace(prev))

        focus = curr

        moveBy(diff)
        scheduleRender()

        pointers.set(event.pointerId, point)

        break
      }
      // two pointer move (pinch zoom _and_ pan)
      case 2: {
        let points = [...pointers.values()]
        let p1 = toImageSpace(points[0])
        let p2 = toImageSpace(points[1])
        const prev_middle = midpoint(p1, p2)
        const prev_dist = distance(p1, p2)

        pointers.set(event.pointerId, point)

        points = [...pointers.values()]
        p1 = toImageSpace(points[0])
        p2 = toImageSpace(points[1])
        const middle = midpoint(p1, p2)
        const dist = distance(p1, p2)

        // move by distance that midpoint moved
        const diff = subtract(middle, prev_middle)
        moveBy(diff)

        // zoom by ratio of pinch sizes, on current middle
        const zoom = dist / prev_dist
        zoomOn(middle, zoom)

        break
      }
    }
  }

  function onwheel(event: WheelEvent) {
    event.preventDefault()
    event.stopPropagation()

    const point = pointFromEvent(event)
    const z = Math.exp(-event.deltaY / 512)

    zoomOn(toImageSpace(point), z)
  }

  function moveBy(delta: Point) {
    ctx.translate(delta.x, delta.y)
    checkBounds()
  }

  function zoomOn(point: Point, zoom: number) {
    function scale(value: number) {
      ctx.translate(point.x, point.y)
      ctx.scale(value, value)
      ctx.translate(-point.x, -point.y)
    }

    scale(zoom)

    const transform = ctx.getTransform()

    // limit min zoom to initial image size
    if (transform.a < minZoom) {
      scale(minZoom / transform.a)
    }

    // limit max zoom to "OMG, I see the pixels so large!"
    if (transform.a > maxZoom) {
      scale(maxZoom / transform.a)
    }

    focus = point

    scheduleRender()
  }

  function pointFromEvent(event: PointerEvent | WheelEvent): Point {
    // point is in canvas space
    return { x: event.offsetX * dpr, y: event.offsetY * dpr }
  }

  function toImageSpace(point: Point): Point {
    const inverse = ctx.getTransform().inverse()
    return inverse.transformPoint(point)
  }

  function scheduleRender() {
    if (!frame) {
      frame = rAF(renderFrame)
    }
  }

  function renderFrame(t: number) {
    ctx.save()
    ctx.resetTransform()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()

    const playing = render(ctx, t, focus)

    const transform = ctx.getTransform()
    const distance = Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy) * transform.a
    const moving = distance > MIN_VELOCITY

    if (moving) {
      const ts = t - velocity.ts
      const x = velocity.vx * ts
      const y = velocity.vy * ts

      moveBy({ x, y })

      velocity.vx *= friction
      velocity.vy *= friction
      velocity.ts = t
    }

    if (moving || playing) {
      frame = rAF(renderFrame)
    } else {
      frame = 0
    }
  }

  const makePassive = { passive: true }

  canvas.addEventListener('pointerdown', onpointerdown, makePassive)
  canvas.addEventListener('pointerup', onpointerend, makePassive)
  canvas.addEventListener('pointercancel', onpointerend, makePassive)
  canvas.addEventListener('pointermove', onpointermove, makePassive)
  canvas.addEventListener('wheel', onwheel)

  return {
    update(options: Options) {
      initialize(options)
    },
    destroy() {
      preloadAction.destroy()
      resizeAction.destroy()

      canvas.removeEventListener('pointerdown', onpointerdown)
      canvas.removeEventListener('pointerup', onpointerend)
      canvas.removeEventListener('pointercancel', onpointerend)
      canvas.removeEventListener('pointermove', onpointermove)
      canvas.removeEventListener('wheel', onwheel)
    }
  }
}
