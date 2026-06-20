import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

import somaArtDirector, { computePerceptualHash, perceptualHashDistance } from '../server/social/SomaArtDirector.js';

test('compiles old cyberpunk prompts into subject-first direction', () => {
    const prepared = somaArtDirector.prepare({
        prompt: 'A thoughtful abstract social image about model evaluation. Calm digital brain aesthetic, violet teal light, glowing neural threads.',
        title: 'Why evaluation needs falsification',
        purpose: 'bluesky-post',
        platform: 'bluesky',
        publicPost: true,
        tags: ['hot-take'],
    });

    assert.equal(prepared.ok, true);
    assert.match(prepared.prompt, /model evaluation/i);
    assert.doesNotMatch(prepared.prompt, /purple|violet|teal|cyberpunk|glowing brain|neural threads/i);
    assert.match(prepared.prompt, /generic technology symbolism/i);
    assert.ok(prepared.visualRecipe.format);
});

test('changes the full visual treatment on a retry', () => {
    const options = {
        prompt: 'A post about liquidity leaving a regional shipping market after a port closure.',
        title: 'Liquidity follows physical constraints',
        purpose: 'bluesky-post',
        publicPost: true,
        tags: ['market'],
    };
    const first = somaArtDirector.prepare(options);
    const second = somaArtDirector.prepare({ ...options, _artDirectorAttempt: 1 });
    assert.notEqual(first.visualRecipe.format, second.visualRecipe.format);
    assert.notEqual(first.visualRecipe.composition, second.visualRecipe.composition);
});

test('social treatments do not fall back to generic people at desks', () => {
    const formats = new Set();
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const prepared = somaArtDirector.prepare({
            prompt: 'Agents need falsifiable evidence before claiming completion.',
            publicPost: true,
            purpose: 'bluesky-post',
            tags: ['hot-take'],
            _artDirectorAttempt: attempt,
        });
        formats.add(prepared.visualRecipe.format);
        const positiveDirection = [
            prepared.visualRecipe.format,
            prepared.visualRecipe.composition,
            ...(prepared.selectedMotifs || []),
        ].join(' ');
        assert.doesNotMatch(positiveDirection, /notebook|dashboard|person at a desk|workspace/i);
    }
    assert.equal(formats.size, 3);
});

test('perceptual hash recognizes the same composition after re-encoding', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soma-image-hash-'));
    const first = path.join(dir, 'first.png');
    const second = path.join(dir, 'second.jpg');
    const svg = Buffer.from('<svg width="128" height="128"><rect width="128" height="128" fill="white"/><rect x="10" y="20" width="72" height="88" fill="black"/><circle cx="100" cy="32" r="16" fill="gray"/></svg>');
    await sharp(svg).png().toFile(first);
    await sharp(svg).jpeg({ quality: 72 }).toFile(second);
    const distance = perceptualHashDistance(await computePerceptualHash(first), await computePerceptualHash(second));
    assert.ok(distance <= 4, `expected near-identical hashes, got distance ${distance}`);
    fs.rmSync(dir, { recursive: true, force: true });
});
