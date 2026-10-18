export async function verifyPromptInput(tab, run=1) {
 const base='http://localhost:1420/design/prompt-input-refresh/preview.html'
 const assert=(c,m)=>{if(!c)throw new Error(m)}
 const snapshot=()=>tab.getAXState({emit:false})
 const editor=tab.playwright.locator('.draft-editor')
 const send=()=>tab.playwright.getByRole('button',{name:'Send',exact:true})
 const go=async state=>{await tab.goto(`${base}?state=${state}&seed=${run}`);await editor.waitFor({state:'visible'});await snapshot()}
 await go('command')
 await editor.fill('/skill:commit');await snapshot()
 await editor.press('Enter');await snapshot()
 const metrics=await tab.playwright.evaluate(()=>({
  height:document.querySelector('.composer').getBoundingClientRect().height,
  toolbarHeight:document.querySelector('.composer-toolbar').getBoundingClientRect().height,
  modelRadius:getComputedStyle(document.querySelector('.model-trigger')).borderRadius,
  modelFill:getComputedStyle(document.querySelector('.model-trigger')).backgroundColor,
  tagRadius:getComputedStyle(document.querySelector('.command-tag')).borderRadius,
  metadata:document.querySelector('.metadata').textContent,
 }))
 assert(Math.abs(metrics.height-95)<0.5 && metrics.toolbarHeight===34,'New shell should retain compact writing and control heights')
 assert(metrics.modelRadius==='999px' && metrics.tagRadius==='999px' && metrics.modelFill!=='rgba(0, 0, 0, 0)','Controls and tokens should use the coordinated capsule surface')
 assert(metrics.metadata.includes('main') && metrics.metadata.includes('Context') && metrics.metadata.includes('tokens') && metrics.metadata.includes('Est.'),'Existing metadata must remain visible')
 await tab.playwright.getByRole('button',{name:'Choose model',exact:true}).click();await snapshot()
 const search=tab.playwright.getByRole('textbox',{name:'Search',exact:true})
 await search.fill('opus');await snapshot()
 await tab.playwright.getByRole('button',{name:'Claude Sonnet, anthropic',exact:true}).waitFor({state:'hidden'})
 assert(await tab.playwright.getByRole('button',{name:'Claude Opus, anthropic',exact:true}).count()===1,'Model search must still filter')
 await search.fill('');await snapshot()
 await tab.playwright.getByRole('button',{name:'Claude Sonnet, anthropic',exact:true}).waitFor({state:'visible'})
 await tab.playwright.getByRole('button',{name:'Claude Sonnet, anthropic',exact:true}).click();await snapshot()
 await tab.playwright.locator('.model-popover').waitFor({state:'hidden'})
 await tab.playwright.getByRole('button',{name:'Thinking effort',exact:true}).click();await snapshot()
 await tab.playwright.getByRole('button',{name:'High',exact:true}).click();await snapshot()
 await tab.playwright.locator('.thinking-popover').waitFor({state:'hidden'})
 assert((await tab.playwright.locator('.reasoning').textContent()).includes('High'),'Reasoning capsule should show selected value')
 await editor.fill('/login');await snapshot()
 await editor.press('Enter');await snapshot()
 const errorDraft=await editor.textContent()
 await send().click();await snapshot()
 assert(await tab.playwright.getByRole('alert').count()===1,'Unsupported terminal command should show existing error')
 assert(await editor.textContent()===errorDraft,'Command error must preserve draft')
 await editor.fill('Draft saved');await snapshot()
 assert(await tab.playwright.getByRole('alert').count()===0,'Editing should clear error')
 await tab.pressKey(null,'F4');await snapshot()
 assert(!(await send().isEnabled()) && await send().getAttribute('data-pending')==='true','Connecting send control should be busy and disabled')
 assert(await tab.playwright.locator('.send .send-spinner').count()===1,'Pending state should show HeroUI spinner')
 await tab.pressKey(null,'F5');await snapshot()
 assert(await send().isEnabled() && await tab.playwright.locator('.send-spinner').count()===0,'Ready state should restore send icon')
 await tab.pressKey(null,'F7');await snapshot()
 await editor.fill('Storage failure draft');await snapshot()
 assert(await tab.playwright.locator('body').getAttribute('data-storage-error')==='true','Fixture storage failure should reach real store guard')
 assert(await editor.textContent()==='Storage failure draft','Save failure must retain the draft')
 await tab.pressKey(null,'F8');await snapshot()
 await tab.reload();await snapshot();await editor.waitFor({state:'visible'})
 assert(await editor.textContent()==='Storage failure draft','Draft should survive reload after recovery')
 assert((await tab.playwright.locator('.reasoning').textContent()).includes('High'),'Reasoning selection should survive reload')
 await go('attachments')
 assert(await tab.playwright.locator('.attachment').count()===2,'Attachment cards should show existing files')
 await tab.playwright.getByRole('button',{name:'Remove LEARNING.md',exact:true}).click();await snapshot()
 assert(await tab.playwright.locator('.attachment').count()===1 && (await tab.playwright.locator('.attachment').textContent()).includes('workspace-review.tsx'),'Attachment removal should preserve the other file')
 await go('running')
 assert(await tab.playwright.getByRole('button',{name:'Stop',exact:true}).isEnabled(),'Streaming should retain enabled stop control')
 assert(await tab.playwright.locator('.send .stop-icon').count()===1,'Streaming should show stop glyph')
 assert(!(await tab.playwright.getByRole('button',{name:'Choose model',exact:true}).isEnabled()),'Running state should retain disabled model control')
 await tab.pressKey(null,'F6');await snapshot()
 assert(await send().isEnabled(),'Server completion fixture should return send state')
 await go('empty')
 assert(await tab.playwright.locator('.draft-placeholder').isVisible() && !(await send().isEnabled()),'Empty state should retain placeholder and disabled send')
 await tab.goto(`${base}?state=text&seed=${run}&width=320`);await editor.waitFor({state:'visible'});await snapshot()
 const narrow=await tab.playwright.evaluate(()=>{
  const toolbar=document.querySelector('.composer-toolbar'),bounds=toolbar.getBoundingClientRect()
  return {overflow:toolbar.scrollWidth-toolbar.clientWidth,buttons:[...toolbar.querySelectorAll('button')].map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,height:e.getBoundingClientRect().height})),left:bounds.left,right:bounds.right,tokens:getComputedStyle(document.querySelector('.optional-token')).display,effort:document.querySelector('.reasoning').textContent,effortOverflow:document.querySelector('.reasoning > span').scrollWidth-document.querySelector('.reasoning > span').clientWidth}
 })
 assert(narrow.overflow<=1 && narrow.buttons.every(b=>b.left>=narrow.left-1 && b.right<=narrow.right+1 && b.height===34),'Narrow toolbar should keep every control contained and full height')
 assert(narrow.tokens==='none' && narrow.effort.includes('Medium') && narrow.effortOverflow<=1,'Narrow metadata should compact while keeping effort visible')
 return {metrics,narrow,modelSearchAndSelection:true,thinkingSelection:true,errorPreservesDraft:true,busySpinner:true,storageFailureRetainsDraft:true,reload:true,attachmentRemoval:true,runState:true,emptyState:true}
}
