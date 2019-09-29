import { Context2D, createContext2D, Sprite, decodeAsciiTexture, canvasToSprite, drawSprite, encodeTexture, imageToContext } from 'blitsy';
import FileSaver from 'file-saver';
import { bresenham, drawLine, fillColor, recolor } from './draw';
import { rgbaToColor, colorToHex } from './color';

const drawIcon = decodeAsciiTexture(`
________
_____X__
____X_X_
___X_X__
__XXX___
_X_X____
_XX_____
________
`, 'X');

const lineIcon = decodeAsciiTexture(`
________
______X_
_____XX_
____XX__
___XX___
__XX____
_XX_____
________
`, 'X');

const fillIcon = decodeAsciiTexture(`
________
_X_____X
_X____X_
_X__XXX_
_XXX__X_
_X____X_
__XXXX__
________
`, 'X');

const brushData = [
`
X
`,
`
XX
XX
`,
`
_X_
XXX
_X_
`,
`
_XX_
XXXX
XXXX
_XX_
`,
`
_XXX_
XXXXX
XXXXX
XXXXX
_XXX_
`
];

function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomColor() {
    return rgbaToColor({ r: randomInt(0, 255), g: randomInt(0, 255), b: randomInt(0, 255), a: 255});
}

const colors = Array.from({ length: 16 }).map(i => randomColor());
const brushes = brushData.map(data => canvasToSprite(decodeAsciiTexture(data, 'X').canvas));

const HELD_KEYS = new Set<string>();
document.addEventListener("keydown", event => HELD_KEYS.add(event.key));
document.addEventListener("keyup", event => HELD_KEYS.delete(event.key));

type Tool = "draw" | "line" | "fill";
type Stroke = {startX: number, startY: number, lastX: number, lastY: number, type: "draw" | "line"};

function guessPivot(sprite: Sprite): [number, number] {
    return [Math.ceil(sprite.rect.w / 2), Math.ceil(sprite.rect.h / 2)];
}

export class BlitsyDraw
{
    private readonly displayCanvas: HTMLCanvasElement;
    private readonly displayContext: Context2D;
    public readonly drawingContext: Context2D;

    public activeTool: Tool = "draw";
    public activeColor = 0xFFFFFFFF;
    private readonly cursor = { x: 0, y: 0 };
    public brush: Sprite;
    private stroke: Stroke | undefined = undefined;

    private brushColored: Sprite;

    constructor()
    {
        this.displayContext = createContext2D(256, 256);
        this.displayCanvas = this.displayContext.canvas;
        this.displayCanvas.id = "display";
        document.getElementById("root")!.appendChild(this.displayContext.canvas);
        this.drawingContext = createContext2D(256, 256);

        this.brush = brushes[2];
        this.brushColored = recolor(this.brush, this.activeColor);
    }

    public start(): void
    {
        const animate = (time: number) => {
            this.update(0);
            this.render();
            window.requestAnimationFrame(animate);
        };

        window.requestAnimationFrame(animate);

        const setCursor = (event: PointerEvent) => {
            this.cursor.x = Math.floor((event.pageX - this.displayCanvas.offsetLeft) / 2);
            this.cursor.y = Math.floor((event.pageY - this.displayCanvas.offsetTop) / 2);
        };

        const drawLine2 = (x0: number, y0: number, x1: number, y1: number) => {
            const [ox, oy] = guessPivot(this.brush);
            drawLine(this.drawingContext, this.brushColored, x0 - ox, y0 - oy, x1 - ox, y1 - oy);
        };

        const beginStroke = (type: "draw" | "line") => {
            this.stroke = { startX: this.cursor.x, startY: this.cursor.y,
                            lastX: this.cursor.x, lastY: this.cursor.y, type };
            return this.stroke;
        };

        window.addEventListener("pointerdown", event => {
            setCursor(event);
            this.brushColored = recolor(this.brush, this.activeColor);

            if (this.activeTool === "fill") {
                fillColor(this.drawingContext, this.activeColor, this.cursor.x, this.cursor.y);
            } else if (HELD_KEYS.has('Shift') || this.activeTool === "line") {
                beginStroke("line");
            } else {
                const [ox, oy] = guessPivot(this.brush);
                const stroke = beginStroke("draw");
                drawSprite(this.drawingContext, this.brush, stroke.lastX - ox, stroke.lastY - oy);
            }
        });
        window.addEventListener("pointerup", event => {
            setCursor(event);
            this.brushColored = recolor(this.brush, this.activeColor);
            if (this.stroke && this.stroke.type === "draw") {
                drawLine2(this.stroke.lastX, this.stroke.lastY, this.cursor.x, this.cursor.y);
                this.stroke = undefined;
            } else if (this.stroke && this.stroke.type === "line") {
                drawLine2(this.stroke.startX, this.stroke.startY, this.cursor.x, this.cursor.y);
                this.stroke = undefined;
            } else if (HELD_KEYS.has('Shift') || this.activeTool === "line") {
                beginStroke("line");
            } 
        });
        window.addEventListener("pointermove", event => {
            setCursor(event);
            this.brushColored = recolor(this.brush, this.activeColor);
            
            if (this.stroke && this.stroke.type === "draw") {
                drawLine2(this.stroke.lastX, this.stroke.lastY, this.cursor.x, this.cursor.y);                
            }

            if (this.stroke) {
                this.stroke.lastX = this.cursor.x;
                this.stroke.lastY = this.cursor.y;
            }
        });
    }

    public update(dt: number): void
    {
        this.render();
    }

    public render(): void
    {
        this.displayContext.clearRect(0, 0, 256, 256);
        this.displayContext.drawImage(this.drawingContext.canvas, 0, 0);

        const [ox, oy] = guessPivot(this.brush);
        if (this.stroke && this.stroke.type === "line") {
            bresenham(this.stroke.startX, 
                      this.stroke.startY, 
                      this.stroke.lastX, 
                      this.stroke.lastY, (x, y) => drawSprite(this.displayContext, this.brushColored, x - ox, y - oy));
        } else {
            drawSprite(this.displayContext, this.brushColored, 
                       this.cursor.x - ox, this.cursor.y - oy);
        }
    }
}

async function start()
{
    const app = new BlitsyDraw();
    app.start();

    const button = document.getElementById("download-blitsy-texture") as HTMLButtonElement;
    button.addEventListener("click", () => {
        const json = JSON.stringify(encodeTexture(app.drawingContext, 'RGBA8'));
        const blob = new Blob([json], {type: "text/plain;charset=utf-8"});
        FileSaver.saveAs(blob, "drawing.blitsy.json");
    });

    const brushContainer = document.getElementById("brushes")!;
    brushes.forEach(sprite => {
        const context = createContext2D(8, 8);
        drawSprite(context, sprite, 
                   4 - Math.floor(sprite.rect.w / 2), 
                   4 - Math.floor(sprite.rect.h / 2));
        const canvas = context.canvas as HTMLCanvasElement;
        canvas.className = "brush";
        brushContainer.appendChild(canvas);
        canvas.addEventListener("click", () => {
            app.brush = sprite;
        });
    });

    function addButton(iconContext: Context2D, onClick: () => void) {
        const canvas = iconContext.canvas as HTMLCanvasElement;
        canvas.className = "brush";
        brushContainer.appendChild(canvas);
        canvas.addEventListener("click", onClick);
    }

    addButton(drawIcon, () => app.activeTool = "draw");
    addButton(lineIcon, () => app.activeTool = "line");
    addButton(fillIcon, () => app.activeTool = "fill");
    
    const colorContainer = document.getElementById("colors")!;
    colors.forEach(color => {
        const button = document.createElement("button");
        button.setAttribute("style", `background-color: #${colorToHex(color)}`);
        colorContainer.appendChild(button);
        button.addEventListener("click", () => {
            app.activeColor = color;
        });
    });

    const encodeInput = document.getElementById("encode-image")! as HTMLInputElement;
    const encodeImage = document.createElement("img");
    encodeInput.addEventListener("change", event => {
        const files = (event as any).target.files;
        if (!files || !files.length) return;
        const reader = new FileReader();
        reader.onload = function () {
            encodeImage.src = reader.result as string;
            encodeImage.addEventListener("load", () => {
                const data = encodeTexture(imageToContext(encodeImage), 'RGBA8');
                console.log(JSON.stringify(data));
            });
        }
        reader.readAsDataURL(files[0]);
    });
}

start();
