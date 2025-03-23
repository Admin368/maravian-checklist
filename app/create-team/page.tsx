import { CreateTeamForm } from "@/components/create-team-form";

export default function CreateTeamPage() {
  return (
    <main className="container mx-auto py-6 max-w-5xl">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-center mb-4">
          <h1 className="text-3xl font-bold tracking-tight">
            Create a New Checklist
          </h1>
          <p className="text-muted-foreground">
            Set up a checklist for your task management.
          </p>
        </div>

        <CreateTeamForm />
      </div>
    </main>
  );
}
