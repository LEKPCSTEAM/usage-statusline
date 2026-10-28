import type { Register, SessionUsage } from 'claude-code'

const BAR_CELLS = 10
const MINUTE_MS = 60_000

const LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: '7d',
  spend_limit: 'Spend',
}

let usage: SessionUsage | undefined
// /context's local estimate, until a reply reports the real fill
let estimate: { tokens: number; percent: number } | undefined

function tone(percent: number) {
  return percent >= 80 ? 'error' : percent >= 50 ? 'warning' : 'success'
}

function timeLeft(resetsAt: string | undefined, now: number) {
  const ms = resetsAt === undefined ? Number.NaN : Date.parse(resetsAt) - now
  if (!(ms > 0)) return undefined

  const minutes = Math.ceil(ms / MINUTE_MS)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  return `${minutes}m`
}

function compact(tokens: number) {
  // From here k would round to 1000k
  if (tokens >= 999_500) return `${Number((tokens / 1_000_000).toFixed(1))}M`
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`
  return `${tokens}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const current = await $.session.usage()
    usage = current
    if (current.context.percent === undefined) {
      const { breakdown } = (await $.session.usage({ breakdown: 'summary' })).context
      estimate = breakdown && {
        tokens: breakdown.totalTokens,
        percent: (breakdown.totalTokens / current.context.window) * 100,
      }
    }
    $.ui.invalidate('ui.render')
    // Redraw so the reset countdowns keep ticking between turns.
    $.clock.every(MINUTE_MS, () => $.ui.invalidate('ui.render'))

    return result
  })

  on('session.measure', async ($, e, next) => {
    usage = { startedAt: usage?.startedAt ?? 0, ...e }
    $.ui.invalidate('ui.render')

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || usage === undefined) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()

    const meter = (key: string, label: string, percent: number, detail?: string) => {
      const filled = Math.max(0, Math.min(BAR_CELLS, Math.round((percent / 100) * BAR_CELLS)))

      return (
        <Box key={key} flexDirection="row" columnGap={1}>
          <Text dimColor>{label}</Text>
          <Text mono>
            <Text color={tone(percent)}>{'━'.repeat(filled)}</Text>
            <Text color="subtle">{'━'.repeat(BAR_CELLS - filled)}</Text>
          </Text>
          <Text tabular weight="semibold" color={tone(percent)}>
            {`${Math.round(percent)}%`}
          </Text>
          {detail !== undefined && <Text dimColor tabular>{detail}</Text>}
        </Box>
      )
    }

    const { context } = usage
    const approx = context.percent === undefined ? estimate : undefined
    const percent = context.percent ?? approx?.percent
    const tokens = approx === undefined ? context.tokens : approx.tokens
    const meters = [
      percent !== undefined &&
        meter(
          'context',
          'Context',
          percent,
          tokens === undefined
            ? undefined
            : `${approx ? '~' : ''}${compact(tokens)}/${compact(context.window)}`,
        ),
      ...usage.rateLimits.map(limit => {
        const left = timeLeft(limit.resetsAt, now)

        return meter(
          limit.kind,
          LABELS[limit.kind] ?? limit.kind,
          limit.percentUsed,
          left === undefined ? undefined : `↻ ${left}`,
        )
      }),
    ].filter(item => item !== false)

    if (meters.length === 0) return next(e)

    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={3}>
        {meters}
      </Box>
    )
  })
}
