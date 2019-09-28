import { Context2D, createContext2D, Sprite, decodeAsciiTexture, canvasToSprite, drawSprite } from 'blitsy';

const brushTest = `
_XXX_
XXXXX
XXXXX
XXXXX
_XXX_
`;

export class BlitsyDraw
{
    private readonly displayCanvas: HTMLCanvasElement;
    private readonly displayContext: Context2D;
    private readonly drawingContext: Context2D;

    private readonly cursor = { x: 0, y: 0};
    private brush: Sprite;

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
        
        window.addEventListener("pointerdown", event => {
            setCursor(event);
            drawSprite(this.drawingContext, this.brush, this.cursor.x - 3, this.cursor.y - 3);
        });
        window.addEventListener("pointermove", setCursor);
    }

    public update(dt: number): void
    {
        this.render();   
    }

    public render(): void
    {
        this.displayContext.clearRect(0, 0, 256, 256);
        this.displayContext.drawImage(this.drawingContext.canvas, 0, 0);

        drawSprite(this.displayContext, this.brush, 
                   this.cursor.x - 3, this.cursor.y - 3);
    }
}

async function start()
{
    const app = new BlitsyDraw();
    app.start();
}

start();
