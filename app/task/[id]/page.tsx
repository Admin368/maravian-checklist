import { TaskFocusMode } from "@/components/task-focus-mode";

interface TaskFocusPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function TaskFocusPage({ params }: TaskFocusPageProps) {
  const { id } = await params;
  return (
    <div className="container max-w-3xl py-4 md:py-8">
      <TaskFocusMode taskId={id} />
    </div>
  );
}
