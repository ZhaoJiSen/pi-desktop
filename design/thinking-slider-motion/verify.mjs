export async function verifySliderMotion(tab,round){
 const assert=(condition,message)=>{if(!condition)throw new Error(message)}
 const button=name=>tab.playwright.getByRole('button',{name,exact:true})
 const slider=()=>tab.playwright.getByRole('slider',{name:'Thinking effort',exact:true})
 const snap=()=>tab.getAXState({emit:false})
 const read=()=>tab.playwright.evaluate(()=>{const c=document.querySelector('.model-thinking-control'),p=document.querySelector('.model-popover'),t=document.querySelector('.model-thinking-trigger'),e=c.querySelector('input'),thumb=c.querySelector('[data-slot=slider-thumb]'),track=c.querySelector('[data-slot=slider-track]');return {value:Number(e.value),text:e.getAttribute('aria-valuetext'),level:c.dataset.level,width:t.offsetWidth,effortWidth:t.querySelector('.model-trigger-effort').offsetWidth,left:t.getBoundingClientRect().left,panelLeft:p.getBoundingClientRect().left,panelWidth:p.offsetWidth,bg:getComputedStyle(c).backgroundColor,thumb:thumb.getBoundingClientRect().toJSON(),track:track.getBoundingClientRect().toJSON(),step:e.step,focus:document.activeElement===e}})
 const saves=async()=>JSON.parse(await tab.playwright.locator('body').getAttribute('data-requests')||'[]').filter(c=>c.type==='set_thinking_level').length
 await tab.goto(`http://localhost:1420/design/thinking-slider-motion/rpc.html?seed=motion-${round}`)
 await button('Model and thinking effort').waitFor({state:'visible'});await button('Model and thinking effort').click();await snap()
 const initial=await read(),states=[]
 for(const i of [1,2,3,0,3,1]){
  const r=await read();await tab.click([r.track.left+14+i*(r.track.width-28)/3,r.track.top+r.track.height/2]);await snap();states.push(await read())
 }
 assert(states.map(s=>s.level).join(',')==='medium,high,xhigh,low,xhigh,medium','Clicking nodes selects corresponding supported levels')
 assert(states.every(s=>s.width===initial.width&&s.effortWidth===initial.effortWidth),'Label width is reserved for every available level')
 assert(states.every(s=>Math.abs(s.left-initial.left)<1&&Math.abs(s.panelLeft-initial.panelLeft)<1&&s.panelWidth===initial.panelWidth),'Trigger and popover stay anchored across node clicks')
 assert(states.every(s=>s.bg===initial.bg),'Panel background stays neutral')
 await slider().press('Home');await snap();let r=await read(),before=await saves()
 await tab.drag([r.thumb.left+r.thumb.width/2,r.thumb.top+r.thumb.height/2],[r.track.left+14+(r.track.width-28)*0.72,r.track.top+r.track.height/2]);await snap()
 const partial=await read(),samples=JSON.parse(await tab.playwright.locator('body').getAttribute('data-motion-samples')||'[]'),dragging=samples.filter(s=>s.dragging==='true')
 assert(partial.level==='high'&&partial.value===2,'Release snaps a fractional drag to nearest real level')
 assert(await saves()===before+1,'Pointer drag saves only once on release')
 assert(new Set(dragging.map(s=>s.value)).size>4&&dragging.some(s=>s.value!==Math.round(s.value)),'Pointer movement includes continuous intermediate positions')
 assert(dragging.every(s=>s.transition==='none'&&s.saves===before),'Dragging follows without easing or intermediate saves')
 await slider().press('ArrowLeft');await snap();assert((await read()).value===1,'Keyboard moves exactly one level')
 await slider().press('End');await snap();const highest=await read();assert(highest.value===3&&highest.text==='Extra high'&&highest.focus,'Keyboard endpoint and accessible value remain discrete')
 const star=()=>tab.playwright.locator('.thinking-sparkle').first().evaluate(e=>({opacity:getComputedStyle(e).opacity,transform:getComputedStyle(e).transform,cssAnimation:getComputedStyle(e).animationName}))
 const a=await star();await tab.getScreenshot({emit:false});await snap();const b=await star()
 assert(a.transform!==b.transform&&a.opacity!==b.opacity,'Motion animates star movement and brightness')
 assert(a.cssAnimation==='none','No conflicting CSS keyframe animation')
 assert(await tab.playwright.locator('.thinking-sparkles').getAttribute('aria-hidden')==='true','Animated stars stay decorative')
 await tab.pressKey(null,'F9');await slider().press('Home');await snap();assert((await read()).value===3&&await tab.playwright.getByRole('alert').isVisible(),'Failed save restores accepted level')
 await tab.pressKey(null,'F10');await button('Reset to Medium').click();await snap();assert((await read()).value===1,'Reset remains functional')
 await tab.pressKey(null,'Escape');await tab.reload();await button('Model and thinking effort').waitFor({state:'visible'});await button('Model and thinking effort').click();await snap();assert((await read()).value===1,'Saved level survives reload')
 return {round,initial,states,partial,samples,highest,starBefore:a,starAfter:b,continuous:true,stable:true,persisted:true,saveFailure:true}
}
