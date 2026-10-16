import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl" aria-busy="true" aria-label="Loading goal">
      <Skeleton className="h-3.5 w-12" />
      <Skeleton className="mt-3 h-7 w-2/3" />
      <div className="mt-6 space-y-5">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}
