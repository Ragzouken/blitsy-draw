import { createContext2D, decodeAsciiTexture, imageToSprite, drawSprite, colorToHex, hexToColor, rgbaToColor, imageToContext } from 'blitsy';
import { brushData } from './icons';
import { randomColor, randomPalette, fitColorsToPalette } from './utility';
import localForage from 'localforage';
import { BlitsyDrawEditor } from './editor';


let colors = randomPalette();
const brushes = brushData.map(data => imageToSprite(decodeAsciiTexture(data, 'X').canvas));

const HELD_KEYS = new Set<string>();
document.addEventListener("keydown", event => HELD_KEYS.add(event.key));
document.addEventListener("keyup", event => HELD_KEYS.delete(event.key));

type ToolType = "move" | "draw" | "line" | "fill";

async function start()
{
    localForage.keys().then(keys => {
        console.log(keys);
    }).catch(err => {
        console.log(err);
    });

    const editor = new BlitsyDrawEditor();
    editor.start();

    const createImageButton = document.getElementById("create-image-button") as HTMLButtonElement;
    const createWidthInput = document.getElementById("create-width-input") as HTMLInputElement;
    const createHeightInput = document.getElementById("create-height-input") as HTMLInputElement;

    createImageButton.addEventListener('click', () => {
        const width = parseInt(createWidthInput.value);
        const height = parseInt(createHeightInput.value);
        const image = createContext2D(width, height);
        editor.addContext(image);
    });

    //downloadImageButton.addEventListener("click", () => downloadCanvasAsImage(app.drawingContext.canvas));
    
    const uploadTextureInput = document.getElementById("upload-blitsy-texture-input") as HTMLInputElement;
    const uploadTextureButton = document.getElementById("upload-blitsy-texture-button") as HTMLButtonElement;
    uploadTextureButton.addEventListener("click", () => uploadTextureInput.click());
    uploadTextureInput.addEventListener("change", () => {
        const reader = new FileReader();
        reader.onload = () => {
            const json = reader.result as string;
            //app.drawingContext.drawImage(texture.canvas, 0, 0);
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
                const context = imageToContext(image);
                fitColorsToPalette(context, colors);
                editor.addContext(context);
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
            if (editor.activeTool === "fill") {
                setTool("draw");
            }
            editor.activeBrush = sprite;
            brushButtons.forEach(button => button.removeAttribute("class"));
            canvas.setAttribute("class", "selected");
        });
    });
    brushButtons[2].setAttribute("class", "selected");

    const toolButtons = new Map<ToolType, HTMLElement>();

    function setTool(tool: ToolType) {
        toolButtons.forEach(button => button.removeAttribute("class"));
        toolButtons.get(tool)!.setAttribute("class", "selected");
        editor.activeTool = tool;
    }

    function setToolButton(id: string, tool: ToolType) {
        const image = document.getElementById(id)!;
        toolButtons.set(tool, image);
        image.addEventListener("click", () => setTool(tool));
    }

    setToolButton("move-tool", "move");
    setToolButton("freehand-tool", "draw");
    setToolButton("line-tool", "line");
    setToolButton("fill-tool", "fill");
    setTool("draw");

    let selectedPaletteIndex = 0;

    editor.setPalette([
        0, 
        randomColor(), 
        randomColor(),
        0xFF0000FF,
        0xFFFF00FF,
        0xFF00FFFF,
    ]);

    const colorButtons: HTMLButtonElement[] = [];
    const editPaletteColorButton = document.getElementById("edit-palette-color-button") as HTMLButtonElement;
    const editPaletteColorInput = document.getElementById("edit-palette-color-input") as HTMLInputElement;
    editPaletteColorButton.addEventListener("click", () => {
        editPaletteColorInput.value = "#" + colorToHex(editor.activeColor);
        editPaletteColorInput.click();
    })
    editPaletteColorInput.addEventListener("input", () => {
        const htmlColor = editPaletteColorInput.value;
        const nextColor = hexToColor(editPaletteColorInput.value.slice(1));
        //replaceColor(app.drawingContext, prevColor, nextColor);
        colors[selectedPaletteIndex] = nextColor;
        colorButtons[selectedPaletteIndex].setAttribute("style", `background-color: ${htmlColor}`);
        editor.setPalette(colors);
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
            editor.activeColor = rgbaToColor({ r: i, g: 0, b: 0, a: 255 });
            selectedPaletteIndex = i;
            colorButtons.forEach(button => button.removeAttribute("class"));
            button.setAttribute("class", "selected");
            editPaletteColorButton.disabled = i === 0;
        });
    });

    const randomisePaletteButton = document.getElementById("randomise-palette")!;
    randomisePaletteButton.addEventListener("click", () => {
        const colors2 = randomPalette();
        colors = colors2;
        editor.setPalette(colors);
        colorButtons.forEach((button, i) => {
            button.setAttribute("style", `background-color: #${colorToHex(colors[i])}`);
        });
    });

    randomisePaletteButton.click();

    //const pickerRoot = document.getElementById("color-picker");
}

start();
