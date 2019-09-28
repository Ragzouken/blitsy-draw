import { Context2D, createContext2D, Sprite, decodeAsciiTexture, canvasToSprite, drawSprite, encodeTexture } from 'blitsy';
import FileSaver from 'file-saver';

const brushTest = `
X_X_X
_X_X_
X_X_X
_X_X_
X_X_X
`;

const brushTest2 = `
_XXX_
XXXXX
XXXXX
XXXXX
_XXX_
`;

function bresenham(x0: number, y0: number, x1: number, y1: number, 
                   callback: (x: number, y: number) => void)
{
    const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);

    if (steep) {
        [x0, y0] = [y0, x0];
        [x1, y1] = [y1, x1];
    }    

    const reverse = x0 > x1;

    if (reverse) {
        [x0, x1] = [x1, x0];
        [y0, y1] = [y1, y0];
    }

    const dx = (x1 - x0);
    const dy = Math.abs(y1 - y0);

    const ystep = (y0 < y1 ? 1 : -1);

    let err = Math.floor(dx / 2);
    let y = y0;

    for (let x = x0; x <= x1; ++x) {
        if (steep) {
            callback(y, x);
        } else {
            callback(x, y);
        }

        err -= dy;

        if (err < 0) {
            y += ystep;
            err += dx;
        }
    }
}

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
    private brush: Sprite;
    private stroke: Stroke | undefined = undefined;

    constructor()
    {
        this.displayContext = createContext2D(256, 256);
        this.displayCanvas = this.displayContext.canvas;
        document.getElementById("root")!.appendChild(this.displayContext.canvas);
        this.drawingContext = createContext2D(256, 256);

        this.brush = canvasToSprite(decodeAsciiTexture(brushTest, "X").canvas);
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
        
        const withPixels = (action: (pixels: Uint32Array) => void) => {
            const image = this.drawingContext.getImageData(0, 0, 256, 256);
            action(new Uint32Array(image.data.buffer));
            this.drawingContext.putImageData(image, 0, 0);
        };

        const drawLine = (x0: number, y0: number, x1: number, y1: number) => {
            bresenham(x0, y0, x1, y1, (x, y) => drawSprite(this.drawingContext, this.brush, x - 3, y - 3));
        };

        const drawFill = (x: number, y: number) => {
            withPixels(pixels => {
                const queue = [{x, y}];
                const done = new Set<string>();
                const str = (x: number, y: number) => `${x},${y}`;
                const get = (x: number, y: number) => pixels[y * 256 + x];
                const set = (x: number, y: number, value: number) => pixels[y * 256 + x] = value;

                const initial = get(x, y);
                const white = 0xFFFFFFFF;

                function valid(x: number, y: number) {
                    const within = x >= 0 && y >= 0 && x < 256 && y < 256;

                    return within 
                        && get(x, y) === initial 
                        && !done.has(str(x, y));
                }

                function enqueue(x: number, y: number) {
                    if (valid(x, y)) {
                        queue.push({x, y});
                    }
                }

                while (queue.length > 0) {
                    const coord = queue.pop()!;
                    set(coord.x, coord.y, white);
                    done.add(str(coord.x, coord.y));

                    enqueue(coord.x - 1, coord.y);
                    enqueue(coord.x + 1, coord.y);
                    enqueue(coord.x, coord.y - 1);
                    enqueue(coord.x, coord.y + 1);
                }
            });
        };

        const beginStroke = (type: "draw" | "line") => {
            this.stroke = { startX: this.cursor.x, startY: this.cursor.y,
                            lastX: this.cursor.x, lastY: this.cursor.y, type };
            return this.stroke;
        };

        window.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                drawFill(this.cursor.x, this.cursor.y);
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
                drawLine(this.stroke.lastX, this.stroke.lastY, this.cursor.x, this.cursor.y);
                this.stroke = undefined;
            } else if (this.stroke && this.stroke.type === "line") {
                drawLine(this.stroke.startX, this.stroke.startY, this.cursor.x, this.cursor.y);
                this.stroke = undefined;
            } else if (HELD_KEYS.has('Shift')) {
                beginStroke("line");
            } 
        });
        window.addEventListener("pointermove", event => {
            setCursor(event);
            
            if (this.stroke && this.stroke.type === "draw") {
                drawLine(this.stroke.lastX, this.stroke.lastY, this.cursor.x, this.cursor.y);                
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
}

start();
