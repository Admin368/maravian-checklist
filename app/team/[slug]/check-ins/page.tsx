"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { format, parseISO, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  ChevronLeft,
  Loader2,
  Calendar as CalendarIcon,
  Users,
} from "lucide-react";
import { api } from "@/lib/trpc/client";
import { DatePicker } from "@/components/date-picker";
// import { UserList } from "@/components/user-list";
import { toast } from "@/components/ui/use-toast";
import { UserListCheckIns } from "@/components/user-list-checkins";

interface HistoryItem {
  check_in_date: string;
  check_in_count: number;
}

interface CheckIn {
  id: string;
  userId: string;
  checkInDate: string;
  checkedInAt: string;
  notes: string | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export default function CheckInsPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [teamLoaded, setTeamLoaded] = useState(false);

  const formattedDate = format(selectedDate, "yyyy-MM-dd");

  const { data: teamData, isLoading: teamLoading } =
    api.teams.getBySlug.useQuery(
      { slug },
      {
        onError: (error) => {
          toast({
            title: "Error",
            description: "Team not found or you don't have access.",
            variant: "destructive",
          });
          router.push("/");
        },
      }
    );
  const { team, teamMembers } = teamData || {};

  // Use the team id from the data
  const currentTeamId = team?.id || "";

  // Verify team access
  const { data: accessData } = api.teams.verifyAccess.useQuery(
    { teamId: team?.id || "" },
    {
      enabled: !!team?.id,
      onSuccess: (data) => {
        if (!data.hasAccess) {
          router.push(`/team/${slug}/join`);
        } else {
          setTeamLoaded(true);
        }
      },
      onError: () => {
        router.push(`/team/${slug}/join`);
      },
    }
  );

  // Get check-ins for the selected date
  const { data: checkIns, isLoading: checkInsLoading } =
    api.checkIns.getByTeamAndDate.useQuery(
      {
        teamId: currentTeamId,
        date: formattedDate,
      },
      {
        enabled: !!currentTeamId && teamLoaded,
        retry: false,
        onError: (error) => {
          toast({
            title: "Error",
            description: "Failed to get check-ins. Please refresh the page.",
            variant: "destructive",
          });
        },
      }
    );

  // Get daily history
  const { data: history, isLoading: historyLoading } =
    api.checkIns.getHistory.useQuery(
      {
        teamId: currentTeamId,
        limit: 30,
      },
      {
        enabled: !!currentTeamId && teamLoaded,
        retry: false,
        onError: (error) => {
          toast({
            title: "Error",
            description:
              "Failed to get check-in history. Please refresh the page.",
            variant: "destructive",
          });
        },
      }
    );

  const totalMembers = teamMembers?.length || 0;
  const checkedInCount = checkIns?.length || 0;

  const goBack = () => {
    router.push(`/team/${slug}`);
  };

  if (teamLoading || !teamLoaded) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!team) {
    return null;
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Daily Check-ins</h1>
        <Button
          variant="outline"
          onClick={() => router.push(`/team/${slug}/check-ins/history`)}
          className="flex items-center gap-2"
        >
          <Calendar className="h-4 w-4" />
          View History
        </Button>
      </div>

      <div className="space-y-6">
        {/* <CheckInButton teamId={team.id} /> */}
        {/* <CheckInStatusBar teamId={team.id} totalMembers={totalMembers} /> */}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              <span>Select Date</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DatePicker date={selectedDate} onDateChange={setSelectedDate} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span>Check-ins for {format(selectedDate, "MMMM d, yyyy")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkInsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : checkIns && checkIns.length > 0 ? (
              <UserListCheckIns
                checkIns={checkIns}
                onClose={() => {}}
                showTime
                teamId={team.id}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-1">No Check-ins</h3>
                <p className="max-w-sm mb-6">
                  No team members have checked in for this date yet.
                </p>

                {format(selectedDate, "yyyy-MM-dd") ===
                  format(new Date(), "yyyy-MM-dd") && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      document.getElementById("check-in-button")?.click()
                    }
                  >
                    Check In Now
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
