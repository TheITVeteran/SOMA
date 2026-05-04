import sys
import json
import pandas as pd
import numpy as np
import os
import re

def perform_numerical_tie(excel_path, pdf_values):
    """
    Physically cross-references PDF extracted values against Excel data.
    """
    try:
        if excel_path.endswith('.csv'):
            df = pd.read_csv(excel_path)
        else:
            df = pd.read_excel(excel_path)

        # Flatten all numeric values in Excel for search
        excel_values = []
        for col in df.select_dtypes(include=[np.number]).columns:
            excel_values.extend(df[col].dropna().tolist())
        
        # Also try to parse string columns that look like money
        for col in df.select_dtypes(include=['object']).columns:
            sample = df[col].dropna().head(100)
            for val in sample:
                s = str(val).replace('$', '').replace(',', '').replace('(', '').replace(')', '').strip()
                try:
                    excel_values.append(float(s))
                except:
                    continue

        excel_values = [round(float(v), 2) for v in excel_values]
        
        matches = []
        discrepancies = []
        
        for p_val in pdf_values:
            target = round(float(p_val), 2)
            if target in excel_values:
                matches.append(target)
            else:
                discrepancies.append(target)

        return {
            "success": True,
            "total_pdf_values": len(pdf_values),
            "matched_count": len(matches),
            "discrepancy_count": len(discrepancies),
            "matches": matches[:50], # Sample
            "discrepancies": discrepancies[:50],
            "tie_fidelity": len(matches) / max(1, len(pdf_values))
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def main():
    try:
        raw_input = sys.stdin.read().strip()
        if not raw_input: return
        cmd = json.loads(raw_input)
        
        excel_path = cmd.get("excel_path")
        pdf_values = cmd.get("pdf_values", [])
        
        result = perform_numerical_tie(excel_path, pdf_values)
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
