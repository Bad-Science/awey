// Create a branded type for RGB hex values
// type RGBHex = string & { __brand: 'RGBHex' };


export type Hexi = `#${string}`
export type Chroma = {
    hexi: Hexi
    luma: number
}

const CHROMA_VARIANTS = {

}

const chroma1: Chroma = {
    hexi: '#aaaaaa',
    luma: 0.5
}


export class ChromaError extends Error {
    constructor(message: string = 'Invalid RGB hex color') {
        super(message);
        this.name = 'ChromaError';
    }
}

export function chroma(color: string, luma: number = 0): Chroma {
    return {
        hexi: stringToHexi(color),
        luma: luma
    }
}

function stringToHexi(color: string): Hexi {
    if (isRawHex(color)) {
        return `#${color}`
    } else if (isPrefixedHex(color)) {
        return color
    } else {
        throw new ChromaError()
    }
}

function isRawHex(color: string): color is Hexi {
    return /^[0-9a-f]{6}$/i.test(color);
}

function isPrefixedHex(color: string): color is Hexi {
    return /^#[0-9a-f]{6}$/i.test(color);
}
















type RGBHexLit = `#${string extends infer T ? T extends { length: 6 } ? T : never : never}`;
const validHexLit: RGBHexLit = '#123456';

const validHex = createRGBHex('#123456');    // Works
const validHex2 = createRGBHex('#abcdef');   // Works
const invalidHex = createRGBHex('#12345g');   // Throws error
const invalidHex2 = createRGBHex('#12345');   // Throws error

const color = chroma('#123456');

