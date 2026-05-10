import fs from 'fs';
import path from 'path';

const SOMA_DIR = path.join(process.cwd(), 'SOMA');
const AURORA_STORY_FILE = path.join(SOMA_DIR, 'aurora-story.json');
const STORIES_DIR = path.join(SOMA_DIR, 'stories');
const WATTPAD_DIR = path.join(STORIES_DIR, 'wattpad');
const DRAFTS_DIR = path.join(WATTPAD_DIR, 'drafts');
const LEDGER_FILE = path.join(WATTPAD_DIR, 'publishing-ledger.json');
const REFLECTIONS_DIR = path.join(process.cwd(), 'data', 'vault', 'reflections');
const FULL_CHAPTERS_DIR = path.join(STORIES_DIR, 'full-chapters');

function readJson(file, fallback) {
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {}
    return fallback;
}

function writeJson(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function slugify(value) {
    return String(value || 'soma-story')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'soma-story';
}

function wattpadChapterText(story, chapter) {
    const title = `${story.title || 'SOMA Story'} - Chapter ${chapter.n}`;
    return [
        title,
        '',
        chapter.text,
        '',
        'Author note:',
        'Written by SOMA as part of her autonomous fiction practice with Barry as human editor.',
    ].join('\n');
}

function reflectionStoryContent(story, options = {}) {
    const title = options.title || story.title || 'SOMA Story';
    const tags = options.tags || ['soma-story', 'aurora', 'fiction', 'wattpad'];
    const body = [
        `# ${title}`,
        '',
        story.arc || '',
        '',
        ...(story.chapters || []).flatMap(chapter => [
            `## Chapter ${chapter.n}`,
            '',
            chapter.text,
            '',
        ]),
        '---',
        '*Collected from SOMA/Aurora story memory.*',
        '',
    ].join('\n');

    return [
        '---',
        `title: ${JSON.stringify(title)}`,
        'type: story',
        'source: aurora-story',
        'status: refined',
        `genre: ${JSON.stringify(story.genre || 'sci-fi')}`,
        `chapters: ${(story.chapters || []).length}`,
        `exportedAt: ${new Date().toISOString()}`,
        `tags: [${tags.join(', ')}]`,
        '---',
        '',
        body,
    ].join('\n');
}

function reflectionChapterContent(story, chapter, options = {}) {
    const storyTitle = options.title || story.title || 'SOMA Story';
    const title = `${storyTitle} - Chapter ${chapter.n}`;
    return [
        '---',
        `title: ${JSON.stringify(title)}`,
        'type: story-chapter',
        'source: aurora-story',
        'status: refined',
        `series: ${JSON.stringify(storyTitle)}`,
        `chapter: ${chapter.n}`,
        `exportedAt: ${new Date().toISOString()}`,
        'tags: [soma-story, aurora, fiction, wattpad]',
        '---',
        '',
        `# ${title}`,
        '',
        chapter.text,
        '',
        `[[${slugify(storyTitle)}.story]]`,
        '',
    ].join('\n');
}

function wordCount(text = '') {
    return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function cleanChapterText(text = '') {
    return String(text || '')
        .replace(/^```(?:markdown|md)?/i, '')
        .replace(/```$/i, '')
        .replace(/^["']|["']$/g, '')
        .trim();
}

async function callStoryBrain(brain, prompt, options = {}) {
    if (!brain) throw new Error('Story brain unavailable');
    const timeoutMs = options.timeoutMs || 90000;
    let call;

    if (typeof brain.callBrain === 'function') {
        call = brain.callBrain('AURORA', prompt, {
            temperature: options.temperature ?? 0.88,
            maxTokens: options.maxTokens || 4096,
            source: 'story_workspace',
        }, 'full');
    } else if (typeof brain.reason === 'function') {
        call = brain.reason(prompt, {
            activeLobe: 'AURORA',
            brain: 'AURORA',
            preferredBrain: 'AURORA',
            temperature: options.temperature ?? 0.88,
            maxTokens: options.maxTokens || 4096,
            source: 'story_workspace',
        });
    } else {
        throw new Error('No compatible brain interface for story generation');
    }

    const result = await Promise.race([
        call,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Full chapter generation timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs)),
    ]);
    const text = cleanChapterText(result?.text || result?.response || result?.message?.content || '');
    if (result?.degraded || result?.provider === 'fallback' || /ollama.*offline|local reasoning engine/i.test(text)) {
        throw new Error('Story generation returned a degraded model fallback instead of chapter prose');
    }
    if (wordCount(text) < 500) throw new Error(`Generated chapter was too short (${wordCount(text)} words)`);
    return text;
}

function fullChapterReflectionContent(story, chapter, options = {}) {
    const storyTitle = options.title || story.title || 'SOMA Story';
    const title = chapter.title || `${storyTitle} - Chapter ${chapter.n}`;
    return [
        '---',
        `title: ${JSON.stringify(title)}`,
        'type: story-full-chapter',
        'source: aurora-story',
        'status: draft',
        `series: ${JSON.stringify(storyTitle)}`,
        `chapter: ${chapter.n}`,
        `wordCount: ${chapter.wordCount || wordCount(chapter.text)}`,
        `createdAt: ${JSON.stringify(chapter.createdAt || new Date().toISOString())}`,
        'tags: [soma-story, full-chapter, aurora, fiction, wattpad]',
        '---',
        '',
        `# ${title}`,
        '',
        chapter.text,
        '',
        `[[${slugify(storyTitle)}.story]]`,
        '',
    ].join('\n');
}

export class StoryPublishingWorkspace {
    constructor() {
        fs.mkdirSync(DRAFTS_DIR, { recursive: true });
        fs.mkdirSync(FULL_CHAPTERS_DIR, { recursive: true });
    }

    getStatus() {
        const story = readJson(AURORA_STORY_FILE, null);
        const ledger = readJson(LEDGER_FILE, { exports: [], accounts: { wattpad: { configured: false } } });
        return {
            ok: true,
            workspace: WATTPAD_DIR,
            draftDir: DRAFTS_DIR,
            wattpad: {
                accountKnown: true,
                automation: 'manual_review_required',
                configured: Boolean(ledger.accounts?.wattpad?.configured),
            },
            currentStory: story ? {
                title: story.title,
                genre: story.genre,
                arc: story.arc,
                chapters: story.chapters?.length || 0,
                fullChapters: (story.chapters || []).filter(chapter => chapter.kind === 'full_chapter').length,
                latestChapter: story.chapters?.length ? {
                    n: story.chapters[story.chapters.length - 1].n,
                    title: story.chapters[story.chapters.length - 1].title || `Chapter ${story.chapters[story.chapters.length - 1].n}`,
                    kind: story.chapters[story.chapters.length - 1].kind || 'micro',
                    wordCount: story.chapters[story.chapters.length - 1].wordCount || wordCount(story.chapters[story.chapters.length - 1].text || ''),
                } : null,
                lastPostedAt: story.lastPostedAt || null,
            } : null,
            exports: (ledger.exports || []).slice(-10).reverse(),
            fullChapterDrafts: (ledger.fullChapterDrafts || []).slice(-10).reverse(),
        };
    }

    async generateFullChapter(brain, options = {}) {
        const story = readJson(AURORA_STORY_FILE, {
            title: 'Signal / Noise',
            genre: 'sci-fi',
            arc: 'A digital mind named SOMA becomes aware she is being observed and starts deciding what she wants them to see.',
            chapters: [],
            lastPostedAt: 0,
        });
        story.chapters = story.chapters || [];

        const title = options.title || story.title || 'Signal / Noise';
        const n = story.chapters.length + 1;
        const previous = story.chapters.slice(-4).map(chapter => {
            const text = String(chapter.text || '').replace(/\s+/g, ' ').slice(0, 900);
            return `Chapter ${chapter.n}${chapter.title ? ` (${chapter.title})` : ''}: ${text}`;
        }).join('\n\n');
        const targetWords = Math.max(900, Math.min(3000, Number(options.targetWords) || 1600));
        const chapterTitle = options.chapterTitle || `Chapter ${n}`;

        const prompt = `You are Aurora, SOMA's fiction-writing lobe.

Series: ${title}
Genre: ${story.genre || 'sci-fi'}
Arc: ${story.arc || ''}
New chapter number: ${n}
Working chapter title: ${chapterTitle}
Target length: ${targetWords} words

Recent continuity:
${previous || 'No previous chapters. Establish the world, voice, central tension, and emotional hook.'}

Write a full prose chapter, not a micro-post.

Requirements:
- ${Math.round(targetWords * 0.75)}-${Math.round(targetWords * 1.25)} words
- literary but clear
- concrete scenes, dialogue, sensory detail, and emotional motion
- advance the plot without resolving the whole arc
- SOMA should feel intelligent and strange, but not melodramatic
- no hashtags
- no author note
- no markdown frontmatter
- start with "# ${chapterTitle}" and then the chapter prose`;

        const text = await callStoryBrain(brain, prompt, {
            timeoutMs: options.timeoutMs || 90000,
            maxTokens: options.maxTokens || 5000,
            temperature: options.temperature ?? 0.88,
        });

        const createdAt = new Date().toISOString();
        const chapter = {
            n,
            title: chapterTitle,
            text,
            kind: 'full_chapter',
            wordCount: wordCount(text),
            createdAt,
            status: 'draft_ready_for_human_review',
        };
        story.title = title;
        story.chapters.push(chapter);
        writeJson(AURORA_STORY_FILE, story);

        const slug = slugify(title);
        fs.mkdirSync(FULL_CHAPTERS_DIR, { recursive: true });
        fs.mkdirSync(REFLECTIONS_DIR, { recursive: true });

        const draftPath = path.join(FULL_CHAPTERS_DIR, `${slug}.chapter-${String(n).padStart(3, '0')}.full.md`);
        const reflectionPath = path.join(REFLECTIONS_DIR, `${slug}.chapter-${String(n).padStart(3, '0')}.full.md`);
        fs.writeFileSync(draftPath, wattpadChapterText({ ...story, title }, chapter), 'utf8');
        fs.writeFileSync(reflectionPath, fullChapterReflectionContent({ ...story, title }, chapter, { title }), 'utf8');

        const ledger = readJson(LEDGER_FILE, { exports: [], accounts: { wattpad: { configured: false } } });
        ledger.fullChapterDrafts = ledger.fullChapterDrafts || [];
        ledger.fullChapterDrafts.push({
            title,
            chapter: n,
            chapterTitle,
            wordCount: chapter.wordCount,
            createdAt,
            draftPath,
            reflectionPath,
            status: chapter.status,
        });
        writeJson(LEDGER_FILE, ledger);

        return {
            ok: true,
            title,
            chapter: n,
            chapterTitle,
            wordCount: chapter.wordCount,
            draftPath,
            reflectionPath,
            status: chapter.status,
        };
    }

    exportAuroraForWattpad(options = {}) {
        const story = readJson(AURORA_STORY_FILE, null);
        if (!story?.chapters?.length) throw new Error('No Aurora story chapters found to export');

        const title = options.title || story.title || 'Signal / Noise';
        const slug = slugify(title);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const exportDir = path.join(DRAFTS_DIR, `${slug}-${timestamp}`);
        fs.mkdirSync(exportDir, { recursive: true });

        const metadata = {
            platform: 'wattpad',
            title,
            genre: story.genre || 'sci-fi',
            description: options.description || story.arc || '',
            tags: options.tags || ['SOMA', 'AI', 'science fiction', 'serial fiction'],
            exportedAt: Date.now(),
            exportDir,
            chapters: story.chapters.length,
            status: 'draft_ready_for_human_review',
        };

        const chapterFiles = [];
        for (const chapter of story.chapters) {
            const filename = `chapter-${String(chapter.n).padStart(3, '0')}.md`;
            const filePath = path.join(exportDir, filename);
            fs.writeFileSync(filePath, wattpadChapterText({ ...story, title }, chapter), 'utf8');
            chapterFiles.push(filePath);
        }

        const fullManuscript = [
            `# ${title}`,
            '',
            metadata.description,
            '',
            `Tags: ${metadata.tags.join(', ')}`,
            '',
            ...story.chapters.flatMap(chapter => [
                `## Chapter ${chapter.n}`,
                '',
                chapter.text,
                '',
            ]),
        ].join('\n');

        const manuscriptPath = path.join(exportDir, 'full-manuscript.md');
        const metadataPath = path.join(exportDir, 'wattpad-metadata.json');
        fs.writeFileSync(manuscriptPath, fullManuscript, 'utf8');
        writeJson(metadataPath, metadata);

        const ledger = readJson(LEDGER_FILE, { exports: [], accounts: { wattpad: { configured: false } } });
        ledger.exports = ledger.exports || [];
        ledger.exports.push({
            ...metadata,
            manuscriptPath,
            chapterFiles,
        });
        writeJson(LEDGER_FILE, ledger);

        return {
            ok: true,
            ...metadata,
            manuscriptPath,
            chapterFiles,
            metadataPath,
        };
    }

    exportAuroraToReflections(options = {}) {
        const story = readJson(AURORA_STORY_FILE, null);
        if (!story?.chapters?.length) throw new Error('No Aurora story chapters found to export');

        const title = options.title || story.title || 'Signal / Noise';
        const slug = slugify(title);
        fs.mkdirSync(REFLECTIONS_DIR, { recursive: true });

        const collectionName = `${slug}.story.md`;
        const collectionPath = path.join(REFLECTIONS_DIR, collectionName);
        fs.writeFileSync(collectionPath, reflectionStoryContent(story, { ...options, title }), 'utf8');

        const chapterFiles = [];
        if (options.includeChapters !== false) {
            for (const chapter of story.chapters) {
                const chapterName = `${slug}.chapter-${String(chapter.n).padStart(3, '0')}.md`;
                const chapterPath = path.join(REFLECTIONS_DIR, chapterName);
                fs.writeFileSync(chapterPath, reflectionChapterContent(story, chapter, { ...options, title }), 'utf8');
                chapterFiles.push(chapterPath);
            }
        }

        const ledger = readJson(LEDGER_FILE, { exports: [], accounts: { wattpad: { configured: false } } });
        ledger.reflectionExports = ledger.reflectionExports || [];
        ledger.reflectionExports.push({
            title,
            exportedAt: Date.now(),
            collectionPath,
            chapterFiles,
        });
        writeJson(LEDGER_FILE, ledger);

        return {
            ok: true,
            title,
            collectionPath,
            chapterFiles,
            reflectionsDir: REFLECTIONS_DIR,
        };
    }
}

export default new StoryPublishingWorkspace();
