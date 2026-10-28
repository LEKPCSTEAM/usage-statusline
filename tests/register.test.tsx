import { expect, mock, test } from 'claude-code/testing'

const NOW = Date.parse('2026-10-28T12:00:00Z')

const BAND = {
  plugin: 'usage-statusline',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

test('the band shows context and rate limits, never cost, on every surface', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({
    value: { startedAt: NOW, context: { window: 200_000 }, rateLimits: [] },
  }))
  on('session.measure', (_, e) => ({ changed: e.changed }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure({
    context: { tokens: 84_000, window: 200_000, percent: 42 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-10-28T14:13:00Z' },
      { kind: 'seven_day', percentUsed: 81, resetsAt: '2026-10-31T16:00:00Z' },
    ],
    cost: { usd: 1.234 },
    changed: ['context', 'rateLimits', 'cost'],
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })

    expect((await ui.find({ type: 'Text', text: /^42%$/ }))?.text).toBe('42%')
    expect((await ui.find({ type: 'Text', text: /\// }))?.text).toBe('84k/200k')
    expect((await ui.find({ type: 'Text', text: /2h 13m/ }))?.text).toBe('↻ 2h 13m')
    expect((await ui.find({ type: 'Text', text: /3d 4h/ }))?.text).toBe('↻ 3d 4h')
    expect(await ui.find({ type: 'Text', text: /\$/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('a 1M window shows its tokens in M', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('session.measure', (_, e) => ({ changed: e.changed }))

  await $.session.measure({
    context: { tokens: 214_700, window: 1_000_000, percent: 21 },
    rateLimits: [],
    changed: ['context'],
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /\// }))?.text).toBe('215k/1M')
  await ui.unmount()
})

test('a survey keeps the band', async ($, on) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>survey</Text>
  })

  await $.session.measure({
    context: { tokens: 1_000, window: 200_000, percent: 1 },
    rateLimits: [],
    changed: ['context'],
  })

  const ui = await $.ui.mount({
    ...BAND,
    props: { ...BAND.props, hasSurvey: true },
    surface: 'desktop',
  })

  expect((await ui.find({ type: 'Text', text: /survey/ }))?.text).toBe('survey')
  await ui.unmount()
})
