// basic 2d geometry
interface Point {
  x: number
  y: number
}

const distance = (p1: Point, p2: Point) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2))
const midpoint = (p1: Point, p2: Point) => <Point>{ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
const subtract = (p1: Point, p2: Point) => <Point>{ x: p1.x - p2.x, y: p1.y - p2.y }

export function panzoom(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  const dpr = window.devicePixelRatio
  const ctx = canvas.getContext('2d')!

  let width = canvas.width = canvas.clientWidth * dpr
  let height = canvas.height = canvas.clientHeight * dpr

  const gap = 20 * dpr
  const max_scale = 50 * dpr
  let min_scale: number

  function initialize(image: HTMLImageElement) {
    min_scale = Math.min(
      canvas.width / (image.width + gap),
      canvas.height / (image.height + gap)
    )

    // transform so that 0, 0 is center of image in center of canvas
    ctx.resetTransform()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.scale(min_scale, min_scale)
    ctx.translate(-image.width / 2, -image.height / 2)
  }

  initialize(image)

  // handle canvas size changing
  const resize_observer = new ResizeObserver(nodes => {
    const rect = nodes[0].contentRect

    const prev = toImageSpace({ x: width / 2, y: height / 2 })
    const transform = ctx.getTransform()

    width = rect.width * dpr
    height = rect.height * dpr

    canvas.width = width
    canvas.height = height

    min_scale = Math.min(
      canvas.width / (image.width + gap),
      canvas.height / (image.height + gap)
    )

    ctx.imageSmoothingEnabled = false
    ctx.setTransform(transform)

    const middle = toImageSpace({ x: canvas.width / 2, y: canvas.height / 2 })
    ctx.translate(middle.x - prev.x, middle.y - prev.y)

    // forces zoom checks and render
    zoomOn(middle, 1)
  })

  resize_observer.observe(canvas)

  // active pointer count and positions
  const pointers = new Map<number, Point>()

  function onpointerdown(event: PointerEvent) {
    event.stopPropagation()
    canvas.setPointerCapture(event.pointerId)

    const point = pointFromEvent(event)
    pointers.set(event.pointerId, point)
  }

  function onpointerend(event: PointerEvent) {
    event.stopPropagation()
    canvas.releasePointerCapture(event.pointerId)

    pointers.delete(event.pointerId)
    // TODO: add momentum scrolling ?
  }

  function onpointermove(event: PointerEvent) {
    event.stopPropagation()

    // ignore if pointer not pressed
    if (!pointers.has(event.pointerId)) return

    const point = pointFromEvent(event)

    switch (pointers.size) {
      // single pointer move (pan)
      case 1: {
        const prev = pointers.get(event.pointerId)!
        const diff = subtract(toImageSpace(point), toImageSpace(prev))

        moveBy(diff)
        render()

        pointers.set(event.pointerId, point)

        break
      }
      // two pointer move (pinch zoom)
      case 2: {
        const prev_points = [...pointers.values()]
        const prev_p1 = toImageSpace(prev_points[0])
        const prev_p2 = toImageSpace(prev_points[1])
        const prev_middle = midpoint(prev_p1, prev_p2)
        const prev_dist = distance(prev_p1, prev_p2)

        pointers.set(event.pointerId, point)

        const points = [...pointers.values()]
        const p1 = toImageSpace(points[0])
        const p2 = toImageSpace(points[1])
        const middle = midpoint(p1, p2)
        const dist = distance(p1, p2)

        // move by distance that midpoint moved
        const diff = subtract(middle, prev_middle)
        moveBy(diff)

        // zoom by ratio of pinch sizes, on current middle
        const zoom = dist / prev_dist
        zoomOn(middle, zoom)

        // for debugging touch positions on mobile
        /*
        // get transform to use new zoom value to adjust sizes of indicators
        const matrix = ctx.getTransform()

        ctx.save()
        ctx.strokeStyle = '#f00'
        ctx.lineWidth = 64 / matrix.a
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.lineTo(p1.x, p1.y)
        ctx.stroke()
        ctx.closePath()
        ctx.restore()

        ctx.save()
        ctx.strokeStyle = '#00f'
        ctx.lineWidth = 64 / matrix.a
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
        ctx.closePath()
        ctx.restore()

        const radius = distance(points[0], points[1]) / 2

        ctx.save()
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.strokeStyle = '#0f0'
        ctx.lineWidth = 36 / matrix.a
        ctx.lineTo(middle.x, middle.y)
        ctx.stroke()
        ctx.closePath()
        ctx.beginPath()
        ctx.strokeStyle = '#ff0'
        ctx.lineWidth = 8 / matrix.a
        ctx.arc(middle.x, middle.y, radius / matrix.a, 0, Math.PI * 2)
        ctx.stroke()
        ctx.closePath()
        ctx.restore()
        */

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
  }

  function zoomOn(point: Point, zoom: number) {
    ctx.translate(point.x, point.y)
    ctx.scale(zoom, zoom)
    ctx.translate(-point.x, -point.y)

    const transform = ctx.getTransform()

    // limit min zoom to initial image size
    if (transform.a < min_scale) {
      ctx.translate(point.x, point.y)
      ctx.scale(min_scale / transform.a, min_scale / transform.a)
      ctx.translate(-point.x, -point.y)
    }

    // limit max zoom to "OMG, I see the pixels so large!"
    if (transform.a > max_scale) {
      ctx.translate(point.x, point.y)
      ctx.scale(max_scale / transform.a, max_scale / transform.a)
      ctx.translate(-point.x, -point.y)
    }

    render()
  }

  function pointFromEvent(event: PointerEvent | WheelEvent): Point {
    const x = event.offsetX * dpr
    const y = event.offsetY * dpr

    // point is in canvas space
    return { x, y }
  }

  function toImageSpace(point: Point): Point {
    const inverse = ctx.getTransform().invertSelf()

    const x = inverse.a * point.x + inverse.c * point.y + inverse.e
    const y = inverse.b * point.x + inverse.d * point.y + inverse.f

    return { x, y }
  }

  function render() {
    ctx.save()
    ctx.resetTransform()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()

    ctx.drawImage(image, 0, 0)
  }

  canvas.addEventListener('pointerdown', onpointerdown, { passive: true })
  canvas.addEventListener('pointerup', onpointerend, { passive: true })
  canvas.addEventListener('pointercancel', onpointerend, { passive: true })
  canvas.addEventListener('pointermove', onpointermove, { passive: true })
  canvas.addEventListener('wheel', onwheel)

  return {
    update(image: HTMLImageElement) {
      initialize(image)
    },
    destroy() {
      resize_observer.unobserve(canvas)

      canvas.removeEventListener('pointerdown', onpointerdown)
      canvas.removeEventListener('pointerup', onpointerend)
      canvas.removeEventListener('pointercancel', onpointerend)
      canvas.removeEventListener('pointermove', onpointermove)
      canvas.removeEventListener('wheel', onwheel)
    }
  }
}
