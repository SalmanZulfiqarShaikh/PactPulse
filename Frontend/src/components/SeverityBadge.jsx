import { Badge } from './ui/Badge'
import { severityMeta } from '../lib/severity'

/**
 * Severity, always with its word. The colour is a reinforcement of the label,
 * never the only signal - which is what makes this readable in greyscale and to
 * anyone who cannot distinguish the hues.
 */
export function SeverityBadge({ severity, className }) {
  const meta = severityMeta(severity)

  return (
    <Badge dot={meta.dot} className={`${meta.badge} ${className ?? ''}`}>
      {meta.label}
    </Badge>
  )
}
