// Simple test script to verify link preview parser regex logic
async function runTest(url) {
    console.log(`\nFetching ${url}...`);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SOMA-AxisLinkPreview/1.0',
            }
        });
        const html = await response.text();

        const getMeta = (regex) => {
            const match = html.match(regex);
            return match ? match[1]?.trim() || match[2]?.trim() || '' : '';
        };

        const ogTitle = getMeta(/<meta\s+property=["']og:title["']\s+content=["']([\s\S]*?)["']/i) ||
                        getMeta(/<meta\s+content=["']([\s\S]*?)["']\s+property=["']og:title["']/i);
        
        const title = ogTitle ||
                      (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '');

        const ogDesc = getMeta(/<meta\s+property=["']og:description["']\s+content=["']([\s\S]*?)["']/i) ||
                       getMeta(/<meta\s+content=["']([\s\S]*?)["']\s+property=["']og:description["']/i);
        
        const description = ogDesc ||
                            getMeta(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i) ||
                            getMeta(/<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i);

        const image = getMeta(/<meta\s+property=["']og:image["']\s+content=["']([\s\S]*?)["']/i) ||
                      getMeta(/<meta\s+content=["']([\s\S]*?)["']\s+property=["']og:image["']/i);

        const siteName = getMeta(/<meta\s+property=["']og:site_name["']\s+content=["']([\s\S]*?)["']/i) ||
                         new URL(url).hostname;

        console.log('Parsed Metadata:', {
            title,
            description: description.slice(0, 100) + '...',
            image,
            siteName,
        });
    } catch (e) {
        console.error('Error during fetch/parse:', e.message);
    }
}

async function start() {
    await runTest('https://google.com');
    await runTest('https://github.com');
}

start();
