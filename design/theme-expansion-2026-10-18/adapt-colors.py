from pathlib import Path
import json

def rgb(c):return [int(c[i:i+2],16) for i in (1,3,5)]
def hx(c):return '#'+''.join(f'{round(v):02x}' for v in c)
def mix(a,b,w):return [round(x*w+y*(1-w)) for x,y in zip(a,b)]
def lum(c):return sum((v/255/12.92 if v/255<=.04045 else ((v/255+.055)/1.055)**2.4)*w for v,w in zip(c,[.2126,.7152,.0722]))
def ratio(a,b):return (max(lum(a),lum(b))+.05)/(min(lum(a),lum(b))+.05)

def tokens(paper,sidebar,ink,muted,line,frame,hover,user,code,selection,accent,link,amber,mint,danger,added,removed,status,keyword,string,function,foreground=None):
 return dict(paper=paper,sidebar=sidebar,ink=ink,muted=muted,line=line,frame=frame,hover=hover,user=user,**{'code-head':code,'selection':selection,'accent':accent,'accent-foreground':foreground or paper,'focus':accent,'link':link,'amber':amber,'mint':mint,'danger':danger,'added':added,'removed':removed,'status':status,'syntax-keyword':keyword,'syntax-string':string,'syntax-function':function})

entries=[
 ('rose-pine','moon','dark',tokens('#232136','#1f1d30','#e0def4','#a6a0bd','#393552','#56526e','#393552','#3a3651','#35314b','#44415a','#c4a7e7','#9ccfd8','#f6c177','#9ccfd8','#eb6f92','#2d3e42','#49313f','#f6c177','#c4a7e7','#f6c177','#ea9a97')),
 ('tokyo-night','storm','dark',tokens('#24283b','#1f2335','#c0caf5','#9aa5ce','#343950','#565f89','#343950','#383c51','#303449','#394b70','#7aa2f7','#7aa2f7','#e0af68','#9ece6a','#f7768e','#2d403e','#493343','#e0af68','#bb9af7','#9ece6a','#7aa2f7')),
 ('tokyo-night','moon','dark',tokens('#222436','#1e2030','#c8d3f5','#a5afd2','#2f334d','#444a73','#2f334d','#35394e','#2f3349','#3e4b73','#82aaff','#82aaff','#ffc777','#c3e88d','#ff757f','#2b4036','#49313f','#ffc777','#c099ff','#c3e88d','#82aaff')),
 ('everforest','dark','dark',tokens('#2d353b','#232a2e','#d3c6aa','#b1b9ad','#3d484d','#56635f','#3d484d','#444d4f','#343f44','#425047','#a7c080','#7fbbb3','#dbbc7f','#a7c080','#e67e80','#425047','#514045','#dbbc7f','#e67e80','#a7c080','#dbbc7f')),
 ('everforest','light','light',tokens('#fdf6e3','#f4f0d9','#5c6a72','#657369','#e6e2cc','#bdc3af','#efebd4','#f0edd8','#f4f0d9','#e6e2cc','#5f7626','#3a94c5','#dfa000','#8da101','#f85552','#f0f1d2','#fde3da','#a87a00','#f85552','#8da101','#3a94c5',foreground='#ffffff')),
]
roles=['ink','muted','link','danger','status','syntax-keyword','syntax-string','syntax-function']
log=[]
for family,version,mode,c in entries:
 original=c.copy()
 surfaces=[rgb(c[k]) for k in ['paper','sidebar','hover','user','code-head','added','removed']]
 if mode=='dark':surfaces.append(mix(rgb(c['ink']),rgb(c['paper']),.20))
 for role in roles:
  base=rgb(c[role]);new=base
  for step in range(256):
   new=mix([255,255,255] if mode=='dark' else [0,0,0],base,step/255)
   if min(ratio(new,bg) for bg in surfaces)>=4.72:break
  c[role]=hx(new)
 # Success icons use the icon contrast threshold rather than reading text.
 base=rgb(c['mint'])
 for step in range(256):
  new=mix([255,255,255] if mode=='dark' else [0,0,0],base,step/255)
  if min(ratio(new,bg) for bg in surfaces)>=3.2:break
 c['mint']=hx(new)
 ink=rgb(c['ink']);raw=mix(rgb(c['accent']),rgb(c['paper']),.20 if mode=='dark' else .16)
 for step in range(256):
  selected=mix([0,0,0] if mode=='dark' else [255,255,255],raw,step/255)
  fg=[ink]+[mix(rgb(c[k]),ink,.55) for k in ['syntax-keyword','syntax-string','syntax-function','muted']]
  if min(ratio(color,selected) for color in fg)>=4.72:break
 c['text-selection-bg']=hx(selected)
 path=Path('src/styles/themes')/family/f'_{version}.scss'
 path.write_text(f'// {family} / {version}: upstream colors adapted to Pi reading surfaces.\n// Sources: design/theme-expansion-2026-10-18/notes.md.\n$tokens: (\n'+''.join(f'  {k}: {v},\n' for k,v in c.items())+');\n')
 log.append({'family':family,'version':version,'mode':mode,'adaptations':{k:{'from':original[k],'to':v} for k,v in c.items() if k in original and original[k]!=v},'textSelection':c['text-selection-bg'],'minimum':min(ratio(rgb(c[k]),bg) for k in roles for bg in surfaces)})
Path('design/theme-expansion-2026-10-18/color-adaptations.json').write_text(json.dumps(log,indent=2)+'\n')
print(json.dumps(log,indent=2))
