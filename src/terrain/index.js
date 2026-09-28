// Vite puts a content hash in each file name, so a new build never reads a stale cached file.
import meta from './meta.json';
import coarseUrl from './smith-rock-coarse.bin?url';
import fullUrl from './smith-rock.bin?url';
import previewUrl from './ortho-preview.webp?url';
import ortho2kUrl from './ortho-2k.webp?url';
import ortho4kUrl from './ortho-4k.webp?url';

export const terrainFiles = { meta, coarseUrl, fullUrl, previewUrl, ortho2kUrl, ortho4kUrl };
