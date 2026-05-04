import pandas as pd
import numpy as np
import re
import json
import sys
import os

class ForensicCleanser:
    """
    Production-grade data normalization for financial auditing.
    Handles 'dirty' accounting formats: (100.00), $1,200.50, 'N/A', etc.
    """
    def __init__(self):
        self.currency_regex = re.compile(r'[^\d.-]')

    def clean_currency(self, value):
        if pd.isna(value) or value == '':
            return 0.0
        
        s = str(value).strip()
        
        # Handle accounting negative format: (100.00) -> -100.00
        if s.startswith('(') and s.endsWith(')'):
            s = '-' + s[1:-1]
        
        # Remove currency symbols and commas
        s = self.currency_regex.sub('', s)
        
        try:
            return float(s)
        except ValueError:
            return 0.0

    def detect_financial_columns(self, df):
        """
        Fuzzy detection of columns that likely contain financial figures.
        """
        potential_cols = []
        keywords = ['amount', 'balance', 'total', 'debit', 'credit', 'value', 'sum', 'price', 'cost']
        
        for col in df.columns:
            col_lower = str(col).lower()
            # Direct keyword match
            if any(k in col_lower for k in keywords):
                potential_cols.append(col)
                continue
            
            # Sample data check: Is it mostly numeric-like?
            sample = df[col].dropna().head(20)
            if len(sample) > 0:
                numeric_count = 0
                for val in sample:
                    clean_val = str(val).replace('$', '').replace(',', '').replace('(', '').replace(')', '').strip()
                    if re.match(r'^-?\d*\.?\d+$', clean_val):
                        numeric_count += 1
                if numeric_count / len(sample) > 0.7:
                    potential_cols.append(col)
                    
        return list(set(potential_cols))

    def process_file(self, input_path):
        if not os.path.exists(input_path):
            return {"success": False, "error": "File not found"}

        try:
            if input_path.endswith('.csv'):
                df = pd.read_csv(input_path)
            else:
                df = pd.read_excel(input_path)

            financial_cols = self.detect_financial_columns(df)
            
            cleaned_data = {}
            for col in financial_cols:
                df[f'CLEANED_{col}'] = df[col].apply(self.clean_currency)
                cleaned_data[col] = df[f'CLEANED_{col}'].tolist()

            return {
                "success": True,
                "columns_detected": financial_cols,
                "row_count": len(df),
                "cleaned_samples": {col: cleaned_data[col][:5] for col in financial_cols}
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

if __name__ == "__main__":
    cleanser = ForensicCleanser()
    # For CLI usage
    if len(sys.argv) > 1:
        print(json.dumps(cleanser.process_file(sys.argv[1])))
    else:
        # For pipe usage
        try:
            raw_input = sys.stdin.read().strip()
            if raw_input:
                cmd = json.loads(raw_input)
                print(json.dumps(cleanser.process_file(cmd.get("input"))))
        except:
            pass
