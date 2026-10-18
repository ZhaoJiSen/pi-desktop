export async function verifyComposerSpacing(tab) {
  const assert = (value, message) => { if (!value) throw new Error(message) }
  const snapshot = () => tab.getAXState({emit:false})
  const editor = tab.playwright.locator('.draft-editor')
  await editor.waitFor({state:'visible'})
  const measure = () => tab.playwright.evaluate(()=>{
    const c=document.querySelector('.composer'),e=document.querySelector('.draft-editor'),f=document.querySelector('.draft-field'),b=document.querySelector('.composer-toolbar')
    return {height:c.getBoundingClientRect().height,top:e.getBoundingClientRect().top-c.getBoundingClientRect().top,editorHeight:e.getBoundingClientRect().height,gap:b.getBoundingClientRect().top-e.getBoundingClientRect().bottom,overflow:f.scrollHeight-f.clientHeight,fieldHeight:f.clientHeight,toolbarTop:b.getBoundingClientRect().top,fieldBottom:f.getBoundingClientRect().bottom}
  })
  await editor.fill(''); await snapshot()
  assert(await tab.playwright.locator('.draft-placeholder').isVisible(), 'Empty editor should retain its placeholder')
  const empty=await measure()
  assert(empty.height===94 && empty.editorHeight===22 && empty.top===14, 'Empty composer should use a single writing line and 14px top inset')
  await editor.fill('检查一下工作区'); await snapshot()
  const single=await measure()
  assert(single.height===94 && single.overflow<=0, 'Short text should remain compact without a scrollbar')
  await editor.press('Shift+Enter'); await snapshot()
  await editor.pressSequentially('接着检查依赖'); await snapshot()
  assert(await editor.textContent()==='检查一下工作区\n接着检查依赖', 'Typing after Shift+Enter must stay on the next line without adding sentinel characters')
  const two=await measure()
  assert(two.editorHeight>=44 && two.height>single.height && two.overflow<=0, 'Shift+Enter should grow the composer naturally')
  await editor.fill(Array.from({length:24},(_,i)=>`第 ${i+1} 行：保留足够的书写空间。`).join('\n')); await snapshot()
  const long=await measure()
  assert(long.fieldHeight<=176 && long.overflow>0 && long.toolbarTop>long.fieldBottom, 'Long drafts should scroll inside the editor and keep toolbar below it')
  await editor.fill('/skill:commit'); await snapshot()
  await editor.press('Enter'); await snapshot()
  assert(await tab.playwright.locator('.command-tag').count()===1, 'Slash command should still insert a chip')
  const chip=await measure()
  assert(chip.height<=96 && chip.overflow<=0, 'Command chip should fit one line without a scrollbar')
  const safe=await tab.playwright.evaluate(()=>{
    const r=document.querySelector('.command-tag-remove').getBoundingClientRect(),f=document.querySelector('.draft-field').getBoundingClientRect()
    return r.top>=f.top && r.bottom<=f.bottom
  })
  assert(safe, 'Chip removal button must stay inside the scrollport')
  await editor.fill('刷新后保留这段草稿'); await snapshot()
  await tab.reload(); await snapshot()
  await editor.waitFor({state:'visible'})
  assert(await editor.textContent()==='刷新后保留这段草稿', 'Draft should survive refresh')
  return {empty,single,two,long,chip,chipRemovalSafe:safe,persistedDraft:true}
}
