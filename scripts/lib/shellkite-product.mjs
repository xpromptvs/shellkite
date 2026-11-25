import {readFileSync} from 'node:fs';
export const product=Object.freeze(JSON.parse(readFileSync(new URL('../../config/product.json',import.meta.url),'utf8')));
