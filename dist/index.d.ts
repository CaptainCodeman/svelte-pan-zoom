type Render = (ctx: CanvasRenderingContext2D) => void;
interface Options {
    width: number;
    height: number;
    render: Render;
    padding?: number;
    maxZoom?: number;
}
declare function panzoom(canvas: HTMLCanvasElement, options: Options): {
    update(options: Options): void;
    destroy(): void;
};

export { Options, panzoom };
