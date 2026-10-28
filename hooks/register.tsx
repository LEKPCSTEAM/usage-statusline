import type { Register, SessionUsage } from 'claude-code'

const BAR_CELLS = 10
const MINUTE_MS = 60_000

const LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: '7d',
  spend_limit: 'Spend',
}

let usage: SessionUsage | undefined

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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    usage = await $.session.usage()
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

    const meter = (key: string, label: string, percent: number, note?: string) => {
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
          {note !== undefined && <Text dimColor tabular>{`↻ ${note}`}</Text>}
        </Box>
      )
    }

    const meters = [
      usage.context.percent !== undefined &&
        meter('context', 'Context', usage.context.percent),
      ...usage.rateLimits.map(limit =>
        meter(
          limit.kind,
          LABELS[limit.kind] ?? limit.kind,
          limit.percentUsed,
          timeLeft(limit.resetsAt, now),
        ),
      ),
    ].filter(item => item !== false)

    if (meters.length === 0 && usage.cost === undefined) return next(e)

    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={3}>
        {meters}
        {usage.cost !== undefined && (
          <Text dimColor tabular>{`$${usage.cost.usd.toFixed(2)}`}</Text>
        )}
      </Box>
    )
  })
}
