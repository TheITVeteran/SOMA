"""
limb_bridge.py — Provenance Physical IPC Bridge (V4.0)
The Unified "Ocular OCR" + "Cartographer" Engine

Provides:
1. Structural Extraction (JSON tables with bounding boxes)
2. Visual Evidence (Images with colorful detection overlays)
3. Cartography (Financial patterns, sections, and cross-references)

SOMA NODE-01 INDUSTRIAL GRADE.
"""

import sys
import json
import os
import re
import hashlib
import traceback
import time
from pathlib import Path

# ── Dependency Guards ────────────────────────────────────────────────────────
try:
    import pdfplumber
    import cv2
    import numpy as np
    from pdf2image import convert_from_path
    from PIL import Image, ImageDraw
    HAS_VISION = True
except ImportError as e:
    HAS_VISION = False
    MISSING_DEP = str(e)

# ── Configuration ────────────────────────────────────────────────────────────
CWD = Path(os.getcwd())
CACHE_DIR = CWD / ".soma" / "ocular_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# 🔱 SOMA PROVISIONED VISION PATH
POPPLER_BIN = CWD / "appendages" / "provenance" / "ocular" / "bin" / "poppler-24.08.0" / "Library" / "bin"

# ── Financial Pattern Detectors ──────────────────────────────────────────────
_CURRENCY_RE   = re.compile(r'\$\s?[\d,]+(?:\.\d{2})?')
_SECTION_RE    = re.compile(r'^[A-Z\s\-&,]{4,80}$')
_TOTAL_RE      = re.compile(r'(?:total|subtotal|net|gross|balance|sum)[^\n]*\$?\s?[\d,]+', re.IGNORECASE)

# ── Helpers ──────────────────────────────────────────────────────────────────
def file_hash(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()

def _extract_financial_figures(text):
    figures = {}
    for m in _TOTAL_RE.finditer(text):
        line = m.group(0).strip()
        amounts = _CURRENCY_RE.findall(line)
        label = re.sub(r'\$?[\d,\.]+', '', line).strip().rstrip(':').strip()
        if label and amounts:
            figures[label[:80]] = amounts[-1]
    return figures

# ── The Ocular Engine ────────────────────────────────────────────────────────
def run_ocular(input_path):
    if not HAS_VISION:
        return {"success": False, "error": f"Vision stack not ready: {MISSING_DEP}"}

    input_path = Path(input_path)
    h = file_hash(str(input_path))[:12]
    
    analysis = {
        "success": True,
        "hash": h,
        "pages": [],
        "total_tables": 0,
        "engine": "Ocular-V4-Unified"
    }

    try:
        # Rasterize for Visual Evidence (Cap at 10 pages for Enterprise usage)
        # 🔱 Using provisioned poppler_path
        images = convert_from_path(str(input_path), dpi=150, last_page=10, poppler_path=str(POPPLER_BIN))
        
        with pdfplumber.open(input_path) as pdf:
            for i, page in enumerate(pdf.pages):
                if i >= 10: break
                
                page_data = {
                    "number": i + 1,
                    "width": float(page.width),
                    "height": float(page.height),
                    "text": page.extract_text() or "",
                    "tables": [],
                    "figures": {},
                    "visual_evidence": ""
                }
                
                # Structural Table Extraction
                tables = page.find_tables()
                for t in tables:
                    bbox = t.bbox
                    rows = t.extract()
                    clean_rows = [[cell or "" for cell in row] for row in rows if any(cell for cell in row)]
                    
                    if clean_rows:
                        page_data["tables"].append({
                            "bbox": [float(v) for v in bbox],
                            "rows": len(clean_rows),
                            "data": clean_rows
                        })
                        analysis["total_tables"] += 1

                page_data["figures"] = _extract_financial_figures(page_data["text"])

                # Detection Overlay
                img_name = f"ocular_{h}_p{i+1}.jpg"
                img_path = CACHE_DIR / img_name
                
                pil_img = images[i]
                img_w, img_h = pil_img.size
                scale_x = img_w / float(page.width)
                scale_y = img_h / float(page.height)
                
                draw = ImageDraw.Draw(pil_img, 'RGBA')
                # Draw tables in Emerald
                for table in page_data["tables"]:
                    b = table["bbox"]
                    scaled_b = [b[0]*scale_x, b[1]*scale_y, b[2]*scale_x, b[3]*scale_y]
                    draw.rectangle(scaled_b, outline=(16, 185, 129, 255), width=4, fill=(16, 185, 129, 40))
                
                pil_img.save(img_path, "JPEG", quality=85)
                # Save relative path for UI
                page_data["visual_evidence"] = f".soma/ocular_cache/{img_name}"
                
                analysis["pages"].append(page_data)

        return analysis

    except Exception as e:
        return {"success": False, "error": str(e), "trace": traceback.format_exc()}

def run_cartographer(input_path):
    # For now, cartographer uses the ocular output to build the index
    ocular_data = run_ocular(input_path)
    if not ocular_data["success"]: return ocular_data

    # Build the Reasoning Tree
    tree = {
        "root": f"DOC_{ocular_data['hash']}",
        "sections": [],
        "all_figures": {},
        "metadata": {
            "tables": ocular_data["total_tables"],
            "pages": len(ocular_data["pages"])
        }
    }

    for page in ocular_data["pages"]:
        tree["all_figures"].update(page["figures"])
        # Simple heuristic for sections
        lines = page["text"].split('\n')
        for line in lines:
            if _SECTION_RE.match(line.strip()):
                tree["sections"].append({"title": line.strip(), "page": page["number"]})

    return {"success": True, "tree": tree, "ocular": ocular_data}

# ── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    try:
        raw_input = sys.stdin.read()
        if not raw_input: sys.exit(0)
        
        cmd = json.loads(raw_input)
        task = cmd.get('task')
        input_path = cmd.get('input')

        if not input_path or not os.path.exists(input_path):
            print(json.dumps({"success": False, "error": f"File not found: {input_path}"}))
        elif task == 'ocular':
            print(json.dumps(run_ocular(input_path)))
        elif task == 'cartographer':
            print(json.dumps(run_cartographer(input_path)))
        else:
            print(json.dumps({"success": False, "error": f"Unknown task: {task}"}))
            
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e), "trace": traceback.format_exc()}))
