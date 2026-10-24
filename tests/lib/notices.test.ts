import { afterEach, describe, expect, it } from 'vitest'
import {
  actionNotice,
  onActionNotice,
  reportActionNotice,
  reportSuccessNotice,
} from '../../src/lib/notices'

describe('action notices', () => {
  const heard: string[] = []
  let unsubscribe = () => {}
  afterEach(() => unsubscribe())

  it('publishes a trimmed success message with its tone and ignores blanks', () => {
    const notices: unknown[] = []
    unsubscribe = onActionNotice((message, tone) => notices.push({ message, tone }))
    reportSuccessNotice('  Pull completed  ')
    reportSuccessNotice(' ')
    expect(notices).toEqual([{ message: 'Pull completed', tone: 'success' }])
  })

  it('splits a product sentence from the operating-system cause', () => {
    expect(
      actionNotice('Could not open the project directory: No such file or directory (os error 2)'),
    ).toEqual({
      title: 'Could not open the project directory',
      detail: 'No such file or directory (os error 2)',
    })
    expect(actionNotice('无法打开项目目录: 没有那个文件或目录 (os error 2)')).toEqual({
      title: '无法打开项目目录',
      detail: '没有那个文件或目录 (os error 2)',
    })
  })

  it('keeps a sentence without a cause on one line', () => {
    expect(actionNotice('Choose a project folder.')).toEqual({
      title: 'Choose a project folder.',
      detail: '',
    })
    expect(actionNotice('The folder is missing')).toEqual({
      title: 'The folder is missing',
      detail: '',
    })
  })

  it('delivers the trimmed message to subscribers and ignores blanks', () => {
    unsubscribe = onActionNotice((message) => heard.push(message))
    reportActionNotice(new Error('  Could not open the project directory: missing  '))
    reportActionNotice('   ')
    reportActionNotice(new Error(''))
    expect(heard).toEqual(['Could not open the project directory: missing'])
  })
})
