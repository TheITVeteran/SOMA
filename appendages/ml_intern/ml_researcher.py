import sys
import json
import asyncio
import arxiv
import os
from playwright.async_api import async_playwright
try:
    from playwright_stealth import stealth_async
    _STEALTH = True
except:
    _STEALTH = False

class MlResearcher:
    def __init__(self):
        self.browser = None

    async def search_arxiv(self, query, max_results=5):
        limit = max(1, min(int(max_results or 5), 10))
        client = arxiv.Client(page_size=limit, delay_seconds=3.0, num_retries=2)
        search = arxiv.Search(
            query=query,
            max_results=limit,
            sort_by=arxiv.SortCriterion.Relevance
        )
        results = []
        for r in client.results(search):
            results.append({
                "title": r.title,
                "summary": r.summary,
                "pdf_url": r.pdf_url,
                "published": str(r.published),
                "authors": [a.name for a in r.authors]
            })
        return {"success": True, "source": "arxiv", "data": results}

    async def scrape_hf(self, url):
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context()
            page = await context.new_page()
            if _STEALTH:
                await stealth_async(page)
            
            await page.goto(url, wait_until="networkidle")
            # Extract basic model/dataset info
            title = await page.title()
            content = await page.content()
            
            # Look for GitHub links or README content
            readme = await page.inner_text("div.prose") if await page.query_selector("div.prose") else ""
            
            await browser.close()
            return {
                "success": True, 
                "source": "huggingface", 
                "title": title, 
                "readme_preview": readme[:2000],
                "url": url
            }

    async def execute(self, task, payload):
        if task == "search_papers":
            return await self.search_arxiv(payload.get("query", ""), payload.get("limit", 5))
        elif task == "inspect_hf":
            return await self.scrape_hf(payload.get("url", ""))
        else:
            return {"success": False, "error": f"Unknown task: {task}"}

async def main():
    researcher = MlResearcher()
    try:
        raw_input = sys.stdin.read().strip()
        if not raw_input:
            print(json.dumps({"success": False, "error": "No input"}))
            return

        cmd = json.loads(raw_input)
        result = await researcher.execute(cmd.get("task"), cmd.get("payload", {}))
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
