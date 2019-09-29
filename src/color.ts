export type RGBA = {r: number, g: number, b: number, a: number};

export function colorToHex(color: number): string {
    color = (color | 0xFF000000) >>> 0;
    const abgrHex = color.toString(16);
    return abgrHex.substr(6, 2) + abgrHex.substr(4, 2) + abgrHex.substr(2, 2);
}

export function rgbaToColor(rgba: RGBA): number {
    const {r, g, b, a} = rgba;
    return ((a << 24) | (b << 16) | (g << 8) | (r)) >>> 0;
}

export function colorToRgba(color: number): RGBA {
    return { r: (color >>  0) & 0xFF, 
             g: (color >>  8) & 0xFF,
             b: (color >> 16) & 0xFF,
             a: (color >> 24) & 0xFF };
}

export function rgbToHex(rgba: RGBA): string {
    return colorToHex(rgbaToColor(rgba));
}

export function hexToRgb(hex: string): RGBA {
    return colorToRgba(parseInt(hex, 16) | 0xFF000000);
}
