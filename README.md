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

let width = canvas.width = canvas.clientWidth _ dpr
let height = canvas.height = canvas.clientHeight _ dpr

const gap = 20 \* dpr
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
const point = pointFromEvent(event)
canvas.setPointerCapture(event.pointerId)
addPointer(event, point)

    switch (pointers.length) {
      case 1: {
        const p1 = transformedPoint(point)
        const p2 = transformedPoint({ x: canvas.width / 2, y: canvas.height / 2 })
        init = midpoint(p1, p2)
        dist = distance(p1, p2) / dpr
        console.log(init, dist)
        break
      }
      case 2: {
        const p1 = pointers[0].point
        const p2 = pointers[1].point
        init = midpoint(p1, p2)
        dist = distance(p1, p2) / dpr
        console.log(init, dist)
        break
      }
    }

}

const onpointerup = (event: PointerEvent) => {
pointFromEvent(event)
canvas.releasePointerCapture(event.pointerId)
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
        const p2 = { x: canvas.width / 2, y: canvas.height / 2 }

        const matrix = ctx.getTransform()

        const tp1 = transformedPoint(p1)
        const tp2 = transformedPoint(p2)

        const d = distance(tp1, tp2) / dpr
        const middle = midpoint(p1, p2)
        const m = transformedPoint(middle)

        const diff = subtract(midpoint(tp1, tp2), init)
        ctx.translate(diff.x, diff.y)

        zoomOn(m, d / dist)

        ctx.save()
        ctx.strokeStyle = '#f00'
        ctx.lineWidth = 48 / matrix.a
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.lineTo(tp1.x, tp1.y)
        ctx.stroke()
        ctx.closePath()
        ctx.restore()

        ctx.save()
        ctx.strokeStyle = '#00f'
        ctx.lineWidth = 48 / matrix.a
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.lineTo(tp2.x, tp2.y)
        ctx.stroke()
        ctx.closePath()
        ctx.restore()

        ctx.save()
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.strokeStyle = '#0f0'
        ctx.lineWidth = 24 / matrix.a
        ctx.lineTo(m.x, m.y)
        ctx.stroke()
        ctx.closePath()
        ctx.beginPath()
        ctx.strokeStyle = '#ff0'
        ctx.lineWidth = 8 / matrix.a
        ctx.arc(m.x, m.y, d, 0, Math.PI * 2)
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
        console.log(dist, d, dist / z, z, m.a, z / m.a, 1 - z)

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
const point = pointFromEvent(event)
const z = Math.exp(-event.deltaY / 500)
zoomOn(transformedPoint(point), z)
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

    return { x, y }

}

function transformedPoint(point: Point): Point {
const inverseTransform = ctx.getTransform().invertSelf()
const transformedX = inverseTransform.a _ point.x + inverseTransform.c _ point.y + inverseTransform.e
const transformedY = inverseTransform.b _ point.x + inverseTransform.d _ point.y + inverseTransform.f

    return {
      x: transformedX,
      y: transformedY,
    }

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
return Math.sqrt(dx _ dx + dy _ dy)
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
canvas.addEventListener('wheel', onwheel, { passive: true })

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
