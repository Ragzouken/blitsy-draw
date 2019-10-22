export class PaletteTest
{
    private readonly canvas: HTMLCanvasElement;
    private readonly webgl: WebGL2RenderingContext;

    constructor(container: HTMLElement)
    {
        this.canvas = document.createElement("canvas");
        this.canvas.width = 256;
        this.canvas.height = 256;
        container.appendChild(this.canvas);
        this.webgl = this.canvas.getContext('webgl2')!;

        this.webgl.clearColor(1, 0, 1, 1);
        this.webgl.clear(this.webgl.COLOR_BUFFER_BIT);
    }
}
