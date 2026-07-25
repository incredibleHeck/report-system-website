import urllib.request
import re
import os

doc_id = "1hZ0Ex_kpQMnurOdgBrHjWUs2gxp8R0JjeLxPDR44V_g"
url = f"https://docs.google.com/spreadsheets/d/{doc_id}/edit?usp=sharing"

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
with urllib.request.urlopen(req) as response:
    html = response.read().decode('utf-8')

# Extract gids
matches = [("0", "YEAR 1A")] + re.findall(r'\\"(\d+)\\",\[\{\\"1\\":\[\[0,0,\\"(YEAR[^"]+)\\"', html, re.IGNORECASE)

# Deduplicate by GID
unique_tabs = {}
for gid, name in matches:
    if gid not in unique_tabs:
        unique_tabs[gid] = name.strip()

print(f"Discovered {len(unique_tabs)} unique sheet tabs:")
for gid, name in unique_tabs.items():
    print(f"  - {name} (gid: {gid})")

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

for gid, name in unique_tabs.items():
    clean_name = name.strip().replace(' ', '_').upper()
    csv_url = f"https://docs.google.com/spreadsheets/d/{doc_id}/export?format=csv&id={doc_id}&gid={gid}"
    print(f"Downloading {name} from {csv_url}...")
    
    try:
        csv_req = urllib.request.Request(csv_url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept': 'text/csv,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        })
        with urllib.request.urlopen(csv_req) as resp:
            csv_data = resp.read().decode('utf-8')
            
        filename = f"STUDENTS_REGISTRATION_DATABASE_{clean_name}.csv"
        target_path = os.path.join(base_dir, filename)
        with open(target_path, 'w', encoding='utf-8') as f:
            f.write(csv_data)
        print(f"  Saved {filename} ({len(csv_data)} bytes, {len(csv_data.splitlines())} lines)")
    except Exception as e:
        print(f"  Error downloading {name}: {e}")

print("\nDone downloading all sheets!")
