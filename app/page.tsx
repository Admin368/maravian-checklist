import { TeamsList } from "@/components/teams-list";

export default function Home() {
  return (
    <main className="container mx-auto py-6 max-w-5xl">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome to Checklist
          </h1>
          <p className="text-muted-foreground">
            Live task tracker for Teams, Workplaces and Individuals for event
            planning, daily tasks, recurring tasks, and more. Helping track
            daily tasks and long-term goals.
          </p>
        </div>

        <TeamsList />
      </div>
    </main>
  );
}
