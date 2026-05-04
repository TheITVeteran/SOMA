import sys
import json
import pandas as pd
import numpy as np
from scipy.stats import chisquare
import math
import os
import re

class BenfordInvestigator:
    def __init__(self):
        self.currency_regex = re.compile(r'[^\d.-]')

    def clean_currency(self, value):
        if pd.isna(value) or value == '': return 0.0
        s = str(value).strip()
        if s.startswith('(') and s.endswith(')'): s = '-' + s[1:-1]
        s = self.currency_regex.sub('', s)
        try: return float(s)
        except: return 0.0

    def analyze(self, numbers):
        """Performs Benford's Law analysis with production-grade statistical depth."""
        digits = []
        for n in numbers:
            val = abs(self.clean_currency(n))
            if val > 0:
                first_digit = int(str(val).replace('.', '').lstrip('0')[0])
                digits.append(first_digit)

        if len(digits) < 50:
            return {"success": false, "error": "Insufficient data (min 50 samples)"}

        observed_counts = pd.Series(digits).value_counts().sort_index()
        for i in range(1, 10):
            if i not in observed_counts: observed_counts[i] = 0

        total = len(digits)
        observed_freq = (observed_counts / total).values
        expected_freq = np.array([math.log10(1 + 1/i) for i in range(1, 10)])

        # Chi-Squared Test
        chi_stat, p_value = chisquare(observed_counts.values, f_exp=expected_freq * total)

        # MAD (Mean Absolute Deviation) - Industrial Standard for Benford
        mad = np.mean(np.abs(observed_freq - expected_freq))
        
        # MAD Thresholds: < 0.006 (Close), < 0.012 (Acceptable), < 0.015 (Marginal), > 0.015 (Non-conform)
        if mad < 0.006: conformity = "Close Conformity"
        elif mad < 0.012: conformity = "Acceptable Conformity"
        elif mad < 0.015: conformity = "Marginal Conformity"
        else: conformity = "Non-Conformity"

        return {
            "success": True,
            "sample_size": total,
            "fidelity_score": float(max(0, 1 - (mad / 0.025))), # Scaled for UI
            "p_value": float(p_value),
            "mad": float(mad),
            "conformity": conformity,
            "verdict": "NATURAL" if mad < 0.012 else "ANOMALOUS",
            "distribution": {str(i): float(observed_freq[i-1]) for i in range(1, 10)},
            "expected": {str(i): float(expected_freq[i-1]) for i in range(1, 10)}
        }

def main():
    try:
        raw_input = sys.stdin.read().strip()
        if not raw_input: return
        cmd = json.loads(raw_input)
        file_path = cmd.get("input")

        if not os.path.exists(file_path):
            print(json.dumps({"success": False, "error": "File not found"}))
            return

        df = pd.read_csv(file_path) if file_path.endswith('.csv') else pd.read_excel(file_path)
        
        investigator = BenfordInvestigator()
        results = {}
        
        # Auto-detect numeric columns
        for col in df.columns:
            sample = df[col].dropna().tolist()
            if not sample: continue
            
            analysis = investigator.analyze(sample)
            if analysis["success"]:
                results[col] = analysis

        print(json.dumps({"success": True, "analyses": results}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
