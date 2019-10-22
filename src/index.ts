import { createContext2D, Sprite, decodeAsciiTexture, imageToSprite, drawSprite, colorToHex, Vector2, makeVector2, decodeTexture, hexToColor } from 'blitsy';
import { drawLine, fillColor, recolor } from './draw';
import { brushData } from './icons';
import { randomColor, downloadCanvasAsTexture, downloadCanvasAsImage, randomPalette, remapColors, replaceColor } from './utility';
import localForage from 'localforage';
import { drawColorPickerWheel } from './color-picker';
import { PaletteTest } from './palette';

let drawingStore = localForage.createInstance({
    name: "blitsy-textures",
    description: "Assortment of blitsy-encoded textures for use in other compatible applications",
});

let colors = randomPalette();
const brushes = brushData.map(data => imageToSprite(decodeAsciiTexture(data, 'X').canvas));

const HELD_KEYS = new Set<string>();
document.addEventListener("keydown", event => HELD_KEYS.add(event.key));
document.addEventListener("keyup", event => HELD_KEYS.delete(event.key));

type ToolType = "draw" | "line" | "fill";

function guessPivot(sprite: Sprite): [number, number] {
    return [sprite.rect.w / 2, sprite.rect.h / 2];
}

function pivotPointer(sprite: Sprite, pointer: Vector2): [number, number] {
    const [ox, oy] = guessPivot(sprite);
    return [Math.round(pointer.x - ox), Math.round(pointer.y - oy)]; 
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
        const [x, y] = pivotPointer(brush, pointer);

        drawSprite(context, brush, x, y);
    }

    start(pointer: Vector2): void
    {
        const brush = this.app.brushColored;
        const [x, y] = pivotPointer(brush, pointer);
        drawSprite(this.app.drawingContext, brush, x, y);
        this.lastPos = makeVector2(pointer.x, pointer.y);
    }

    move(pointer: Vector2): void
    {
        if (!this.lastPos) return;
        const brush = this.app.brushColored;
        const [x0, y0] = pivotPointer(brush, this.lastPos);
        const [x1, y1] = pivotPointer(brush, pointer);
        drawLine(this.app.drawingContext, brush, x0, y0, x1, y1);
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
        const [px, py] = pivotPointer(brush, pointer);

        if (this.startPos) {
            const [sx, sy] = pivotPointer(brush, this.startPos);
            drawLine(context, brush, sx, sy, px, py);
        } else {
            drawSprite(context, this.app.brushColored, px, py);
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
        const [x0, y0] = pivotPointer(brush, this.startPos);
        const [x1, y1] = pivotPointer(brush, pointer);
        drawLine(this.app.drawingContext, brush, x0, y0, x1, y1);
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
        //drawColorPickerWheel(this.drawingContext);
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
    localForage.keys().then(keys => {
        console.log(keys);
    }).catch(err => {
        console.log(err);
    });

    const app = new BlitsyDraw();
    app.start();
    app.activeColor = colors[1];
    
    //const test = new PaletteTest(document.getElementsByTagName("body")[0]);

    const downloadTextureButton = document.getElementById("download-blitsy-texture") as HTMLButtonElement;
    downloadTextureButton.addEventListener("click", () => downloadCanvasAsTexture(app.drawingContext.canvas));
    const downloadImageButton = document.getElementById("download-image") as HTMLButtonElement;
    downloadImageButton.addEventListener("click", () => downloadCanvasAsImage(app.drawingContext.canvas));
    
    const uploadTextureInput = document.getElementById("upload-blitsy-texture-input") as HTMLInputElement;
    const uploadTextureButton = document.getElementById("upload-blitsy-texture-button") as HTMLButtonElement;
    uploadTextureButton.addEventListener("click", () => uploadTextureInput.click());
    uploadTextureInput.addEventListener("change", () => {
        const reader = new FileReader();
        reader.onload = () => {
            const json = reader.result as string;
            const data = JSON.parse(json);
            const texture = decodeTexture(data);
            app.drawingContext.drawImage(texture.canvas, 0, 0);
        };
        reader.readAsText(uploadTextureInput.files![0]);
    });

    const uploadImageInput = document.getElementById("upload-image-input") as HTMLInputElement;
    const uploadImageButton = document.getElementById("upload-image-button") as HTMLButtonElement;
    uploadImageButton.addEventListener("click", () => uploadImageInput.click());
    uploadImageInput.addEventListener("change", () => {
        const reader = new FileReader();
        reader.onload = event => {
            const image = document.createElement("img");
            image.onload = () => {
                app.drawingContext.drawImage(image, 0, 0);
            };
            image.src = event.target!.result as string;
        };
        reader.readAsDataURL(uploadImageInput.files![0]);
    });

    const brushContainer = document.getElementById("brushes")!;
    const brushButtons: HTMLElement[] = [];
    brushes.forEach(sprite => {
        const context = createContext2D(16, 16);
        drawSprite(context, sprite, 
                   8 - Math.ceil(sprite.rect.w / 2), 
                   8 - Math.ceil(sprite.rect.h / 2));
        const canvas = context.canvas as HTMLCanvasElement;
        brushContainer.appendChild(canvas);
        brushButtons.push(canvas);
        canvas.addEventListener("click", () => {
            if (app.activeTool === "fill") {
                setTool("draw");
            }
            app.activeBrush = sprite;
            brushButtons.forEach(button => button.removeAttribute("class"));
            canvas.setAttribute("class", "selected");
        });
    });
    brushButtons[2].setAttribute("class", "selected");

    const toolButtons = new Map<ToolType, HTMLElement>();

    function setTool(tool: ToolType) {
        toolButtons.forEach(button => button.removeAttribute("class"));
        toolButtons.get(tool)!.setAttribute("class", "selected");
        app.activeTool = tool;
    }

    function setToolButton(id: string, tool: ToolType) {
        const image = document.getElementById(id)!;
        toolButtons.set(tool, image);
        image.addEventListener("click", () => setTool(tool));
    }

    setToolButton("freehand-tool", "draw");
    setToolButton("line-tool", "line");
    setToolButton("fill-tool", "fill");
    setTool("draw");

    let selectedPaletteIndex = 0;

    const colorButtons: HTMLButtonElement[] = [];
    const editPaletteColorButton = document.getElementById("edit-palette-color-button") as HTMLButtonElement;
    const editPaletteColorInput = document.getElementById("edit-palette-color-input") as HTMLInputElement;
    editPaletteColorButton.addEventListener("click", () => {
        editPaletteColorInput.value = "#" + colorToHex(app.activeColor);
        editPaletteColorInput.click();
    })
    editPaletteColorInput.addEventListener("input", () => {
        const htmlColor = editPaletteColorInput.value;
        const prevColor = colors[selectedPaletteIndex];
        const nextColor = hexToColor(editPaletteColorInput.value.slice(1));
        replaceColor(app.drawingContext, prevColor, nextColor);
        colors[selectedPaletteIndex] = nextColor;
        colorButtons[selectedPaletteIndex].setAttribute("style", `background-color: ${htmlColor}`);
    });

    const colorContainer = document.getElementById("colors")!;
    colors.forEach((color, i) => {
        const button = document.createElement("button");
        if (i === 0) {
            button.setAttribute("id", "eraser");
        }
        button.setAttribute("style", `background-color: #${colorToHex(color)}`);
        colorButtons.push(button);
        colorContainer.appendChild(button);
        button.addEventListener("click", () => {
            app.activeColor = colors[i];
            selectedPaletteIndex = i;
            colorButtons.forEach(button => button.removeAttribute("class"));
            button.setAttribute("class", "selected");
            editPaletteColorButton.disabled = i === 0;
        });
    });

    const randomisePaletteButton = document.getElementById("randomise-palette")!;
    randomisePaletteButton.addEventListener("click", () => {
        const colors2 = randomPalette();
        remapColors(app.drawingContext, colors, colors2);
        colors = colors2;
        colorButtons.forEach((button, i) => {
            button.setAttribute("style", `background-color: #${colorToHex(colors[i])}`);
        });
    });

    //const pickerRoot = document.getElementById("color-picker");

}

start();
