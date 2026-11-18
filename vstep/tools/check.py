"""Kiểm tra dữ liệu bài VSTEP: python3 vstep/tools/check.py vstep/data"""
import json, sys, os, re
d = sys.argv[1] if len(sys.argv) > 1 else 'vstep/data'
idx = json.load(open(os.path.join(d, 'index.json'))); plan = json.load(open(os.path.join(d, 'plan.json')))
err = []
for it in idx['lessons']:
    L = json.load(open(os.path.join(d, it['id'] + '.json')))
    tag = it['id']
    for k in ('id', 'lesson', 'title', 'enTitle', 'date', 'words', 'patterns', 'exercises', 'writing', 'speaking', 'corner'):
        if k not in L: err.append(f'{tag}: thiếu "{k}"')
    for w in L['words']:
        if len(w) != 5 or not all(isinstance(x, str) and x.strip() for x in w): err.append(f'{tag}: từ sai cấu trúc {w}')
    if len(set(w[0].lower() for w in L['words'])) != len(L['words']): err.append(f'{tag}: trùng từ')
    for e in L['exercises']:
        t = e.get('type')
        if t in ('choice', 'read'):
            if e['answer'] not in e['options']: err.append(f'{tag}: answer không nằm trong options: {e["q"]}')
            if len(set(e['options'])) != len(e['options']): err.append(f'{tag}: options trùng: {e["q"]}')
        elif t == 'order':
            if ' '.join(e['tokens']) != e['answer']: err.append(f'{tag}: tokens không khớp answer: {e["answer"]}')
        elif t in ('fill', 'translate'):
            if not isinstance(e['answer'], list) or not e['answer']: err.append(f'{tag}: answer phải là mảng: {e["q"]}')
        elif t == 'vi':
            if not e.get('en'): err.append(f'{tag}: thiếu câu en: {e["q"]}')
        else: err.append(f'{tag}: type lạ {t}')
        if t in ('choice', 'fill') and e.get('en') and '___' not in e['en']: err.append(f'{tag}: thiếu ___ trong câu: {e["en"]}')
    p = next((x for x in plan['days'] if x.get('id') == tag), None)
    if p and (p['date'] != L['date'] or it['date'] != L['date']): err.append(f'{tag}: ngày không khớp plan/index')
    if it['words'] != len(L['words']) or it['exercises'] != len(L['exercises']): err.append(f'{tag}: số đếm trong index sai')
    W = L.get('writing', {}); S = L.get('speaking', {})
    if W and (W.get('task') not in (1, 2) or not W.get('prompt')): err.append(f'{tag}: writing sai')
    if S and (S.get('part') not in (1, 2, 3) or not S.get('prompt')): err.append(f'{tag}: speaking sai')
    print(f'{tag}: {len(L["words"])} từ, {len(L["patterns"])} mẫu, {len(L["exercises"])} bài tập')
print('\n'.join(err) if err else 'OK — không có lỗi')
sys.exit(1 if err else 0)
