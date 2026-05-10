import sys
import json
import os
import re
import pdfplumber
from pathlib import Path

# ── Financial Regex Patterns ──────────────────────────────────────────────────
_DATE_RE = re.compile(r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b', re.IGNORECASE)
_CURRENCY_RE = re.compile(r'\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})\b')
_INVOICE_NUM_RE = re.compile(r'(?:invoice|inv|bill|statement|ref)(?:\s?(?:#|num|no))?[:\s]*([A-Z0-9\-\/#]+)', re.IGNORECASE)

class InvoiceProcessor:
    def __init__(self, poppler_path=None):
        self.poppler_path = poppler_path

    def process(self, file_path):
        if not os.path.exists(file_path):
            return {"success": False, "error": f"File not found: {file_path}"}

        try:
            data = {
                "success": True,
                "invoice_number": None,
                "date": None,
                "total_amount": None,
                "currency": "USD",
                "vendor": None,
                "line_items": [],
                "all_figures": [],
                "confidence": 0.0
            }

            with pdfplumber.open(file_path) as pdf:
                full_text = ""
                all_words = []
                
                # We prioritize the first page for header information
                first_page = pdf.pages[0]
                full_text = first_page.extract_text()
                all_words = first_page.extract_words()
                
                # 1. Extract Header Fields via Regex
                inv_match = _INVOICE_NUM_RE.search(full_text)
                if inv_match:
                    data["invoice_number"] = inv_match.group(1).strip()
                
                date_match = _DATE_RE.search(full_text)
                if date_match:
                    data["date"] = date_match.group(0).strip()

                # 2. Extract Figures & Totals
                figures = []
                for word in all_words:
                    if _CURRENCY_RE.match(word['text']):
                        val = word['text'].replace('$', '').replace(',', '').strip()
                        try:
                            figures.append({
                                "text": word['text'],
                                "value": float(val),
                                "top": float(word['top']),
                                "bottom": float(word['bottom']),
                                "left": float(word['x0'])
                            })
                        except: pass
                
                data["all_figures"] = [f["value"] for f in figures]
                
                # Heuristic for Total: The largest currency value near the bottom
                if figures:
                    # Sort by vertical position (descending)
                    sorted_figs = sorted(figures, key=lambda x: x['top'], reverse=True)
                    # Often the total is the last large number
                    # Filter for bottom 30% of the page
                    page_height = float(first_page.height)
                    bottom_figs = [f for f in sorted_figs if f['top'] > page_height * 0.7]
                    
                    if bottom_figs:
                        # Pick the largest one in the bottom section
                        total_fig = max(bottom_figs, key=lambda x: x['value'])
                        data["total_amount"] = total_fig["value"]
                    else:
                        # Fallback: largest figure on the page
                        data["total_amount"] = max(figures, key=lambda x: x['value'])["value"]

                # 3. Extract Tables (Line Items)
                tables = first_page.extract_tables()
                for table in tables:
                    # Look for headers like 'Description', 'Quantity', 'Price', 'Amount'
                    clean_table = []
                    for row in table:
                        clean_row = [cell.strip() if cell else "" for cell in row]
                        if any(clean_row):
                            clean_table.append(clean_row)
                    
                    if clean_table:
                        # Simple attempt to identify line item table
                        # Usually has 'description' and 'amount' columns
                        header = clean_table[0]
                        if any(h and ('desc' in h.lower() or 'item' in h.lower() or 'qty' in h.lower() or 'price' in h.lower() or 'amount' in h.lower()) for h in header):
                            for row in clean_table[1:]:
                                if len(row) >= 2:
                                    # Try to find a numeric amount in the row
                                    amount = None
                                    for cell in reversed(row):
                                        c_val = cell.replace('$', '').replace(',', '').strip()
                                        try:
                                            amount = float(c_val)
                                            break
                                        except: continue
                                    
                                    data["line_items"].append({
                                        "description": " ".join(row[:-1]) if amount else " ".join(row),
                                        "amount": amount
                                    })

                # 4. Confidence Calculation
                hits = 0
                if data["invoice_number"]: hits += 1
                if data["date"]: hits += 1
                if data["total_amount"]: hits += 1
                if data["line_items"]: hits += 1
                data["confidence"] = hits / 4.0

            return data

        except Exception as e:
            return {"success": False, "error": str(e)}

def main():
    try:
        raw_input = sys.stdin.read().strip()
        if not raw_input: return
        cmd = json.loads(raw_input)
        
        file_path = cmd.get("input")
        processor = InvoiceProcessor()
        result = processor.process(file_path)
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
