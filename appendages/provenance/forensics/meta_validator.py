import sys
import json
import os
import re
import socket
import datetime
from email import message_from_file

def verify_domain(domain):
    """
    Simulates or performs a WHOIS/DNS check.
    For local safety, we'll try a DNS lookup to see if the domain exists.
    """
    try:
        ip = socket.gethostbyname(domain)
        return {
            "resolved": True,
            "ip": ip,
            "status": "Verified"
        }
    except Exception as e:
        return {
            "resolved": False,
            "status": "Unresolved/Suspicious",
            "error": str(e)
        }

def analyze_email_headers(eml_path):
    """
    Extracts security metadata from an email file.
    """
    try:
        with open(eml_path, 'r') as f:
            msg = message_from_file(f)
        
        headers = {}
        # Look for SPF, DKIM, DMARC
        headers['authentication_results'] = msg.get('Authentication-Results', 'None')
        headers['dkim_signature'] = 'Present' if msg.get('DKIM-Signature') else 'Missing'
        headers['from'] = msg.get('From', '')
        headers['date'] = msg.get('Date', '')
        headers['subject'] = msg.get('Subject', '')

        # Heuristic for fraud
        is_suspicious = False
        reasons = []
        
        if headers['dkim_signature'] == 'Missing':
            is_suspicious = True
            reasons.append("Missing DKIM Signature")
        
        if "fail" in headers['authentication_results'].lower():
            is_suspicious = True
            reasons.append("Authentication Failure detected in headers")

        return {
            "success": True,
            "is_suspicious": is_suspicious,
            "reasons": reasons,
            "metadata": headers
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def main():
    try:
        raw_input = sys.stdin.read().strip()
        if not raw_input: return
        cmd = json.loads(raw_input)
        
        task = cmd.get("task")
        
        if task == "verify_domain":
            domain = cmd.get("domain")
            print(json.dumps(verify_domain(domain)))
        elif task == "analyze_email":
            path = cmd.get("input")
            print(json.dumps(analyze_email_headers(path)))
        else:
            print(json.dumps({"success": False, "error": f"Unknown task: {task}"}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
