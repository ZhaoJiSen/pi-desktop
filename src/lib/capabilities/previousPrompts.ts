export const previousBuiltinPrompts: Record<string, string[]> = {
  review: [
    '请审查当前工作区的改动，重点检查错误、边界条件和回归风险。按严重程度列出问题，并附上文件位置与原因。先给出评审结果，不修改代码。',
    'Review the current workspace changes. Focus on bugs, edge cases, and regression risks. Report findings with file locations and reasons, ordered by severity. Do not modify code.',
  ],
  commit: [
    '请根据当前工作区的改动，整理简洁的提交标题和说明，概括解决的问题、行为变化和验证情况。只生成文案，不创建分支或执行提交。',
    'Draft a concise commit title and description based on the current workspace changes. Summarize the problem, behavior changes, and validation. Only prepare the message; do not create a branch or commit.',
  ],
  plan: [
    '请先为下面的任务制定实现方案。查看相关代码后，说明实施步骤、受影响的组件、主要取舍和验证方法。先提供方案，再进行代码修改。\n\n任务：',
    'Plan the implementation for the following task. Inspect the relevant code first, then describe the steps, affected components, tradeoffs, and validation. Present the plan before modifying code.\n\nTask: ',
  ],
  explain: [
    '请解释当前项目中相关代码的工作方式，沿着入口、数据流和关键判断展开，说明为什么这样实现。先解释，不修改代码。',
    'Explain the relevant code in the current project. Follow the entry point, data flow, and key decisions, and explain why it is written this way. Do not modify code.',
  ],
  tests: [
    '请检查当前改动缺少哪些关键行为和边界条件的测试，按需补充有价值的测试，并说明验证结果。\n\n重点关注：',
    'Review the current changes and identify missing tests for important behavior and edge cases. Add focused tests where needed and report the validation results.\n\nFocus: ',
  ],
}

export const previousBuiltinDescriptions: Record<string, string[]> = {
  review: ['审查改动中的缺陷与回归风险，不修改代码。'],
  commit: ['根据当前改动起草提交说明，不执行提交。'],
  plan: ['限制写入操作，先探索并制定计划。'],
  explain: ['理解代码调用链与设计取舍。'],
  tests: ['为指定行为补充有针对性的测试。'],
}
