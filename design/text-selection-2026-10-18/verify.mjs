export const themes=[...['ink','gruvbox','catppuccin','linear','nord','ayu','one-dark','min-dark','solarized','rose-pine','tokyo-night'].flatMap(palette=>['light','dark'].map(theme=>({palette,theme}))),{palette:'catppuccin-frappe',theme:'dark'},{palette:'catppuccin-macchiato',theme:'dark'}]
export function measure(){
 const parse=s=>s.startsWith('color(srgb')?s.slice(11,-1).split('/')[0].trim().split(/\s+/).map(Number):s.match(/[\d.]+/g).slice(0,3).map(v=>Number(v)/255)
 const lum=c=>c.map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0)
 const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05)
 if(!document.querySelector('.reply-text p')||!document.querySelector('textarea'))return null
 const root=document.documentElement,ink=parse(getComputedStyle(document.querySelector('.reply-text p')).color)
 const samples=Array.from(document.querySelectorAll('.reply-text p,.reply-text code,.syntax-token,textarea')).map(e=>{const selected=getComputedStyle(e,'::selection');return {text:e.textContent?.slice(0,30),class:e.className,foreground:selected.color,background:selected.backgroundColor,ratio:ratio(parse(selected.color),parse(selected.backgroundColor))}})
 const selection=window.getSelection()
 return {theme:root.dataset.theme,palette:root.dataset.palette,accent:root.dataset.accent,samples,selected:selection.toString(),inputSelected:document.querySelector('textarea').selectionEnd-document.querySelector('textarea').selectionStart,syntaxHuesRetained:samples.filter(s=>/syntax-(keyword|string|function|class-name|comment)(?:\s|$)/.test(s.class)).every(s=>parse(s.foreground).some((v,i)=>Math.abs(v-ink[i])>.002)),overflow:root.scrollWidth-root.clientWidth}
}
const base='http://127.0.0.1:1420/design/text-selection-2026-10-18/preview.html'
const assert=(ok,message)=>{if(!ok)throw new Error(message)}
export async function verify(tab){
 const results=[]
 const read=async()=>{for(let attempt=0;attempt<5;attempt++){await tab.playwright.locator('.reply-text p').first().waitFor({state:'visible'});const value=await tab.playwright.evaluate(measure);if(value)return value;}throw new Error('Preview did not finish loading')}
 for(const {palette,theme} of themes){
  await tab.goto(`${base}?palette=${palette}&theme=${theme}`)
  await tab.getAXState({emit:false})
  await tab.playwright.locator(`html[data-theme="${theme}"][data-palette="${palette}"] .syntax-comment`).waitFor({state:'visible'})
  await tab.pressKey(null,'F10');await tab.getAXState({emit:false})
  const state=await read()
  assert(state.selected.includes('class Intro:')&&state.selected.includes('print(Intro().describe())'),`${theme}/${palette}: actual code selection`)
  assert(state.samples.length>30,`${theme}/${palette}: enough syntax samples`)
  const low=state.samples.filter(s=>s.ratio<4.5)
  assert(!low.length,`${theme}/${palette}: low selected contrast ${JSON.stringify(low)}`)
  assert(state.syntaxHuesRetained,`${theme}/${palette}: syntax hues lost`)
  assert(state.overflow<=1,`${theme}/${palette}: page overflow`)
  await tab.pressKey(null,'F9');await tab.getAXState({emit:false})
  assert((await read()).selected.includes('先读学习进度'),`${theme}/${palette}: prose selection`)
  await tab.pressKey(null,'F11');await tab.getAXState({emit:false})
  assert((await read()).inputSelected>10,`${theme}/${palette}: input selection`)
  results.push({theme,palette,samples:state.samples.length,minimum:Math.min(...state.samples.map(s=>s.ratio)),background:state.samples[0].background,codeSelection:true,proseSelection:true,inputSelection:true,syntaxHuesRetained:true})
 }
 for(const palette of ['catppuccin-frappe','tokyo-night']){
  await tab.goto(`${base}?palette=${palette}&theme=dark&accent=orange`)
  await tab.getAXState({emit:false})
  await tab.playwright.locator('html[data-accent="orange"] .syntax-comment').waitFor({state:'visible'})
  const state=await read(),normal=results.find(r=>r.palette===palette&&r.theme==='dark')
  assert(state.samples[0].background===normal.background,`${palette}: text selection must remain independent from custom action accent`)
 }
 return {combinations:results.length,minimum:Math.min(...results.map(r=>r.minimum)),customAccentIsolation:true,results}
}
