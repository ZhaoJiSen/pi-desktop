export async function verifyCaretScroll(tab) {
 const assert=(c,m)=>{if(!c)throw new Error(m)}
 const snapshot=()=>tab.getAXState({emit:false})
 const press=key=>tab.pressKey(null,({'Shift+Enter':'shift+Return','ArrowLeft':'Left','ArrowRight':'Right','Meta+z':'super+z','Meta+Shift+z':'super+shift+z'})[key] || key)
 const editor=tab.playwright.locator('.draft-editor')
 await editor.waitFor({state:'visible'})
 await editor.fill('');await snapshot()
 const measure=()=>tab.playwright.evaluate(()=>{
  const editor=document.querySelector('.draft-editor'),field=document.querySelector('.draft-field'),selection=window.getSelection()
  const range=selection?.rangeCount?selection.getRangeAt(0):null
  const rects=range?[...range.getClientRects()]:[]
  const caret=rects[0]||editor.querySelector('[data-editor-tail]')?.getBoundingClientRect()
  const bounds=field.getBoundingClientRect()
  return {text:editor.textContent,scrollTop:field.scrollTop,maxScroll:field.scrollHeight-field.clientHeight,fieldHeight:field.clientHeight,caretTop:caret?.top,caretBottom:caret?.bottom,viewTop:bounds.top,viewBottom:bounds.bottom,focus:selection?.focusOffset,focused:document.activeElement===editor,pageScroll:document.scrollingElement.scrollTop,outerScroll:document.querySelector('.preview-frame').scrollTop}
 })
 const batches=[]
 for(let batch=0;batch<5;batch++){
  for(let line=0;line<8;line++)await press('Shift+Enter')
  await snapshot()
  const m=await measure()
  assert(m.text==='\n'.repeat((batch+1)*8),'Each Shift+Enter should retain exactly one newline')
  assert(m.caretTop>=m.viewTop && m.caretBottom<=m.viewBottom,'Newline caret must remain inside editor viewport')
  assert(m.maxScroll-m.scrollTop<=8,'Editor should follow the last blank line as content grows')
  assert(m.pageScroll===0 && m.outerScroll===0,'Caret reveal must not scroll outside the editor')
  batches.push(m)
 }
 await press('x');await snapshot()
 const typing=await measure()
 assert(typing.text.endsWith('\nx') && typing.caretBottom<=typing.viewBottom,'Typing after repeated newlines should remain visible at the end')
 for(let i=0;i<typing.text.length;i++)await press('ArrowLeft')
 await snapshot()
 await press('a');await snapshot()
 const middle=await measure()
 assert(middle.text.startsWith('a\n') && middle.focus===1 && middle.scrollTop<=8,'Editing the beginning must not force a jump to the bottom')
 for(let i=0;i<middle.text.length;i++)await press('ArrowRight')
 await snapshot()
 await press('Shift+Enter');await snapshot()
 const last=await measure()
 assert(last.caretBottom<=last.viewBottom && last.maxScroll-last.scrollTop<=8,'Returning to the end and inserting newline must reveal caret')
 await press('Meta+z');await snapshot()
 const undo=await measure()
 assert(undo.text.endsWith('x') && undo.caretBottom<=undo.viewBottom,'Undo should preserve visible cursor and exact text')
 await press('Meta+Shift+z');await snapshot()
 const redo=await measure()
 assert(redo.text.endsWith('x\n') && redo.caretBottom<=redo.viewBottom,'Redo should reveal the restored final newline')
 const text=redo.text
 await tab.reload();await snapshot()
 await editor.waitFor({state:'visible'})
 const restored=await measure()
 assert(restored.text===text && restored.focused && restored.caretBottom<=restored.viewBottom,'Reopening a long draft should reveal the restored caret')
 await tab.playwright.getByRole('button',{name:'Choose model',exact:true}).click();await snapshot()
 assert(!(await editor.evaluate(e=>e===document.activeElement)),'Opening model selector must not pull focus back to editor')
 await tab.pressKey(null,'Escape');await snapshot()
 return {batches,typing,middle,undo,redo,restored,blurredFocusPreserved:true}
}
