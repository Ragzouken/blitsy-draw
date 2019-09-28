import { Context2D, Sprite, drawSprite } from "blitsy";

export function withPixels(context: Context2D, 
                           action: (pixels: Uint32Array) => void) {
    const image = context.getImageData(0, 0, 256, 256);
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
    withPixels(context, pixels => {
        const queue = [{x, y}];
        const done = new Set<string>();
        const str = (x: number, y: number) => `${x},${y}`;
        const get = (x: number, y: number) => pixels[y * 256 + x];
        const set = (x: number, y: number, value: number) => pixels[y * 256 + x] = value;

        const initial = get(x, y);

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
            set(coord.x, coord.y, color);
            done.add(str(coord.x, coord.y));

            enqueue(coord.x - 1, coord.y);
            enqueue(coord.x + 1, coord.y);
            enqueue(coord.x, coord.y - 1);
            enqueue(coord.x, coord.y + 1);
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

