import { Context2D, Sprite, drawSprite, createContext2D, canvasToSprite, colorToHex } from "blitsy";

export function recolor(sprite: Sprite, color: number): Sprite {
    const [width, height] = [sprite.rect.w, sprite.rect.h];
    const context = createContext2D(width, height);
    context.fillStyle = '#' + colorToHex(color);
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "destination-in";
    drawSprite(context, sprite, 0, 0);
    return canvasToSprite(context.canvas);
};

export function withPixels(context: Context2D, 
                           action: (pixels: Uint32Array) => void) {
    const image = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    action(new Uint32Array(image.data.buffer));
    context.putImageData(image, 0, 0);
};

export function drawLine(context: Context2D, 
                         brush: Sprite, 
                         x0: number, y0: number, 
                         x1: number, y1: number) {
    bresenham(x0, y0, x1, y1, (x, y) => drawSprite(context, brush, x, y));
};

export function fillColor(context: Context2D, 
                          color: number, 
                          x: number, y: number) {
    const [width, height] = [context.canvas.width, context.canvas.height];
    withPixels(context, pixels => {
        const queue = [[x, y]];
        const done = new Array(width * height);
        const initial = pixels[y * width + x];

        function enqueue(x: number, y: number) {
            const within = x >= 0 && y >= 0 && x < width && y < height;

            if (within && pixels[y * width + x] === initial && !done[y * width + x]) {
                queue.push([x, y]);
            }
        }

        while (queue.length > 0) {
            const [x, y] = queue.pop()!;
            pixels[y * width + x] = color;
            done[y * width + x] = true;

            enqueue(x - 1, y);
            enqueue(x + 1, y);
            enqueue(x, y - 1);
            enqueue(x, y + 1);
        }
    });
};

export function bresenham(x0: number, y0: number, 
                          x1: number, y1: number, 
                          plot: (x: number, y: number) => void) {
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
            plot(y, x);
        } else {
            plot(x, y);
        }

        err -= dy;

        if (err < 0) {
            y += ystep;
            err += dx;
        }
    }
}

