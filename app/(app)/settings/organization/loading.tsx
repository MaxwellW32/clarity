import { FormSkeleton } from "@/components/skeletons";

export default function Loading() {
  return <FormSkeleton cards={3} withHeader={false} />;
}
