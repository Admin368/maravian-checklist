"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@/components/user-provider";
import { api } from "@/lib/trpc/client";
import { ChecklistComponent } from "@/components/checklist";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChecklistsPage() {
  const { slug } = useParams();
  const { userId } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);

  // Get team data
  const { data: teamData, isLoading: isLoadingTeam } =
    api.teams.getBySlug.useQuery(
      { slug: slug as string },
      {
        enabled: !!slug && !!userId,
        onSuccess: (data) => {
          if (data?.team?.id) {
            setTeamId(data.team.id);
            setTeamName(data.team.name);

            // Check if current user is an admin
            const member = data.teamMembers?.find((m) => m.id === userId);
            setIsAdmin(
              member?.role === "admin" || member?.role === "owner" || false
            );
          }
        },
      }
    );

  if (isLoadingTeam) {
    return (
      <div className="container mx-auto py-6">
        <Skeleton className="h-8 w-1/4 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!teamId) {
    return (
      <div className="container mx-auto py-6">
        <h1 className="text-2xl font-bold mb-4">Checklist Not Found</h1>
        <p>
          {`The team you're looking for doesn't exist or you don't have access.`}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">{teamName}</h1>

      <Tabs defaultValue="longterm">
        <TabsList className="mb-4">
          <TabsTrigger value="longterm">LongTerm Tasks</TabsTrigger>
        </TabsList>
        <TabsContent value="longterm" className="mt-6">
          <h2 className="text-2xl font-bold">LongTerm Tasks</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Long-term tasks represent ongoing responsibilities or one-time
            activities that persist over time. When completed, they remain
            checked off regardless of the date.
          </p>
          <ChecklistComponent
            teamId={teamId}
            teamName={teamName || ""}
            isAdmin={isAdmin}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
