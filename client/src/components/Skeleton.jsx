// Reusable skeleton primitives
export function SkeletonLine({ className = '' }) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} />;
}

export function SkeletonAvatar({ size = 'md' }) {
  const s = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';
  return <div className={`${s} rounded-full bg-gray-200 animate-pulse flex-shrink-0`} />;
}

export function SkeletonCard({ children, className = '' }) {
  return <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 ${className}`}>{children}</div>;
}

// Shift list row skeleton
export function ShiftRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <SkeletonAvatar />
      <div className="flex-1 space-y-1.5">
        <SkeletonLine className="h-3.5 w-32" />
        <SkeletonLine className="h-3 w-20" />
      </div>
      <div className="space-y-1.5 text-right">
        <SkeletonLine className="h-3.5 w-24" />
        <SkeletonLine className="h-4 w-16 rounded-full" />
      </div>
    </div>
  );
}

// Exchange card skeleton
export function ExchangeCardSkeleton() {
  return (
    <SkeletonCard>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <SkeletonAvatar />
          <div className="space-y-1.5">
            <SkeletonLine className="h-3.5 w-28" />
            <SkeletonLine className="h-3 w-16" />
          </div>
        </div>
        <div className="space-y-1.5">
          <SkeletonLine className="h-3.5 w-28" />
          <SkeletonLine className="h-3 w-16" />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <SkeletonLine className="h-8 w-28 rounded-lg" />
        <SkeletonLine className="h-8 w-28 rounded-lg" />
      </div>
    </SkeletonCard>
  );
}

// Message conversation row skeleton
export function ConversationSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <SkeletonAvatar size="lg" />
      <div className="flex-1 space-y-1.5">
        <SkeletonLine className="h-3.5 w-36" />
        <SkeletonLine className="h-3 w-48" />
      </div>
      <SkeletonLine className="h-3 w-10" />
    </div>
  );
}

// Staff grid skeleton
export function StaffGridSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
        <SkeletonLine className="h-8 w-8 rounded-lg" />
        <div className="space-y-1">
          <SkeletonLine className="h-4 w-32" />
          <SkeletonLine className="h-3 w-48" />
        </div>
      </div>
      <div className="p-4 space-y-3">
        {[1,2,3,4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonLine className="h-3.5 w-28" />
            {[1,2,3,4,5,6,7].map((j) => (
              <SkeletonLine key={j} className="h-6 w-6 rounded-full flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
