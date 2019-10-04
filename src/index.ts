import { createContext2D, Sprite, decodeAsciiTexture, imageToSprite, drawSprite, colorToHex, Vector2, makeVector2 } from 'blitsy';
import { drawLine, fillColor, recolor } from './draw';
import { brushData, drawIcon, lineIcon, fillIcon } from './icons';
import { randomColor, downloadCanvasAsTexture, downloadCanvasAsImage } from './utility';

const colors = Array.from({ length: 16 }).map(() => randomColor());
colors[0] = 0;
const brushes = brushData.map(data => imageToSprite(decodeAsciiTexture(data, 'X').canvas));

const HELD_KEYS = new Set<string>();
document.addEventListener("keydown", event => HELD_KEYS.add(event.key));
document.addEventListener("keyup", event => HELD_KEYS.delete(event.key));

type ToolType = "draw" | "line" | "fill";

function guessPivot(sprite: Sprite): [number, number] {
    return [Math.ceil(sprite.rect.w / 2), Math.ceil(sprite.rect.h / 2)];
}

export class Tool
{
    constructor(protected readonly app: BlitsyDraw) { }

    public cursor = "crosshair";
    public drawCursor(context: CanvasRenderingContext2D, pointer: Vector2): void { };
    public start(pointer: Vector2): void { };
    public move(pointer: Vector2): void { };
    public stop(pointer: Vector2): void { };
}

export class DrawTool extends Tool
{
    private lastPos: Vector2 | undefined = undefined;

    drawCursor(context: CanvasRenderingContext2D, pointer: Vector2): void
    {
        const brush = this.app.brushColored;
        const [ox, oy] = guessPivot(brush);
        drawSprite(context, brush, pointer.x - ox, pointer.y - oy);
    }

    start(pointer: Vector2): void
    {
        const brush = this.app.brushColored;
        const [ox, oy] = guessPivot(brush);
        drawSprite(this.app.drawingContext, brush, pointer.x - ox, pointer.y - oy);
        this.lastPos = makeVector2(pointer.x, pointer.y);
    }

    move(pointer: Vector2): void
    {
        if (!this.lastPos) return;
        const brush = this.app.brushColored;
        const [ox, oy] = guessPivot(brush);
        const [x0, y0] = [this.lastPos.x, this.lastPos.y];
        const [x1, y1] = [pointer.x, pointer.y];
        drawLine(this.app.drawingContext, brush, x0 - ox, y0 - oy, x1 - ox, y1 - oy);
        this.lastPos = makeVector2(pointer.x, pointer.y);
    }

    stop(pointer: Vector2): void
    {
        this.lastPos = undefined;
    }
}

export class LineTool extends Tool
{
    private startPos: Vector2 | undefined = undefined;

    drawCursor(context: CanvasRenderingContext2D, pointer: Vector2): void
    {
        const brush = this.app.brushColored;
        const [ox, oy] = guessPivot(brush);
        const [px, py] = [pointer.x, pointer.y];

        if (this.startPos) {
            const [sx, sy] = [this.startPos.x, this.startPos.y];
            drawLine(context, brush, sx - ox, sy - oy, px - ox, py - oy);
        } else {
            drawSprite(context, this.app.brushColored, px - ox, py - oy);
        }
    }

    start(pointer: Vector2): void
    {
        this.startPos = makeVector2(pointer.x, pointer.y);
    }

    stop(pointer: Vector2): void
    {
        if (!this.startPos) return;
        const brush = this.app.brushColored;
        const [ox, oy] = guessPivot(brush);
        const [x0, y0] = [this.startPos.x, this.startPos.y];
        const [x1, y1] = [pointer.x, pointer.y];
        drawLine(this.app.drawingContext, brush, x0 - ox, y0 - oy, x1 - ox, y1 - oy);
        this.startPos = undefined;
    }
}

export class FillTool extends Tool 
{
    start(pointer: Vector2): void
    {
        fillColor(this.app.drawingContext, this.app.activeColor, pointer.x, pointer.y);
    }
}

export class BlitsyDraw
{
    private readonly displayCanvas: HTMLCanvasElement;
    private readonly displayContext: CanvasRenderingContext2D;
    public readonly drawingContext: CanvasRenderingContext2D;

    public activeTool: ToolType = "draw";
    public activeBrush: Sprite;
    public activeColor = 0xFFFFFFFF;

    private readonly cursor: Vector2 = { x: 0, y: 0 };
    public brushColored: Sprite;

    private tools: {[tool: string]: Tool} = {};

    constructor()
    {
        const [width, height] = [128, 128];
        this.displayContext = createContext2D(width, height);
        this.displayCanvas = this.displayContext.canvas;
        this.displayCanvas.id = "display";
        document.getElementById("root")!.appendChild(this.displayContext.canvas);
        this.drawingContext = createContext2D(width, height);

        this.activeBrush = brushes[2];
        this.brushColored = recolor(this.activeBrush, this.activeColor);

        this.tools["draw"] = new DrawTool(this);
        this.tools["line"] = new LineTool(this);
        this.tools["fill"] = new FillTool(this);
    }

    public start(): void
    {
        const animate = (time: number) => {
            this.update(0);
            this.render();
            window.requestAnimationFrame(animate);
        };

        window.requestAnimationFrame(animate);

        window.addEventListener("pointerdown", event => this.onPointerDown(event));
        window.addEventListener("pointerup", event => this.onPointerUp(event));
        window.addEventListener("pointermove", event => this.onPointerMove(event));
    }

    public update(dt: number): void
    {
        this.updateBrush();
        this.render();
    }

    public render(): void
    {
        this.displayContext.clearRect(0, 0, this.displayContext.canvas.width, this.displayContext.canvas.height);
        this.displayContext.drawImage(this.drawingContext.canvas, 0, 0);

        const tool = this.tools[this.activeTool];
        this.displayCanvas.setAttribute("style", `cursor: ${tool.cursor}`);
        tool.drawCursor(this.displayContext, this.cursor);
    }

    private onPointerDown(event: PointerEvent): void
    {
        this.updateCursorFromEvent(event);
        this.updateBrush();
        this.tools[this.activeTool].start(this.cursor);
    }

    private onPointerUp(event: PointerEvent): void
    {
        this.updateCursorFromEvent(event);
        this.updateBrush();
        this.tools[this.activeTool].stop(this.cursor);
    }

    private onPointerMove(event: PointerEvent): void 
    {
        this.updateCursorFromEvent(event);
        this.updateBrush();
        this.tools[this.activeTool].move(this.cursor);               
    }

    private updateCursorFromEvent(event: PointerEvent): void
    {
        const canvas = this.displayContext.canvas as HTMLCanvasElement;
        const [sx, sy] = [canvas.width / canvas.scrollWidth, canvas.height / canvas.scrollHeight]
        this.cursor.x = Math.floor((event.pageX - this.displayCanvas.offsetLeft) * sx);
        this.cursor.y = Math.floor((event.pageY - this.displayCanvas.offsetTop) * sy);
    }

    private updateBrush(): void
    {
        const erase = this.activeColor === 0;

        const color = erase ? randomColor() : this.activeColor;
        this.brushColored = recolor(this.activeBrush, color);
        this.drawingContext.globalCompositeOperation = erase ? "destination-out" : "source-over";
    }
}

async function start()
{
    const app = new BlitsyDraw();
    app.start();

    const downloadTextureButton = document.getElementById("download-blitsy-texture") as HTMLButtonElement;
    downloadTextureButton.addEventListener("click", () => downloadCanvasAsTexture(app.drawingContext.canvas));
    const downloadImageButton = document.getElementById("download-image") as HTMLButtonElement;
    downloadImageButton.addEventListener("click", () => downloadCanvasAsImage(app.drawingContext.canvas));

    const brushContainer = document.getElementById("brushes")!;
    const brushButtons: HTMLElement[] = [];
    brushes.forEach(sprite => {
        const context = createContext2D(8, 8);
        drawSprite(context, sprite, 
                   4 - Math.floor(sprite.rect.w / 2), 
                   4 - Math.floor(sprite.rect.h / 2));
        const canvas = context.canvas as HTMLCanvasElement;
        brushContainer.appendChild(canvas);
        brushButtons.push(canvas);
        canvas.addEventListener("click", () => {
            if (app.activeTool === "fill") {
                app.activeTool = "draw";
            }
            app.activeBrush = sprite;
            brushButtons.forEach(button => button.removeAttribute("class"));
            canvas.setAttribute("class", "selected");
        });
    });
    brushButtons[2].setAttribute("class", "selected");

    const toolButtons: HTMLElement[] = [];
    function addButton(iconContext: CanvasRenderingContext2D, onClick: () => void) {
        const canvas = iconContext.canvas as HTMLCanvasElement;
        brushContainer.appendChild(canvas);
        toolButtons.push(canvas);
        canvas.addEventListener("click", () => {
            toolButtons.forEach(button => button.removeAttribute("class"));
            canvas.setAttribute("class", "selected");
            onClick();
        });
    }

    addButton(drawIcon, () => app.activeTool = "draw");
    addButton(lineIcon, () => app.activeTool = "line");
    addButton(fillIcon, () => app.activeTool = "fill");
    toolButtons[0].setAttribute("class", "selected");

    const colorContainer = document.getElementById("colors")!;
    const colorButtons: HTMLButtonElement[] = [];
    colors.forEach(color => {
        const button = document.createElement("button");
        button.setAttribute("style", `background-color: #${colorToHex(color)}`);
        colorButtons.push(button);
        colorContainer.appendChild(button);
        button.addEventListener("click", () => {
            app.activeColor = color;
            colorButtons.forEach(button => button.removeAttribute("class"));
            button.setAttribute("class", "selected");
        });
    });
}

start();
