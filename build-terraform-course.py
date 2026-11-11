"""Rebuild the standalone course from terraform-tutorial.md using its existing shell."""
from pathlib import Path
import html
import json
import re

ROOT = Path(__file__).resolve().parent
source = (ROOT / 'terraform-tutorial.md').read_text(encoding='utf-8')
old = (ROOT / 'terraform.html').read_text(encoding='utf-8')
head = old.split('</style></head>')[0]
head = re.sub(r'/\* tutorial additions \*/.*', '', head, flags=re.S)
topics = [
    ('Architecture and workflow', '#7352a6', '#f2ecf9', 1, 6),
    ('Providers and operations', '#087fa3', '#e9f7fc', 7, 13),
    ('HCL and expressions', '#2563eb', '#eff6ff', 14, 16),
    ('Modules and reuse', '#c02675', '#fdf2f8', 17, 19),
    ('State and collaboration', '#197c75', '#e5f5f2', 20, 24),
    ('Platforms and security', '#4f46e5', '#eef2ff', 25, 30),
    ('Lifecycle and validation', '#b86a00', '#fff7ed', 31, 33),
    ('Practice and corrections', '#15803d', '#ecfdf5', 34, 35),
]
def esc(s): return html.escape(s, quote=True)
def inline(s):
    tokens = []
    def token(value):
        tokens.append(value)
        return f'\x00{len(tokens)-1}\x00'
    s = re.sub(r'`([^`]+)`', lambda m: token('<code>'+esc(m[1])+'</code>'), s)
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', lambda m: token('<a href="'+esc(m[2])+'"'+(' target="_blank" rel="noopener noreferrer"' if m[2].startswith('https://') else '')+'>'+esc(m[1])+'</a>'), s)
    s = esc(s)
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    return re.sub(r'\x00(\d+)\x00', lambda m: tokens[int(m[1])], s)

def render(md):
    lines = md.strip().splitlines()
    result = []; i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip(): i += 1; continue
        if line.startswith('```'):
            lang = line[3:]; block = []; i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                block.append(lines[i]); i += 1
            result.append('<div class="codebox"><div class="codebar"><span>'+esc(lang or 'Example')+'</span><button type="button" class="copy" aria-label="Copy code example">Copy</button></div><pre tabindex="0"><code>'+esc('\n'.join(block))+'</code></pre></div>')
            i += 1; continue
        if line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', c) for c in cells): rows.append(cells)
                i += 1
            result.append('<div class="table-wrap"><table><thead><tr>'+''.join('<th scope="col">'+inline(c)+'</th>' for c in rows[0])+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+inline(c)+'</td>' for c in row)+'</tr>' for row in rows[1:])+'</tbody></table></div>')
            continue
        m = re.match(r'^(#{2,4}) (.*)', line)
        if m:
            level = len(m[1]); result.append(f'<h{level}>'+inline(m[2])+f'</h{level}>'); i += 1; continue
        m = re.match(r'^(?:\d+\. |[-*] )(.*)', line)
        if m:
            tag = 'ol' if line[0].isdigit() else 'ul'; items = []
            while i < len(lines) and (m := re.match(r'^(?:\d+\. |[-*] )(.*)', lines[i])):
                items.append('<li>'+inline(m[1])+'</li>'); i += 1
            result.append(f'<{tag}>'+''.join(items)+f'</{tag}>'); continue
        para = [line]; i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r'^(?:#|```|\||\d+\. |[-*] )', lines[i]):
            para.append(lines[i]); i += 1
        result.append('<p>'+inline(' '.join(para))+'</p>')
    return '\n'.join(result)

chapters = re.split(r'^## (\d+ .+)$', source, flags=re.M)
assert len(chapters) == 71
intro = source.split('## Contents')[0].split('## Learn Terraform architecture and workflows with AWS')[1]
before = source.split('## Before you begin\n')[1].split('\n## 1 ')[0]
cards = ''.join(f'<button class="course-index-card" data-go="{a+1}" style="--topic:{color};--tint:{tint}"><span class="num">{n+1:02d} · LESSONS {a}–{b}</span><h2>{name}</h2><span class="course-index-arrow">Explore lessons →</span></button>' for n,(name,color,tint,a,b) in enumerate(topics))
intro_html = '<div class="eyebrow">35 LESSONS · AWS EXAMPLES · ENGLISH EDITION</div><h1 tabindex="-1">Learn Terraform,<br>step by step</h1>'+render(intro)+'<div class="actions"><a class="action" href="terraform-tutorial.md" download>Download Markdown tutorial</a><a class="action" href="environment-variables.html">Learn environment variables</a><button class="action" data-go="2">Start learning →</button></div><div class="grid two">'+cards+'</div><h2>Before you begin</h2>'+render(before)
slides = [f'<section class="slide active" id="slide-1" data-topic="0" aria-label="Course overview" aria-hidden="false">{intro_html}</section>']
for i in range(1,len(chapters),2):
    title, body = chapters[i:i+2]; num = int(title.split()[0]); topic = next(j for j,t in enumerate(topics) if t[3] <= num <= t[4]); t = topics[topic]
    anchor = re.sub('[^a-z0-9 _-]', '', title.lower()).replace(' ','-')
    slides.append(f'<section class="slide lesson" id="slide-{num+1}" data-anchor="{anchor}" data-topic="{topic}" aria-label="Lesson {num} of 35" aria-hidden="true" style="--topic:{t[1]};--tint:{t[2]}"><div class="eyebrow">{esc(t[0])} · LESSON {num:02d} / 35</div><h1 tabindex="-1">{esc(title.split(" ",1)[1])}</h1>{render(body)}</section>')
css = '''
/* tutorial additions */
.lesson{max-width:1120px}.lesson h1{font-size:clamp(30px,4vw,52px);margin-bottom:28px;max-width:900px;line-height:1.12}.lesson p,.lesson li{font-size:16px;line-height:1.8;max-width:900px}.lesson h2,.lesson h3{font-size:25px;line-height:1.3;letter-spacing:-.02em;margin:36px 0 14px}.lesson p code,.lesson li code,.lesson td code{font-size:.87em;overflow-wrap:anywhere;background:var(--tint);padding:2px 5px;border-radius:4px}.lesson li{margin:9px 0}.lesson .codebox,.lesson .table-wrap{margin:22px 0}.lesson a{text-underline-offset:3px}.lesson a:hover{color:#102033}.codebox pre{max-height:none;font-size:13px;line-height:1.7}.slide>.grid{margin-top:28px}.slide>h2{font-size:26px;margin-top:38px}.course-index-card h2{font-size:21px;letter-spacing:-.02em;line-height:1.25;margin:12px 0}.topmeta{display:flex;gap:12px}.quick-links{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;margin:0 8px 16px}.skip-link{position:absolute;top:-60px;left:12px;z-index:100;background:white;padding:10px}.skip-link:focus{top:8px}.codebar button:hover{background:var(--tint)}@media(max-width:800px){.topmeta{display:none}.quick-links{margin:3px 0 8px}.lesson h1{font-size:32px}.lesson p,.lesson li{font-size:15px}.sidebar nav{max-height:58px}.codebox pre{font-size:12px}.slide{padding-bottom:40px}}@media print{.quick-links,.skip-link{display:none}.lesson h1{font-size:30px}.lesson p,.lesson li{font-size:12px}.codebox pre{white-space:pre-wrap;overflow-wrap:anywhere}}
'''
shell = '''</style></head><body><a class="skip-link" href="#main">Skip to lesson</a><div class="app">
<header><div class="brand"><div class="brand-mark" aria-hidden="true">TF</div><div>TERRAFORM COURSE<small>Architecture to practical workflows</small></div></div><div class="topmeta"><a href="index.html">All courses</a><a href="aws.html">AWS course</a><a href="terraform-tutorial.md" download>Markdown ↓</a></div><span class="tag" id="counter" aria-live="polite"></span></header>
<div class="workspace"><aside class="sidebar" aria-label="Course navigation"><div class="sidebar-heading">YOUR LEARNING PATH</div><div class="quick-links"><a href="index.html">All courses</a><a href="aws.html">AWS</a><a href="environment-variables.html">Environment variables</a></div><label class="sr-only" for="navSearch">Search all lesson content</label><input class="nav-search" id="navSearch" type="search" placeholder="Search all lessons…"><nav id="slideNav" aria-label="Lessons"></nav><p class="empty" id="noResults" hidden>No matching lessons. Try another keyword.</p></aside><main class="stage" id="main" tabindex="-1">'''
footer = '''</main></div><footer class="footer"><span class="footer-title" id="slideTitle"></span><span class="footer-hint">← → Navigate · Home Overview</span><div class="controls"><button id="toIndex" type="button">Overview</button><button id="prev" type="button" aria-label="Previous lesson">← Prev</button><button id="next" type="button" aria-label="Next lesson">Next →</button></div></footer></div><div class="progress" id="progress"></div><noscript><style>body{overflow:auto}.app,.workspace{display:block;height:auto}.sidebar,.footer{display:none}.slide{display:block!important}</style><p>JavaScript is disabled. All lessons are shown for reading.</p></noscript>'''
runtime_end = old.find('document.querySelectorAll(\'[data-file]\')')
if runtime_end < 0:
    runtime_end = old.rindex('\nfromHash();')
runtime = old[old.index('const slides='):runtime_end]
runtime = runtime.replace("'Slide '", "'Lesson '")
runtime = runtime.replace("button.setAttribute('aria-label','Lesson '+(i+1)+': '+titles[i])", "button.setAttribute('aria-label',i?'Lesson '+i+': '+titles[i]:'Course overview')")
runtime = runtime.replace("number.textContent=String(i+1).padStart(2,'0')", "number.textContent=i?String(i).padStart(2,'0'):'⌂'")
runtime = runtime.replace("counter.textContent=String(index+1).padStart(2,'0')+' / '+slides.length", "counter.textContent=index?'Lesson '+index+' / 35':'35 lessons'")
runtime = runtime.replace("const m=location.hash.match(/^#slide-(\\d+)$/);show(m?Number(m[1])-1:0,false,false)", "const m=location.hash.match(/^#slide-(\\d+)$/);const a=slides.findIndex(s=>'#'+s.dataset.anchor===location.hash);show(m?Number(m[1])-1:a>=0?a:0,false,false)")
runtime = runtime.replace("ev.target.closest('input,textarea,select,pre,[contenteditable=\"true\"]')", "ev.target.closest('input,textarea,select,pre,button,a,[contenteditable=\"true\"]')")
output = head+css+shell+'\n'.join(slides)+footer+'<script>const topics='+json.dumps([t[:3] for t in topics])+';\n'+runtime+'\nfromHash();\n</script></body></html>'
(ROOT/'terraform.html').write_text(output, encoding='utf-8')
print(f'Built {len(slides)} pages from 35 Markdown lessons; {len(output):,} characters.')
