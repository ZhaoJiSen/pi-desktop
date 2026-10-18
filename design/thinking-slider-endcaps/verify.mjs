import { verifySplit } from '../model-thinking-split/verify.mjs'
export async function verifyCaps(tab,round){
 const regression=await verifySplit(tab,200+round)
 const assert=(condition,message)=>{if(!condition)throw new Error(message)}
 await tab.goto(`http://localhost:1420/design/thinking-slider-endcaps/rpc.html?seed=caps-${round}`)
 await tab.playwright.getByRole('button',{name:'Thinking effort',exact:true}).click()
 await tab.getAXState({emit:false})
 const transitions=[]
 for(const index of [1,2,3,2,1,0,3,1]){
  const r=await tab.playwright.locator('[data-slot=slider-track]').evaluate(e=>e.getBoundingClientRect().toJSON())
  await tab.click([r.left+14+(r.width-28)*index/3,r.top+r.height/2])
  await tab.playwright.locator('body[data-transition-status=complete]').waitFor({state:'visible'})
  await tab.playwright.locator('.model-thinking-control:not([data-pending=true])').waitFor({state:'visible'})
  const frames=JSON.parse(await tab.playwright.locator('body').getAttribute('data-transition-samples')||'[]')
  assert(frames.length>10,'Transition captured intermediate frames')
  assert(frames.every(f=>f.start==='rgba(0, 0, 0, 0)'&&f.end==='rgba(0, 0, 0, 0)'),'Track gutters stay transparent throughout transition')
  assert(frames.every(f=>Math.abs(f.fillLeft-f.trackLeft)<.1&&Math.abs(f.fillWidth-f.trackWidth)<.1),'One fill covers the entire rail including both semicircles')
  assert(frames.every(f=>Math.abs(f.maskRight-f.thumbEnd)<.25),'Fill mask and thumb follow the same spring at every frame')
  transitions.push({index,frames})
 }
 assert(transitions[2].frames.some(f=>f.opacity>0&&f.opacity<1)&&transitions[2].frames.at(-1).opacity===1,'Spectrum still fades in')
 assert(transitions[3].frames.some(f=>f.opacity>0&&f.opacity<1)&&transitions[3].frames.at(-1).opacity===0,'Spectrum still fades out')
 return {round,regressionPassed:!!regression.persisted,transitions}
}
