"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/trpc/client";
import { Loader2, Lock, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "./user-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "next-auth/react";

type TeamMember = {
  userId: string;
  role: string | null;
};

type CheckInUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type APITeam = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date | null;
  isPrivate: boolean;
  members: TeamMember[];
  checkIns: { user: CheckInUser }[];
};

export function TeamsList() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [teamPassword, setTeamPassword] = useState<Record<string, string>>({});
  const [joiningTeam, setJoiningTeam] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const { userId, userName, isLoading: isUserLoading } = useUser();
  const [isEnteringTeam, setIsEnteringTeam] = useState<string | null>(null);

  const { data: allTeams, isLoading: isAllTeamsLoading } =
    api.teams.getAll.useQuery<APITeam[]>();
  const { data: joinedTeams, isLoading: isJoinedTeamsLoading } =
    api.teams.getJoinedTeams.useQuery<APITeam[]>(undefined, {
      enabled: status === "authenticated",
    });

  // Filter teams based on search query and active tab
  const filteredTeams = allTeams?.filter((team: APITeam) => {
    const matchesSearch = team.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const isJoined = team.members.some((member) => member.userId === userId);
    const isAdmin = team.members.some(
      (member) => member.userId === userId && member.role === "admin"
    );

    // Show team if:
    // 1. It matches the search query AND
    // 2. It's not private OR it's private but the user is a member
    const shouldShowTeam = matchesSearch && (!team.isPrivate || isJoined);

    switch (activeTab) {
      case "joined":
        return shouldShowTeam && isJoined;
      case "created":
        return shouldShowTeam && isAdmin;
      default:
        return shouldShowTeam;
    }
  });

  const joinTeam = api.teams.join.useMutation({
    onSuccess: (data, variables) => {
      const team = allTeams?.find((t: APITeam) => t.id === variables.teamId);
      if (team) {
        toast.success("Team joined", {
          description: `You have successfully joined ${team.name}`,
        });
        router.push(`/team/${team.slug}`);
      }
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message || "Failed to join team",
      });
    },
  });

  const handleJoinTeam = async (team: APITeam) => {
    try {
      setJoiningTeam(team.id);
      await joinTeam.mutateAsync({
        teamId: team.id,
        password: teamPassword[team.id] || "",
      });
    } catch (error) {
      // Error is handled in the mutation
    } finally {
      setJoiningTeam(null);
      setTeamPassword((prev) => ({ ...prev, [team.id]: "" }));
    }
  };

  const handleGoToCreateTeam = () => {
    router.push("/create-team");
  };

  if (
    isAllTeamsLoading ||
    (isJoinedTeamsLoading && status === "authenticated")
  ) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderTeamCard = (team: APITeam) => {
    const isJoined = team.members?.some((member) => member.userId === userId);
    const isAdmin = team.members?.some(
      (member) => member.userId === userId && member.role === "admin"
    );
    const checkedInUsers = team.checkIns?.map((checkIn) => checkIn.user) || [];

    return (
      <Card
        key={team.id}
        className={isJoined ? "border-primary/50 bg-primary/5" : undefined}
      >
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{team.name}</CardTitle>
              <CardDescription>@{team.slug}</CardDescription>
              <CardDescription>
                Created on{" "}
                {team.createdAt
                  ? new Date(team.createdAt).toLocaleDateString()
                  : "N/A"}
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              {team.isPrivate && (
                <div className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium flex items-center">
                  <Lock className="h-3 w-3 mr-1" />
                  Private
                </div>
              )}
              {isJoined && (
                <div className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                  {isAdmin ? "Owner" : "Joined"}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            disabled={!!isEnteringTeam}
            className="w-full"
            onClick={() => {
              setIsEnteringTeam(team.id);
              isJoined
                ? router.push(`/team/${team.slug}`)
                : router.push(`/team/${team.slug}/join`);
            }}
          >
            {isEnteringTeam
              ? "Joining..."
              : isJoined
              ? "Enter Checklist"
              : "Join Checklist"}
          </Button>
        </CardContent>
        <CardFooter>
          <div className="space-y-4">
            {checkedInUsers.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Checked in members today: {checkedInUsers.length}
                </div>
                <div className="flex -space-x-2">
                  {checkedInUsers.slice(0, 5).map((user) => (
                    <div
                      key={user.id}
                      className="h-8 w-8 rounded-full border-2 border-background overflow-hidden bg-muted"
                      title={user.name}
                    >
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs font-medium">
                          {user.name.charAt(0)}
                        </div>
                      )}
                    </div>
                  ))}
                  {checkedInUsers.length > 5 && (
                    <div className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                      +{checkedInUsers.length - 5}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardFooter>
      </Card>
    );
  };

  const renderSearchInput = (
    value: string,
    onChange: (value: string) => void
  ) => (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search teams by name..."
        className="pl-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Joined Teams Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold tracking-tight">My Checklists</h2>
          <Button onClick={handleGoToCreateTeam}>
            <Plus className="mr-2 h-4 w-4" />
            Create Checklist
          </Button>
        </div>

        {!joinedTeams?.length ? (
          <div className="text-center p-8 border rounded-lg bg-muted/50">
            <h3 className="text-lg font-medium mb-2">No Joined Checklists</h3>
            <p className="text-muted-foreground mb-4">
              {`You haven't joined any checklists yet. Search for checklists to join or create your own.`}
            </p>
            <Button onClick={handleGoToCreateTeam}>
              <Plus className="mr-2 h-4 w-4" />
              Create Team
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {joinedTeams.map((team) => renderTeamCard(team))}
          </div>
        )}
      </div>

      {/* Search Teams Section */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-4">
          Find Checklists
        </h2>

        <div className="flex flex-col gap-4">
          {renderSearchInput(searchQuery, setSearchQuery)}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="joined">Joined</TabsTrigger>
              <TabsTrigger value="created">By Me</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="pt-4">
              {!filteredTeams?.length ? (
                <div className="text-center p-8 border rounded-lg bg-muted/50">
                  <h3 className="text-lg font-medium mb-2">
                    No Checklists Found
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Create a new checklist or try a different search term.
                  </p>
                  <Button onClick={handleGoToCreateTeam}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Checklist
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTeams.map((team) => renderTeamCard(team))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="joined" className="pt-4">
              {!filteredTeams?.length ? (
                <div className="text-center p-8 border rounded-lg bg-muted/50">
                  <h3 className="text-lg font-medium mb-2">
                    No Matching Teams
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    No joined teams match your search query.
                  </p>
                  <Button variant="outline" onClick={() => setSearchQuery("")}>
                    Clear Search
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTeams.map((team) => renderTeamCard(team))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="created" className="pt-4">
              {!filteredTeams?.length ? (
                <div className="text-center p-8 border rounded-lg bg-muted/50">
                  <h3 className="text-lg font-medium mb-2">No Teams Created</h3>
                  <p className="text-muted-foreground mb-4">
                    {`You haven't created any teams that match your search.`}
                  </p>
                  <Button onClick={handleGoToCreateTeam}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Team
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTeams.map((team) => renderTeamCard(team))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
