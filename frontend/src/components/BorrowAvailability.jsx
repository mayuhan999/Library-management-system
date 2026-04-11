import { cn } from '@/lib/utils'

/** Green when copies available; red when none. */
export function BorrowAvailability({
  available,
  total,
  detailed = false,
  className,
}) {
  const ok = available > 0
  return (
    <span
      className={cn(
        'font-semibold tabular-nums',
        ok ? 'text-emerald-600' : 'text-red-600',
        className,
      )}
    >
      {detailed ? (
        <>
          {ok ? 'Available' : 'Unavailable'} · {available} / {total}{' '}
          {total === 1 ? 'copy' : 'copies'}
        </>
      ) : (
        <>
          {ok ? 'Available' : 'Unavailable'} {available}/{total}
        </>
      )}
    </span>
  )
}
