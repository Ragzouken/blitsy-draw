import { hsvToRgba } from "./utility";

/*
MIT License

Copyright (c) 2009 Mark Wonnacott
Copyright (c) 2016-2019 Adam Le Doux

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

export function drawColorPickerWheel(context: CanvasRenderingContext2D) {
    const [width, height] = [context.canvas.width, context.canvas.height];
    context.fillStyle = "black";
    const step = Math.PI / 180;

    const [cx, cy] = [width / 2, height / 2];
    const radius = cx;
    const v = Math.random();

    for (let angle = 0; angle <= 360; angle += 1) {
        const startAngle = (angle - 2) * step;
        const endAngle = angle * step;

        context.beginPath();
        context.moveTo(cx, cy);
        context.arc(cx, cy, radius, startAngle, endAngle, false);
        context.closePath();

        const color1 = hsvToRgba({ h: angle / 360, s: 0, v });
        const color2 = hsvToRgba({ h: angle / 360, s: 1, v });

        const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius );
        gradient.addColorStop(0, `rgb(${color1.r},${color1.g},${color1.b})`);
        gradient.addColorStop(1, `rgb(${color2.r},${color2.g},${color2.b})`);

        context.fillStyle = gradient;
        context.fill();
    }

}
