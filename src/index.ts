import { Context2D, createContext2D, Sprite, decodeAsciiTexture, canvasToSprite, drawSprite, encodeTexture, spriteToCanvas, imageToContext } from 'blitsy';
import FileSaver from 'file-saver';
import { bresenham, drawLine, fillColor } from './draw';

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

const brushes = brushData.map(data => canvasToSprite(decodeAsciiTexture(data, 'X').canvas));

const HELD_KEYS = new Set<string>();
document.addEventListener("keydown", event => HELD_KEYS.add(event.key));
document.addEventListener("keyup", event => HELD_KEYS.delete(event.key));

type Stroke = {startX: number, startY: number, lastX: number, lastY: number, type: "draw" | "line"};

export class BlitsyDraw
{
    private readonly displayCanvas: HTMLCanvasElement;
    private readonly displayContext: Context2D;
    public readonly drawingContext: Context2D;

    private readonly cursor = { x: 0, y: 0 };
    public brush: Sprite;
    private stroke: Stroke | undefined = undefined;

    constructor()
    {
        this.displayContext = createContext2D(256, 256);
        this.displayCanvas = this.displayContext.canvas;
        this.displayCanvas.id = "display";
        document.getElementById("root")!.appendChild(this.displayContext.canvas);
        this.drawingContext = createContext2D(256, 256);

        this.brush = brushes[2];
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
            drawLine(this.drawingContext, this.brush, x0 - 3, y0 - 3, x1 - 3, y1 - 3);
        };

        const beginStroke = (type: "draw" | "line") => {
            this.stroke = { startX: this.cursor.x, startY: this.cursor.y,
                            lastX: this.cursor.x, lastY: this.cursor.y, type };
            return this.stroke;
        };

        window.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                fillColor(this.drawingContext, 0xFFFFFFFF, this.cursor.x, this.cursor.y);
            }
        });

        window.addEventListener("pointerdown", event => {
            setCursor(event);

            if (HELD_KEYS.has('Shift')) {
                beginStroke("line");
            } else {
                const stroke = beginStroke("draw");
                drawSprite(this.drawingContext, this.brush, stroke.lastX - 3, stroke.lastY - 3);
            }
        });
        window.addEventListener("pointerup", event => {
            setCursor(event);
            if (this.stroke && this.stroke.type === "draw") {
                drawLine2(this.stroke.lastX, this.stroke.lastY, this.cursor.x, this.cursor.y);
                this.stroke = undefined;
            } else if (this.stroke && this.stroke.type === "line") {
                drawLine2(this.stroke.startX, this.stroke.startY, this.cursor.x, this.cursor.y);
                this.stroke = undefined;
            } else if (HELD_KEYS.has('Shift')) {
                beginStroke("line");
            } 
        });
        window.addEventListener("pointermove", event => {
            setCursor(event);
            
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

        if (this.stroke && this.stroke.type === "line") {
            bresenham(this.stroke.startX, 
                      this.stroke.startY, 
                      this.stroke.lastX, 
                      this.stroke.lastY, (x, y) => drawSprite(this.displayContext, this.brush, x - 3, y - 3));
        } else {
            drawSprite(this.displayContext, this.brush, 
                       this.cursor.x - 3, this.cursor.y - 3);
        }
    }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
