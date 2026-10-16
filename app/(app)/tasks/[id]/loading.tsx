import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl" aria-busy="true" aria-label="Loading task">
      <Skeleton className="h-3.5 w-12" />
      <div className="mt-3 flex items-start justify-between gap-4">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-7 w-24" />
      </div>
      <div className="mt-6 space-y-4 rounded-xl border bg-card p-5 md:p-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="mt-5 space-y-3 rounded-xl border bg-card p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}
