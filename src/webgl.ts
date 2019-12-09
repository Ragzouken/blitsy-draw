import { createContext2D, Vector2 } from "blitsy";
import { withPixels } from "./draw";

const paletteShaderVert = `
uniform vec2 uOffset;
uniform vec2 uScale;

attribute vec2 aPosition;
attribute vec2 aTexcoord;
attribute vec4 aColor;

varying vec2 vTexcoord;
varying vec4 vColor;

void main() {
    vec2 position = (aPosition + uOffset) * uScale;
    gl_Position = vec4(position, 0.0, 1.0);
    vTexcoord = aTexcoord;
    vColor = aColor;
}
`;

const paletteShaderFrag = `
precision mediump float;

uniform sampler2D uSprite;
uniform sampler2D uPalette;

varying vec2 vTexcoord;
varying vec4 vColor;

void main() {
    float index = texture2D(uSprite, vTexcoord).r;
    gl_FragColor = texture2D(uPalette, vec2(index, .5)) * vColor;
}
`;

export type SceneObject = {
    canvas: HTMLCanvasElement,
    position: Vector2,
    tint?: number[],
};

export class PaletteRenderer
{
    public offset: Vector2 = { x: 0, y: 0 };
    public scale = 1;

    private readonly gl: WebGLRenderingContext;
    private readonly program: WebGLProgram;

    private readonly positionAttributeLocation: GLint;
    private readonly texcoordAttributeLocation: GLint;
    private readonly colorAttributeLocation: GLint;
    private readonly offsetUniformLocation: WebGLUniformLocation;
    private readonly scaleUniformLocation: WebGLUniformLocation;
    private readonly spriteUniformLocation: WebGLUniformLocation;
    private readonly paletteUniformLocation: WebGLUniformLocation;

    private readonly positionBuffer: WebGLBuffer;
    private readonly texcoordBuffer: WebGLBuffer;
    private readonly colorBuffer: WebGLBuffer;

    private readonly paletteContext: CanvasRenderingContext2D;
    private readonly paletteTexture: WebGLTexture;

    private readonly canvasTextures = new Map<HTMLCanvasElement, WebGLTexture>();

    constructor(webglContext: WebGLRenderingContext) {
        this.gl = webglContext;
        
        this.program = createProgramFromShaderSource(
            this.gl, 
            paletteShaderVert, 
            paletteShaderFrag,
        );
        
        this.positionAttributeLocation = this.gl.getAttribLocation(this.program, "aPosition");
        this.texcoordAttributeLocation = this.gl.getAttribLocation(this.program, "aTexcoord");
        this.colorAttributeLocation = this.gl.getAttribLocation(this.program, "aColor");
        this.offsetUniformLocation = this.gl.getUniformLocation(this.program, "uOffset")!;
        this.scaleUniformLocation =  this.gl.getUniformLocation(this.program, "uScale")!;
        this.spriteUniformLocation =  this.gl.getUniformLocation(this.program, "uSprite")!;
        this.paletteUniformLocation =  this.gl.getUniformLocation(this.program, "uPalette")!;
        
        this.positionBuffer = this.gl.createBuffer()!;
        this.texcoordBuffer = this.gl.createBuffer()!;
        this.colorBuffer = this.gl.createBuffer()!;

        this.paletteContext = createContext2D(256, 1);
        this.paletteTexture = createWebGLTexture(this.gl);
    }

    public setPalette(colors: number[]): void {
        withPixels(this.paletteContext, pixels => {
            for (let i = 0; i < 256; ++i) {
                pixels[i] = colors[i % colors.length];
            }
        });
        this.flushPalette();
    }

    public flushPalette(): void {
        copyCanvasToWebGLTexture(this.gl, this.paletteTexture, this.paletteContext.canvas);
    }

    public flushCanvas(canvas: HTMLCanvasElement): void {
        const texture = this.getCanvasTexture(canvas);
        copyCanvasToWebGLTexture(this.gl, texture, canvas);
    }

    public disposeCanvas(canvas: HTMLCanvasElement): void {
        this.removeCanvasTexture(canvas);
    }

    public renderScene(scene: SceneObject[]): void {
        const gl = this.gl;

        const positions = new Float32Array(6 * 2);
        const colors = new Float32Array(6 * 4);
        const texcoords = new Float32Array([
            0,0, 1,0, 1,1,
            0,0, 1,1, 0,1,
        ]);
        
        // set state (program, blending)
        gl.useProgram(this.program);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // set attributes (positions, texcoords)
        gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texcoordBuffer);
        gl.enableVertexAttribArray(this.texcoordAttributeLocation);
        gl.vertexAttribPointer(this.texcoordAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);
        gl.bufferData(this.gl.ARRAY_BUFFER, texcoords, this.gl.DYNAMIC_DRAW);

        gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(this.positionAttributeLocation);
        gl.vertexAttribPointer(this.positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);

        gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        gl.enableVertexAttribArray(this.colorAttributeLocation);
        gl.vertexAttribPointer(this.colorAttributeLocation, 4, this.gl.FLOAT, false, 0, 0);

        // set uniforms (tint, palette, sprite)
        const aspect = this.gl.canvas.height / this.gl.canvas.width;
        gl.uniform2fv(this.offsetUniformLocation, [this.offset.x, this.offset.y]);
        gl.uniform2fv(this.scaleUniformLocation, [this.scale * aspect, this.scale]);
        setUniformTexture(gl, this.paletteUniformLocation, this.paletteTexture, 0);

        for (let i = 0; i < scene.length; ++i) {
            const object = scene[i];
            const canvas = object.canvas;
            const [x, y] = [object.position.x, object.position.y];
            const [w, h] = [canvas.width, canvas.height];

            // texture
            const texture = this.getCanvasTexture(canvas);
            setUniformTexture(gl, this.spriteUniformLocation, texture, 1);

            // quad geometry
            positions.set([
                x,y, x+w,y,   x+w,y+h,
                x,y, x+w,y+h, x,  y+h,
            ]);
            
            const tint = object.tint || [1.0, 1.0, 1.0, 1.0];

            for (let i = 0; i < 6; ++i) {
                colors[i * 4 + 0] = tint[0];
                colors[i * 4 + 1] = tint[1];
                colors[i * 4 + 2] = tint[2];
                colors[i * 4 + 3] = tint[3];
            }

            gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
            gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.DYNAMIC_DRAW);
            gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
            gl.bufferData(this.gl.ARRAY_BUFFER, colors, this.gl.DYNAMIC_DRAW);
            
            // tint
            //gl.uniform4fv(this.tintUniformLocation, object.tint || [1.0, 1.0, 1.0, 1.0]);

            // draw the six vertexes (= 2 triangles = 1 quad)
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    }

    private getCanvasTexture(canvas: HTMLCanvasElement): WebGLTexture {
        let texture = this.canvasTextures.get(canvas);
        if (!texture) {
            texture = createWebGLTexture(this.gl);
            this.canvasTextures.set(canvas, texture);
            copyCanvasToWebGLTexture(this.gl, texture, canvas);
        }
        return texture;
    }

    private removeCanvasTexture(canvas: HTMLCanvasElement): void {
        let texture = this.canvasTextures.get(canvas);
        if (texture) {
            this.gl.deleteTexture(texture);
        }
    }
}

export function createWebGLTexture(context: WebGLRenderingContext): WebGLTexture {
    const texture = context.createTexture()!;
    context.bindTexture(context.TEXTURE_2D, texture);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.NEAREST);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.NEAREST);
    return texture;
}

export function setUniformTexture(
    context: WebGLRenderingContext,
    uniform: WebGLUniformLocation,
    texture: WebGLTexture,
    unit: number
) {
    context.activeTexture(context.TEXTURE0 + unit);
    context.bindTexture(context.TEXTURE_2D, texture);
    context.uniform1i(uniform, unit);
}

export function copyCanvasToWebGLTexture(
    context: WebGLRenderingContext,
    texture: WebGLTexture,
    canvas: HTMLCanvasElement
) {
    context.bindTexture(context.TEXTURE_2D, texture);
    context.texImage2D(
        context.TEXTURE_2D, 
        0, 
        context.RGBA, 
        context.RGBA, 
        context.UNSIGNED_BYTE, 
        canvas,
    );
}

export function linkBufferToAttribute(
    context: WebGLRenderingContext,
    buffer: WebGLBuffer,
    attibute: GLint,
): void {
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.enableVertexAttribArray(attibute);
    context.vertexAttribPointer(attibute, 2, context.FLOAT, false, 0, 0);
}

export function createShaderFromSource(
    context: WebGLRenderingContext,
    shaderType: number, 
    source: string,
): WebGLShader {
    const shader = context.createShader(shaderType)!;

    if (shader === null) {
        console.log("Couldn't create shader...");
    }

    context.shaderSource(shader, source);
    context.compileShader(shader);

    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
        console.log(context.getShaderInfoLog(shader));    
    }

    return shader;
};

export function createProgramFromShaderSource(
    context: WebGLRenderingContext,
    vertSource: string,
    fragSource: string,
): WebGLProgram {
    const vert = createShaderFromSource(context, context.VERTEX_SHADER, vertSource);
    const frag = createShaderFromSource(context, context.FRAGMENT_SHADER, fragSource);
    const program = context.createProgram()!;
    context.attachShader(program, vert);
    context.attachShader(program, frag);
    context.linkProgram(program);
    return program;
}
