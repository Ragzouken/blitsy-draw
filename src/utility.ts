import { rgbaToColor, encodeTexture } from "blitsy";
import FileSaver from "file-saver";
import { withPixels } from "./draw";

export function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomColor() {
    const rgba = hsvToRgba({
        h: Math.random(),
        s: Math.random() * .75 + .25,
        v: Math.random() * .75 + .25,
    }, 255);

    return rgbaToColor(rgba);
}

export function randomPalette(): number[] {
    const colors = [0];

    for (let i = 0; i < 15; ++i) {
        const rgba = hsvToRgba({
            h: (i + Math.random()) / 15,
            s: Math.sqrt(Math.random()),
            v: Math.sqrt(Math.random()),
        }, 255);
        colors.push(rgbaToColor(rgba));
    }

    return colors;
}

export function remapColors(
    context: CanvasRenderingContext2D,
    prevPalette: number[],
    nextPalette: number[],
) {
    const map = new Map<number, number>();
    const count = prevPalette.length;

    for (let i = 0; i < count; ++i) {
        map.set(prevPalette[i], nextPalette[i]);
    }

    withPixels(context, pixels => {
        for (let i = 0; i < pixels.length; ++i) {
            pixels[i] = map.get(pixels[i])!;
        }
    });
}

export function replaceColor(context: CanvasRenderingContext2D, prev: number, next: number) {
    withPixels(context, pixels => {
        for (let i = 0; i < pixels.length; ++i) {
            if (pixels[i] == prev) {
                pixels[i] = next;
            }
        }
    });
}

export function hsvToRgba({ h, s, v}: {h:number,s:number,v:number}, a = 255) {
    let r = 0, g = 0, b = 0;
  
    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);
  
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
  
    r *= 255;
    g *= 255;
    b *= 255;

    return { r, g, b, a };
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
