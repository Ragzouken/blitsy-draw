import { decodeAsciiTexture } from "blitsy";

export const drawIcon = decodeAsciiTexture(`
________
_____X__
____X_X_
___X_X__
__XXX___
_X_X____
_XX_____
________
`, 'X');

export const lineIcon = decodeAsciiTexture(`
________
______X_
_____XX_
____XX__
___XX___
__XX____
_XX_____
________
`, 'X');

export const fillIcon = decodeAsciiTexture(`
________
_X_____X
_X____X_
_X__XXX_
_XXX__X_
_X____X_
__XXXX__
________
`, 'X');

export const brushData = [
`
X
`,
`
XX
XX
`,
`
_X_
XXX
_X_
`,
`
_XX_
XXXX
XXXX
_XX_
`,
`
_XXX_
XXXXX
XXXXX
XXXXX
_XXX_
`
];