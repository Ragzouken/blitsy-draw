import { SceneObject, PaletteRenderer } from "./webgl";
import { randomColor, randomInt, scaleVector2, subVector2, addVector2 } from "./utility";
import { makeVector2, Vector2, createContext2D, Sprite, drawSprite, MAGENTA_SPRITE_4X4 } from "blitsy";
import { withPixels, fillColor, drawLine, recolor } from "./draw";

function guessPivot(sprite: Sprite): [number, number] {
    return [sprite.rect.w / 2, sprite.rect.h / 2];
}

function pivotPointer(sprite: Sprite, pointer: Vector2): [number, number] {
    const [ox, oy] = guessPivot(sprite);
    return [Math.round(pointer.x - ox), Math.round(pointer.y - oy)]; 
}

type ToolType = "move" | "draw" | "line" | "fill";

type ToolPointer = {
    "scenePos": Vector2,
}

export class Tool
{
    constructor(protected readonly app: BlitsyDrawEditor) { }

    public cursor = "crosshair";
    public drawCursor(context: CanvasRenderingContext2D, pointer: Vector2): void { };
    public start(pointer: ToolPointer, object: SceneObject): void { };
    public move(pointer: ToolPointer): void { };
    public stop(pointer: ToolPointer): void { };

    public target: { object: SceneObject, context: CanvasRenderingContext2D } | undefined = undefined;
    
    protected setTarget(object: SceneObject): void {
        this.target = {
            object, 
            context: object.canvas.getContext('2d')!,
        }
    }

    protected scenePosToTargetPos(position: Vector2): Vector2 {
        return floorVector2(scenePointToLocalPoint(this.target!.object, position));
    }
}

export class MoveTool extends Tool
{
    public cursor = "move";

    private grabPos: Vector2 | undefined = undefined;

    start(pointer: ToolPointer, object: SceneObject): void
    {
        this.setTarget(object);
        const objectPos = this.scenePosToTargetPos(pointer.scenePos);
        this.grabPos = objectPos;
    }

    move(pointer: ToolPointer): void
    {
        if (!this.grabPos) return;

        const objectPos = this.scenePosToTargetPos(pointer.scenePos);

        const next = makeVector2(
            pointer.scenePos.x - this.grabPos.x, 
            pointer.scenePos.y - this.grabPos.y,
        );
        this.target!.object.position = floorVector2(next);
    }

    stop(pointer: ToolPointer): void
    {
        this.grabPos = undefined;
        this.target = undefined;
    }
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

    start(pointer: ToolPointer, object: SceneObject): void
    {
        this.setTarget(object);
        
        const objectPos = this.scenePosToTargetPos(pointer.scenePos);

        const brush = this.app.brushColored;
        const [x, y] = pivotPointer(brush, objectPos);
        drawSprite(this.target!.context, brush, x, y);
        this.lastPos = makeVector2(objectPos.x, objectPos.y);
    }

    move(pointer: ToolPointer): void
    {
        if (!this.lastPos) return;

        const objectPos = this.scenePosToTargetPos(pointer.scenePos);

        const brush = this.app.brushColored;
        const [x0, y0] = pivotPointer(brush, this.lastPos);
        const [x1, y1] = pivotPointer(brush, objectPos);
        drawLine(this.target!.context, brush, x0, y0, x1, y1);
        this.lastPos = makeVector2(objectPos.x, objectPos.y);
    }

    stop(pointer: ToolPointer): void
    {
        this.lastPos = undefined;
        this.target = undefined;
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

    start(pointer: ToolPointer, object: SceneObject): void
    {
        this.setTarget(object);
        const objectPos = this.scenePosToTargetPos(pointer.scenePos);
        
        this.startPos = makeVector2(objectPos.x, objectPos.y);
    }

    stop(pointer: ToolPointer): void
    {
        if (!this.startPos) return;

        const objectPos = this.scenePosToTargetPos(pointer.scenePos);

        const brush = this.app.brushColored;
        const [x0, y0] = pivotPointer(brush, this.startPos);
        const [x1, y1] = pivotPointer(brush, objectPos);
        drawLine(this.target!.context, brush, x0, y0, x1, y1);
        this.startPos = undefined;
    }
}

export class FillTool extends Tool 
{
    start(pointer: ToolPointer, object: SceneObject): void
    {
        this.setTarget(object);
        const objectPos = this.scenePosToTargetPos(pointer.scenePos);
        fillColor(this.target!.context, this.app.activeColor, objectPos.x, objectPos.y);
        this.target = undefined;
    }
}

export class BlitsyDrawEditor
{
    private readonly sceneCanvas: HTMLCanvasElement;
    private readonly sceneContext: WebGLRenderingContext;
    private readonly sceneRenderer: PaletteRenderer;

    private scene: SceneObject[] = [];
    private zoom: number = 0;

    // actions
    private actionObject: SceneObject | undefined = undefined;
    private actionOffset = makeVector2(0, 0);

    public activeTool: ToolType = "draw";
    public activeBrush: Sprite = MAGENTA_SPRITE_4X4;
    public activeColor = 0xFF0000;

    private readonly cursor: Vector2 = { x: 0, y: 0 };
    public brushColored: Sprite = MAGENTA_SPRITE_4X4;

    private tools: {[tool: string]: Tool} = {};

    constructor() {
        this.sceneCanvas = document.createElement('canvas');
        const container = document.getElementById('scene-container')!;
        container.appendChild(this.sceneCanvas);

        this.sceneContext = this.sceneCanvas.getContext('webgl', {'antialias': false})!;
        this.sceneRenderer = new PaletteRenderer(this.sceneContext);
        this.sceneRenderer.scale = 1 / 32;

        this.tools["move"] = new MoveTool(this);
        this.tools["draw"] = new DrawTool(this);
        this.tools["line"] = new LineTool(this);
        this.tools["fill"] = new FillTool(this);

        this.test();
    }
    
    public start(): void {
        const doRendering = () => {
            this.update(0);
            this.render();
            window.requestAnimationFrame(doRendering);
        }
        window.requestAnimationFrame(doRendering);

        this.sceneCanvas.addEventListener("wheel", event => this.onWheel(event));
        this.sceneCanvas.addEventListener("pointerdown", event => this.onPointerDown(event));
        document.addEventListener("pointerup", event => this.onPointerUp(event));
        document.addEventListener("pointermove", event => this.onPointerMove(event));
    }

    public update(dt: number): void
    {
        this.updateBrush();
        this.render();
        //drawColorPickerWheel(this.drawingContext);
    }

    public render(): void {
        const w = this.sceneCanvas.clientWidth;
        const h = this.sceneCanvas.clientHeight;

        this.sceneCanvas.width = w;
        this.sceneCanvas.height = h;

        const moveTarget = this.tools['move'].target;

        for (let object of this.scene) {
            const darken = !moveTarget || object === moveTarget.object;
            object.tint = [1, 1, 1, darken ? 1 : .25];
        }

        this.sceneContext.viewport(0, 0, w, h);
        this.sceneContext.clear(this.sceneContext.COLOR_BUFFER_BIT 
                              | this.sceneContext.DEPTH_BUFFER_BIT);
        this.sceneRenderer.renderScene(this.scene);
    }

    public setPalette(colors: number[]): void {
        this.sceneRenderer.setPalette(colors);
    }

    private test(): void {
        this.sceneRenderer.setPalette([
            0, 
            randomColor(), 
            randomColor(),
            0xFF0000FF,
            0xFFFF00FF,
            0xFF00FFFF,
        ]);

        const test1 = generateTestDrawing(64, 32, 1);
        const test2 = generateTestDrawing(32, 24, .25);

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
        const scenePos = this.mouseEventToSceneCoords(event);
        const hits = pointcastScene(this.scene, scenePos);
        
        if (hits.length > 0) {
            const object = hits[hits.length - 1];

            this.actionObject = object;
            this.actionOffset = makeVector2(
                object.position.x - scenePos.x,
                object.position.y - scenePos.y,
            );

            this.updateBrush();
            this.tools[this.activeTool].start({scenePos}, object);
            this.sceneRenderer.flushCanvas(object.canvas);
        }

        event.preventDefault();
    }

    private onPointerUp(event: PointerEvent): void {
        const scenePos = this.mouseEventToSceneCoords(event);

        this.updateBrush();
        this.tools[this.activeTool].stop({scenePos});
        if (this.actionObject)
            this.sceneRenderer.flushCanvas(this.actionObject!.canvas);

        this.actionObject = undefined;
        this.actionOffset = makeVector2(0, 0);
    }

    private onPointerMove(event: PointerEvent): void {
        const scenePos = this.mouseEventToSceneCoords(event);

        // dragging
        if (this.actionObject) {
            this.updateBrush();
            this.tools[this.activeTool].move({scenePos});
            this.sceneRenderer.flushCanvas(this.actionObject.canvas);
        }
    }

    private onWheel(event: WheelEvent): void
    {
        this.zoom += event.deltaY * -0.005;
        this.zoom = Math.min(Math.max(-2, this.zoom), 1);
        const scale = Math.pow(2, this.zoom);

        const mouseScenePosPrev = this.mouseEventToSceneCoords(event);
        this.sceneRenderer.scale = scale / 32;
        const mouseScenePosNext = this.mouseEventToSceneCoords(event);

        const delta = subVector2(mouseScenePosNext, mouseScenePosPrev);
        this.sceneRenderer.offset = addVector2(this.sceneRenderer.offset, delta);
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

    private updateBrush(): void
    {
        const erase = this.activeColor === 0;

        const color = erase ? randomColor() : this.activeColor;
        this.brushColored = recolor(this.activeBrush, color);
        this.sceneCanvas.setAttribute("style", `cursor: ${this.tools[this.activeTool].cursor};`);
        //this.drawingContext.globalCompositeOperation = erase ? "destination-out" : "source-over";
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

function floorVector2(vector: Vector2): Vector2 {
    return makeVector2(
        Math.floor(vector.x),
        Math.floor(vector.y),
    );
}

function scenePointToLocalPoint(object: SceneObject, local: Vector2): Vector2 {
    return makeVector2(
        local.x - object.position.x,
        local.y - object.position.y,
    );
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

