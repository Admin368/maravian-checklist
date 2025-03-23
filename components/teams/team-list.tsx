import { Team } from "@prisma/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icons } from "@/components/icons";

interface TeamWithCounts extends Team {
  _count: {
    members: number;
    tasks: number;
  };
}

interface TeamListProps {
  teams: TeamWithCounts[];
}

export function TeamList({ teams }: TeamListProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {teams.map((team) => (
        <Card key={team.id}>
          <CardHeader>
            <CardTitle>{team.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <Icons.users className="mr-2 h-4 w-4" />
                {team._count.members} members
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Icons.tasks className="mr-2 h-4 w-4" />
                {team._count.tasks} tasks
              </div>
              <Button asChild className="mt-4">
                <Link href={`/teams/${team.slug}`}>View Team</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <Card className="flex h-full flex-col items-center justify-center p-8">
        <div className="flex flex-col items-center space-y-4 text-center">
          <Icons.plus className="h-8 w-8 text-muted-foreground" />
          <h3 className="text-lg font-medium">Create a new checklist</h3>
          <p className="text-sm text-muted-foreground">
            Create a new checklist to collaborate with others
          </p>
          <Button asChild>
            <Link href="/teams/new">Create Checklist</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
