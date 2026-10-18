import {measureContrast,palettes} from '../dark-chat-contrast-2026-10-18/verify.mjs'
const base='http://127.0.0.1:1420/design/shell-surfaces-2026-10-18/preview.html'
const assert=(condition,message)=>{if(!condition)throw new Error(message)}
export function measureShell(){
 const css=e=>getComputedStyle(e)
 const parse=s=>s.startsWith('color(srgb')?s.slice(11,-1).split('/')[0].trim().split(/\s+/).map(n=>Number(n)*255):s.match(/[\d.]+/g).slice(0,3).map(Number)
 const lum=c=>c.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0)
 const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05)
 const shell=document.querySelector('.app-shell'),workspace=document.querySelector('.workspace-surface'),side=document.querySelector('.split-pane-side'),chat=document.querySelector('.chat-page')
 const background=e=>{for(let n=e;n;n=n.parentElement){const value=css(n).backgroundColor;if(value!=='rgba(0, 0, 0, 0)'&&value!=='transparent')return parse(value)}return [255,255,255]}
 const ground=background(shell),sidebar=background(side),paper=background(chat),border=parse(css(workspace).borderTopColor)
 return {theme:document.documentElement.dataset.theme,palette:document.documentElement.dataset.palette,ground,sidebar,paper,groundMatchesSidebar:ground.every((n,i)=>Math.abs(n-sidebar[i])<.1),readingStep:contrast(sidebar,paper),readingLighter:lum(paper)>lum(sidebar),boundary:contrast(border,sidebar),boundaryMatches:css(side).borderRightColor===css(workspace).borderTopColor,navigation:Array.from(document.querySelectorAll('.sidebar-title,.session-list-empty,.window-chrome h1')).map(e=>({text:e.textContent,ratio:contrast(parse(css(e).color),sidebar)})),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}
}
export async function verify(tab){
 const results=[]
 for(const theme of ['dark','light'])for(const palette of palettes){
  await tab.goto(`${base}?state=audit&theme=${theme}&palette=${palette}`)
  await tab.playwright.locator(`html[data-theme="${theme}"][data-palette="${palette}"] .markdown-code .syntax-comment`).waitFor({state:'visible'})
  await tab.playwright.locator('.sidebar-title').waitFor({state:'visible'})
  await tab.getAXState({emit:false})
  let shell=await tab.playwright.evaluate(measureShell)
  for(let pending=0;!shell.boundaryMatches&&pending<50;pending++){await tab.getAXState({emit:false});shell=await tab.playwright.evaluate(measureShell)}
  assert(shell.groundMatchesSidebar,`${theme}/${palette}: split navigation base`)
  assert(shell.readingLighter && shell.readingStep>1.015 && shell.readingStep<1.28,`${theme}/${palette}: unsuitable reading step ${shell.readingStep}`)
  assert(shell.boundaryMatches && shell.boundary>1.02 && shell.boundary<1.65,`${theme}/${palette}: shell boundary ${shell.boundary}`)
  assert(shell.overflow<=1,`${theme}/${palette}: page overflow`)
  assert(shell.navigation.every(x=>x.ratio>=4.5),`${theme}/${palette}: navigation contrast ${JSON.stringify(shell.navigation)}`)
  const reading=await tab.playwright.evaluate(measureContrast)
  const failures=reading.samples.filter(x=>x.ratio<x.target)
  assert(!failures.length,`${theme}/${palette}: text/icon contrast ${JSON.stringify(failures)}`)
  await tab.playwright.getByRole('button',{name:'折叠侧栏',exact:true}).click()
  await tab.playwright.getByRole('button',{name:'展开侧栏',exact:true}).waitFor({state:'visible'})
  await tab.getAXState({emit:false})
  await tab.playwright.getByRole('button',{name:'展开侧栏',exact:true}).click()
  await tab.playwright.getByRole('button',{name:'折叠侧栏',exact:true}).waitFor({state:'visible'})
  await tab.getAXState({emit:false})
  const thinking=tab.playwright.getByRole('button',{name:'思考过程',exact:true})
  await thinking.press('Enter');await tab.getAXState({emit:false})
  assert(await thinking.getAttribute('aria-expanded')==='true',`${theme}/${palette}: keyboard thinking`)
  results.push({...shell,samples:reading.samples.length,minText:Math.min(...reading.samples.filter(x=>x.target===4.5).map(x=>x.ratio)),minIcon:Math.min(...reading.samples.filter(x=>x.target===3).map(x=>x.ratio)),sidebarToggle:true,keyboardThinking:true})
 }
 return results
}
