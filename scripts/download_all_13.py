import urllib.request
import os

doc_id = "1hZ0Ex_kpQMnurOdgBrHjWUs2gxp8R0JjeLxPDR44V_g"

tabs = [
    ("YEAR_1A", "0"),
    ("YEAR_1B", "209983724"),
    ("YEAR_2A", "1049229199"),
    ("YEAR_2B", "937895881"),
    ("YEAR_3A", "1450672077"),
    ("YEAR_3B", "306453095"),
    ("YEAR_4A", "219897678"),
    ("YEAR_4B", "951294066"),
    ("YEAR_5A", "1531044829"),
    ("YEAR_5B", "1505115062"),
    ("YEAR_6A", "2145881557"),
    ("YEAR_6B", "132035285"),
    ("YEAR_7",  "1170697813")
]

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

print(f"Downloading all {len(tabs)} registration CSVs...")

for name, gid in tabs:
    csv_url = f"https://docs.google.com/spreadsheets/d/{doc_id}/export?format=csv&gid={gid}"
    print(f"Fetching {name} (gid {gid})...")
    
    req = urllib.request.Request(csv_url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    })
    
    with urllib.request.urlopen(req) as resp:
        content = resp.read().decode('utf-8')
        
    filename = f"STUDENTS_REGISTRATION_DATABASE_{name}.csv"
    target_path = os.path.join(base_dir, filename)
    
    with open(target_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    lines = len([l for l in content.splitlines() if l.strip()])
    print(f"  Saved {filename}: {lines-1} students found.")

print("\nAll 13 registration CSV files downloaded successfully!")
