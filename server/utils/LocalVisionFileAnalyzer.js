import fs from 'fs/promises';
import path from 'path';
import { appendVisionTruthAudit } from './VisionTruthAudit.js';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
let modelCache = { model: null, ts: 0 };

export function isImageFile(filePath = '', mimeType = '') {
    const ext = path.extname(filePath || '').toLowerCase();
    const mime = String(mimeType || '').toLowerCase();
    return IMAGE_EXTENSIONS.has(ext) || mime.startsWith('image/');
}

export function imageMimeType(filePath = '', fallback = 'image/png') {
    const ext = path.extname(filePath || '').toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.bmp') return 'image/bmp';
    return fallback;
}

function ollamaBaseUrl() {
    const raw = process.env.OLLAMA_HOST || process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
    const base = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    return base.replace(/\/api\/(?:generate|chat)\/?$/i, '').replace(/\/$/, '');
}

async function availableOllamaModels() {
    const response = await fetch(`${ollamaBaseUrl()}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error(`Ollama tags returned ${response.status}`);
    const data = await response.json();
    return Array.isArray(data.models) ? data.models : [];
}

export async function selectLocalVisionModel() {
    const configured = process.env.SOMA_LOCAL_VLM_MODEL || process.env.OLLAMA_VLM_MODEL || null;
    if (configured) return configured;
    const now = Date.now();
    if (modelCache.model && now - modelCache.ts < 30000) return modelCache.model;

    const models = await availableOllamaModels();
    const names = models.map(model => model.name || model.model).filter(Boolean);
    const visionNames = models
        .filter(model => Array.isArray(model.capabilities) && model.capabilities.includes('vision'))
        .map(model => model.name || model.model)
        .filter(Boolean);
    const preferred = [
        'qwen2.5vl:7b',
        'qwen2.5vl:latest',
        'llama3.2-vision:11b',
        'llama3.2-vision:latest',
        'minicpm-v:latest',
        'llava:latest',
        'llava',
        'moondream:latest',
        'moondream'
    ];
    const selected = preferred.find(name => names.includes(name) || visionNames.includes(name)) || visionNames[0] || null;
    if (!selected) throw new Error('No local Ollama vision model found.');
    modelCache = { model: selected, ts: now };
    return selected;
}

function extractJsonObject(text = '') {
    const raw = String(text || '').trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1] || raw;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
}

function clean(value = '', max = 1200) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function looksUncertain(text = '') {
    const value = clean(text, 500);
    if (value.length < 12) return true;
    return /\b(no image|no frame|no visual|cannot see|can't see|unable to (?:see|analy[sz]e)|not enough visual|unclear|too blurry|not visible)\b/i.test(value);
}

export async function analyzeImageFile(filePath, options = {}) {
    const buffer = await fs.readFile(filePath);
    const base64 = buffer.toString('base64');
    const model = options.model || await selectLocalVisionModel();
    const isMoondream = String(model).toLowerCase().includes('moondream');
    const prompt = isMoondream
        ? (options.prompt || 'Describe what is visible in this image in detail. Mention any visible text, windows, or objects.')
        : options.prompt || [
            'Analyze this image for SOMA file ingestion.',
            'Return ONLY JSON:',
            '{"summary":"factual description of visible contents","objects":["short labels"],"ocrText":null,"uncertain":false}',
            'If there is visible text, include it in ocrText.',
            'If the image is too dark, blurry, blank, or unclear, set uncertain:true.',
            'Describe only visible pixels. Do not infer beyond the image.'
        ].join('\n');

    const response = await fetch(`${ollamaBaseUrl()}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            prompt,
            images: [base64],
            stream: false,
            options: {
                temperature: 0.1,
                num_predict: Number(process.env.SOMA_LOCAL_VLM_FILE_TOKENS || 360)
            }
        }),
        signal: AbortSignal.timeout(Number(process.env.SOMA_LOCAL_VLM_TIMEOUT_MS || 120000))
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Local VLM ${model} returned ${response.status}: ${text.slice(0, 240)}`);
    }

    const data = await response.json();
    const raw = clean(data.response || '', 4000);
    const parsed = extractJsonObject(raw) || {};
    const summary = clean(parsed.summary || parsed.description || raw, 1200);
    const objects = Array.isArray(parsed.objects) ? parsed.objects.map(item => clean(typeof item === 'string' ? item : item?.label, 80)).filter(Boolean) : [];
    const ocrText = parsed.ocrText ? clean(parsed.ocrText, 2000) : null;
    const uncertain = parsed.uncertain === true || looksUncertain(summary || raw);

    const result = {
        success: true,
        model,
        mimeType: options.mimeType || imageMimeType(filePath),
        summary: summary || (uncertain ? 'The local vision model could not confidently describe this image.' : 'Image analyzed.'),
        objects,
        ocrText,
        uncertain,
        raw
    };
    appendVisionTruthAudit({
        type: options.auditType || 'file_image_analysis',
        claim: result.summary,
        summary: result.summary,
        source: options.auditSource || 'file-ingestion',
        engine: 'local-vlm',
        model,
        filePath,
        objects,
        ocrText,
        confidence: uncertain ? 0.35 : null,
        semanticAnalysis: !uncertain,
        uncertain,
        timestamp: Date.now()
    }).catch(err => {
        console.warn('[LocalVisionFileAnalyzer] Vision truth audit write failed:', err.message);
    });
    return result;
}

export function formatImageAnalysisForIngestion(result = {}, filePath = '') {
    const lines = [
        `[LOCAL VISION INGESTION] ${path.basename(filePath)}`,
        `Model: ${result.model || 'unknown'}`,
        `Confidence: ${result.uncertain ? 'uncertain' : 'usable'}`,
        '',
        'Summary:',
        result.summary || 'No visual summary produced.'
    ];
    if (result.objects?.length) lines.push('', `Objects: ${result.objects.join(', ')}`);
    if (result.ocrText) lines.push('', 'Visible text:', result.ocrText);
    return lines.join('\n').trim();
}

export default {
    analyzeImageFile,
    formatImageAnalysisForIngestion,
    imageMimeType,
    isImageFile,
    selectLocalVisionModel
};
