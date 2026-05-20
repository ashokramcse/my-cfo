import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg bg-white/5 shimmer', className)}
      style={{ backgroundSize: '200% 100%' }} />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="kpi-card space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8 rounded-xl" />
      </div>
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-border/40">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('rounded-2xl', className)} />
}
