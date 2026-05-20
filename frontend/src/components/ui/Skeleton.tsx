import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('shimmer', className)} />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="kpi-card">
      <div className="flex justify-between items-start mb-3">
        <Skeleton className="h-2.5 w-20 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-6 w-28 rounded-lg mb-2" />
      <Skeleton className="h-2.5 w-16 rounded-full" />
    </div>
  )
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr style={{ borderBottom: '1px solid #EDE8E2' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full rounded-md" />
        </td>
      ))}
    </tr>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('rounded-2xl', className)} />
}
