import urllib.request
import re

url = "https://docs.google.com/spreadsheets/d/1hZ0Ex_kpQMnurOdgBrHjWUs2gxp8R0JjeLxPDR44V_g/edit?usp=sharing"

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
with urllib.request.urlopen(req) as response:
    html = response.read().decode('utf-8')

# Search for matches containing year names
for class_label in ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B', '7']:
    pattern = rf'([^"\\]*?{class_label}[^"\\]*)'
    matches = re.findall(rf'.{{0,50}}{class_label}.{{0,50}}', html)
    print(f"--- Matches for {class_label} ({len(matches)}) ---")
    for m in matches[:3]:
        print("  ", repr(m))
