import { SceneObject, PaletteRenderer } from "./webgl";
import { randomColor, randomInt } from "./utility";
import { makeVector2, Vector2, createContext2D } from "blitsy";
import { withPixels } from "./draw";

export class BlitsyDrawEditor
{
    private readonly sceneCanvas: HTMLCanvasElement;
    private readonly sceneContext: WebGLRenderingContext;
    private readonly sceneRenderer: PaletteRenderer;

    private scene: SceneObject[] = [];

    // actions
    private actionObject: SceneObject | undefined = undefined;
    private actionOffset = makeVector2(0, 0);

    constructor() {
        this.sceneCanvas = document.createElement('canvas');
        const container = document.getElementById('scene-container')!;
        container.appendChild(this.sceneCanvas);

        this.sceneContext = this.sceneCanvas.getContext('webgl', {'antialias': false})!;
        this.sceneRenderer = new PaletteRenderer(this.sceneContext);

        // pointer events
        this.sceneCanvas.addEventListener("pointerdown", event => this.onPointerDown(event));
        document.addEventListener("pointerup", event => this.onPointerUp(event));
        document.addEventListener("pointermove", event => this.onPointerMove(event));

        this.test();
    }
    
    public start(): void {
        const doRendering = () => {
            this.render();
            window.requestAnimationFrame(doRendering);
        }
        window.requestAnimationFrame(doRendering);
    }

    public render(): void {
        this.sceneRenderer.scale = 1 / 64;

        const w = this.sceneCanvas.clientWidth;
        const h = this.sceneCanvas.clientHeight;

        this.sceneCanvas.width = w;
        this.sceneCanvas.height = h;

        this.sceneContext.viewport(0, 0, w, h);
        this.sceneContext.clear(this.sceneContext.COLOR_BUFFER_BIT 
                              | this.sceneContext.DEPTH_BUFFER_BIT);
        this.sceneRenderer.renderScene(this.scene);
    }

    private test(): void {
        this.sceneRenderer.setPalette([0, randomColor(), randomColor()]);

        const test1 = generateTestDrawing(32, 16, 1);
        const test2 = generateTestDrawing(16, 24, .25);

        this.scene.length = 0;
        for (let i = 0; i < 4; ++i) {
            const object: SceneObject = { 
                canvas: Math.random() > .5 ? test1.canvas : test2.canvas,
                position: makeVector2(randomInt(-64, 64), randomInt(-32, 32)),
            };
            this.scene.push(object);
        }
    }

    private onPointerDown(event: PointerEvent): void {
        const cursor = this.mouseEventToSceneCoords(event);
        const hits = pointcastScene(this.scene, cursor);
        
        if (hits.length > 0) {
            const object = hits[hits.length - 1];

            this.actionObject = object;
            this.actionOffset = makeVector2(
                object.position.x - cursor.x,
                object.position.y - cursor.y,
            );

            // draw test
            const x = Math.floor(Math.abs(this.actionOffset.x));
            const y = Math.floor(Math.abs(this.actionOffset.y));
            const ctx = object.canvas.getContext('2d')!;
            ctx.fillStyle = "#010000";
            ctx.fillRect(x, y, 1, 1);
            this.sceneRenderer.flushCanvas(object.canvas);
        }

        event.preventDefault();
    }

    private onPointerUp(event: PointerEvent): void {
        this.actionObject = undefined;
        this.actionOffset = makeVector2(0, 0);
    }

    private onPointerMove(event: PointerEvent): void {
        // dragging
        if (this.actionObject) {
            const { x, y } = this.mouseEventToSceneCoords(event);
            this.actionObject.position.x = Math.round(x + this.actionOffset.x);
            this.actionObject.position.y = Math.round(y + this.actionOffset.y);
        }
    }

    private mouseEventToSceneCoords(event: MouseEvent): Vector2 {
        let [x, y] = [event.clientX, event.clientY];
        const [w, h] = [this.sceneCanvas.width, this.sceneCanvas.height];
        const offset = this.sceneRenderer.offset;
        const scale = this.sceneRenderer.scale;

        const rect = this.sceneCanvas.getBoundingClientRect();
        const aspect = w / h;

        // convert mouse cursor to canvas top-left relative
        x -= rect.left;
        y -= rect.top;

        // normalize with range -1 to 1 and invert Y
        let posX = (2 * (x / w)) - 1;
        let posY = (2 * ((h - y) / h)) - 1;

        posX *= aspect;

        return makeVector2(
            (posX / scale) - offset.x,
            (posY / scale) - offset.y,
        );
    }
}

function pointcastScene(scene: SceneObject[], point: Vector2): SceneObject[] {
    const hits: SceneObject[] = [];   
    for (let object of scene) {
        if (objectContainsPoint(object, point)) {
            hits.push(object);
        }
    }
    return hits;
}

function objectContainsPoint(object: SceneObject, point: Vector2): boolean {
    return point.x >= object.position.x
        && point.x <= object.position.x + object.canvas.width
        && point.y >= object.position.y
        && point.y <= object.position.y + object.canvas.height;
}

function generateTestDrawing(width: number, height: number, test: number): CanvasRenderingContext2D {
    const context = createContext2D(width, height);
    withPixels(context, pixels => {
        for (let i = 0; i < pixels.length; ++i) {
            pixels[i] = 0xFF000000 | randomInt(0, (i / 5) % 7);
        }
    });
    return context;
}

