interface Point {
  x: number
  y: number
}

interface IdentifiedPoint {
  pointerId: number
  point: Point
}

export function panzoom(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  const dpr = window.devicePixelRatio
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  let width = canvas.width = canvas.clientWidth * dpr
  let height = canvas.height = canvas.clientHeight * dpr

  const gap = 20 * dpr
  const scale = Math.min(
    canvas.width / (image.width + gap),
    canvas.height / (image.height + gap)
  )

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.scale(scale, scale)
  ctx.translate(-image.width / 2, -image.height / 2)

  render()

  const resize_observer = new ResizeObserver(nodes => {
    const rect = nodes[0].contentRect

    const prev = transformedPoint({ x: width / 2, y: height / 2 })
    const transform = ctx.getTransform()

    width = rect.width * dpr
    height = rect.height * dpr

    canvas.width = width
    canvas.height = height

    ctx.imageSmoothingEnabled = false
    ctx.setTransform(transform)

    const middle = transformedPoint({ x: canvas.width / 2, y: canvas.height / 2 })
    ctx.translate(middle.x - prev.x, middle.y - prev.y)

    render()
  })

  resize_observer.observe(canvas)

  let pointers: IdentifiedPoint[] = []
  let init: Point
  let dist: number

  const onpointerdown = (event: PointerEvent) => {
    canvas.setPointerCapture(event.pointerId)

    const point = pointFromEvent(event)
    addPointer(event, point)

    switch (pointers.length) {
      case 1: {
        const p1 = point
        const p2 = transformedPoint({ x: canvas.width / 2, y: canvas.height / 2 })
        init = midpoint(p1, p2)
        dist = distance(p1, p2) / dpr
        break
      }
      case 2: {
        const p1 = pointers[0].point
        const p2 = pointers[1].point
        init = midpoint(p1, p2)
        dist = distance(p1, p2) / dpr
        break
      }
    }
  }

  const onpointerup = (event: PointerEvent) => {
    canvas.releasePointerCapture(event.pointerId)

    pointFromEvent(event)
    removePointer(event)
  }

  const onpointermove = (event: PointerEvent) => {
    const point = pointFromEvent(event)

    switch (pointers.length) {
      case 1: {
        // const init = getPointer(event)
        // const diff = subtract(transformedPoint(point), transformedPoint(init))
        // ctx.translate(diff.x, diff.y)
        // render()
        // updatePointer(event, point)
        // break
        updatePointer(event, point)

        const p1 = point
        const p2 = transformedPoint({ x: canvas.width / 2, y: canvas.height / 2 })

        const middle = midpoint(p1, p2)
        const d = distance(p1, p2) / dpr

        const diff = subtract(midpoint(p1, p2), init)
        ctx.translate(diff.x, diff.y)
        zoomOn(middle, d / dist)

        const matrix = ctx.getTransform()
        ctx.save()
        ctx.strokeStyle = '#f00'
        ctx.lineWidth = 48 / matrix.a
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.lineTo(p1.x, p1.y)
        ctx.stroke()
        ctx.closePath()
        ctx.restore()

        ctx.save()
        ctx.strokeStyle = '#00f'
        ctx.lineWidth = 48 / matrix.a
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
        ctx.closePath()
        ctx.restore()

        ctx.save()
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.strokeStyle = '#0f0'
        ctx.lineWidth = 24 / matrix.a
        ctx.lineTo(middle.x, middle.y)
        ctx.stroke()
        ctx.closePath()
        ctx.beginPath()
        ctx.strokeStyle = '#ff0'
        ctx.lineWidth = 8 / matrix.a
        ctx.arc(middle.x, middle.y, d, 0, Math.PI * 2)
        ctx.stroke()
        ctx.closePath()
        ctx.restore()

        break
      }
      case 2: {
        updatePointer(event, point)
        const p1 = pointers[0].point
        const p2 = pointers[1].point
        const middle = midpoint(p1, p2)
        const d = distance(p1, p2)

        const diff = subtract(middle, init)
        // ctx.translate(diff.x, diff.y)

        const m = ctx.getTransform()
        const z = d / dist

        // zoomOn(middle, 1.01)

        // ctx.translate(middle.x, middle.y)
        // ctx.scale(z, z)
        // ctx.translate(-middle.x, -middle.y)

        render()

        ctx.save()
        ctx.strokeStyle = '#ff0'
        ctx.lineWidth = 24
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.arc(middle.x, middle.y, d, 0, Math.PI * 2)
        // ctx.lineTo(middle.x, middle.y)
        ctx.stroke()
        ctx.closePath()
        ctx.restore()

        ctx.save()
        ctx.strokeStyle = '#f00'
        ctx.lineWidth = 60 * dpr
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.lineTo(p1.x, p1.y)
        ctx.stroke()
        ctx.closePath()
        ctx.restore()

        ctx.save()
        ctx.strokeStyle = '#00f'
        ctx.lineWidth = 60 * dpr
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
        ctx.closePath()
        ctx.restore()
        break
      }
    }
  }

  const onwheel = (event: WheelEvent) => {
    event.preventDefault()
    const point = pointFromEvent(event)
    const z = Math.exp(-event.deltaY / 500)
    zoomOn(point, z)
  }

  function zoomOn(point: Point, zoom: number) {
    // TODO: limit zoom in / out bounds
    ctx.translate(point.x, point.y)
    ctx.scale(zoom, zoom)
    ctx.translate(-point.x, -point.y)

    render()
  }

  function pointFromEvent(event: PointerEvent | WheelEvent): Point {
    event.stopPropagation()

    const x = event.offsetX * dpr
    const y = event.offsetY * dpr

    return transformedPoint({ x, y })
  }

  function transformedPoint(point: Point): Point {
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

  function getPointer(event: PointerEvent) {
    return pointers.find(p => p.pointerId === event.pointerId)!.point
  }

  function addPointer(event: PointerEvent, point: Point) {
    const { pointerId } = event
    pointers.push({ pointerId, point })
  }

  function removePointer(event: PointerEvent) {
    pointers = pointers.filter(p => p.pointerId !== event.pointerId)
  }

  function updatePointer(event: PointerEvent, point: Point) {
    const idx = pointers.findIndex(p => p.pointerId === event.pointerId)
    if (idx >= 0) {
      pointers[idx].point = point
    }
  }

  function distance(p1: Point, p2: Point) {
    const dx = p1.x - p2.x
    const dy = p1.y - p2.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  function midpoint(p1: Point, p2: Point): Point {
    const x = (p1.x + p2.x) / 2
    const y = (p1.y + p2.y) / 2
    return { x, y }
  }

  function subtract(p1: Point, p2: Point): Point {
    const x = p1.x - p2.x
    const y = p1.y - p2.y
    return { x, y }
  }

  canvas.addEventListener('pointerdown', onpointerdown, { passive: true })
  canvas.addEventListener('pointerup', onpointerup, { passive: true })
  canvas.addEventListener('pointermove', onpointermove, { passive: true })
  canvas.addEventListener('wheel', onwheel)

  return {
    destroy() {
      resize_observer.unobserve(canvas)

      canvas.removeEventListener('pointerdown', onpointerdown)
      canvas.removeEventListener('pointerup', onpointerup)
      canvas.removeEventListener('pointermove', onpointermove)
      canvas.removeEventListener('wheel', onwheel)
    }
  }
}