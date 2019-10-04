import { rgbaToColor, encodeTexture } from "blitsy";
import FileSaver from "file-saver";

export function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomColor() {
    const rgba = { 
        r: randomInt(0, 255), 
        g: randomInt(0, 255), 
        b: randomInt(0, 255), 
        a: 255
    };

    return rgbaToColor(rgba);
}

export function downloadCanvasAsTexture(
    canvas: HTMLCanvasElement, 
    format = 'RGBA8', 
    name = "drawing",
): void {
    const context = canvas.getContext('2d')!;
    const data = encodeTexture(context, format);
    const json = JSON.stringify(data);
    const blob = new Blob([json], {type: "application/json;charset=utf-8"});
    FileSaver.saveAs(blob, `${name}.blitsy.json`);
}

export function downloadCanvasAsImage(
    canvas: HTMLCanvasElement,
    name = "drawing",
): void {
    canvas.toBlob(blob => {
        if (blob) {
            FileSaver.saveAs(blob, `${name}.png`);
        }
    });
}
