"""Tạo lại vstep/data/index.json từ mọi file bài trong vstep/data (sắp theo ngày): python3 vstep/tools/build_index.py vstep/data"""
import json, sys, os, glob, datetime
d = sys.argv[1] if len(sys.argv) > 1 else 'vstep/data'
items = []
for f in glob.glob(os.path.join(d, '*.json')):
    if os.path.basename(f) in ('index.json', 'plan.json'): continue
    L = json.load(open(f))
    items.append({"id": L["id"], "lesson": L["lesson"], "title": L["title"], "enTitle": L.get("enTitle", ""), "date": L.get("date", ""),
                  "words": len(L["words"]), "exercises": len(L["exercises"])})
items.sort(key=lambda x: (x["date"], x["id"]))
json.dump({"updated": datetime.date.today().isoformat(), "lessons": items}, open(os.path.join(d, 'index.json'), 'w'), ensure_ascii=False, indent=1)
print(len(items), 'bài')
