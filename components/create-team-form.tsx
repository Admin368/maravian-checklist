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
import { Label } from "@/components/ui/label";
import { api } from "@/lib/trpc/client";
import {
  Loader2,
  Bell,
  Mail,
  UserPlus,
  CheckSquare,
  Calendar,
  Plus,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useSession } from "next-auth/react";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export function CreateTeamForm() {
  const router = useRouter();
  const { data: session } = useSession();
  const [teamName, setTeamName] = useState("");
  const [password, setPassword] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCloneable, setIsCloneable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notification default settings for the team
  const [notificationOnInvitation, setNotificationOnInvitation] =
    useState(true);
  const [notificationOnAssignment, setNotificationOnAssignment] =
    useState(true);
  const [notificationOnTaskCompletion, setNotificationOnTaskCompletion] =
    useState(true);
  const [notificationOnCheckin, setNotificationOnCheckin] = useState(true);
  const [notificationOnNewTasks, setNotificationOnNewTasks] = useState(false);

  // Redirect to login if not authenticated
  if (!session) {
    router.push("/login");
    return null;
  }

  const createTeam = api.teams.create.useMutation({
    onSuccess: (team) => {
      toast({
        title: "Team created",
        description: `${team.name} has been created successfully`,
      });
      router.push(`/team/${team.slug}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create team",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teamName.trim()) {
      toast({
        title: "Error",
        description: "Team name is required",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 4) {
      toast({
        title: "Error",
        description: "Password must be at least 4 characters",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await createTeam.mutateAsync({
        name: teamName,
        password,
        isPrivate,
        isCloneable,
        notificationOnInvitation,
        notificationOnAssignment,
        notificationOnTaskCompletion,
        notificationOnCheckin,
        notificationOnNewTasks,
      });
    } catch (error) {
      // Error is handled in the mutation
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create a New Checklist</CardTitle>
        <CardDescription>Set up a new checklist for your tasks</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Checklist Name</Label>
            <Input
              id="team-name"
              placeholder="Enter checklist name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Set a password for your team"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
            />
            <p className="text-xs text-muted-foreground">
              This password will be used by team members to join your checklist.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="private-mode"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
              <Label htmlFor="private-mode">
                Private Checklist (hidden from home page)
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {`Private teams won't be listed on the home page and can only be
              joined with a direct invite link.`}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="cloneable-mode"
                checked={isCloneable}
                onCheckedChange={setIsCloneable}
              />
              <Label htmlFor="cloneable-mode">Allow checklist cloning</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {`When enabled, members can clone this checklist to create their own version with all tasks intact.`}
            </p>
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-base font-medium flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Default Notification Settings
              </Label>
              <p className="text-sm text-muted-foreground">
                Set the default notification preferences for team members.
                Members can override these settings individually.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <UserPlus className="h-3 w-3" />
                    Team Invitations
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Notify when members are invited
                  </p>
                </div>
                <Switch
                  checked={notificationOnInvitation}
                  onCheckedChange={setNotificationOnInvitation}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-3 w-3" />
                    Task Assignments
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Notify when tasks are assigned
                  </p>
                </div>
                <Switch
                  checked={notificationOnAssignment}
                  onCheckedChange={setNotificationOnAssignment}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <CheckSquare className="h-3 w-3" />
                    Task Completions
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Notify when tasks are completed
                  </p>
                </div>
                <Switch
                  checked={notificationOnTaskCompletion}
                  onCheckedChange={setNotificationOnTaskCompletion}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    Team Check-ins
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Notify when members check in
                  </p>
                </div>
                <Switch
                  checked={notificationOnCheckin}
                  onCheckedChange={setNotificationOnCheckin}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Plus className="h-3 w-3" />
                    New Tasks
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Notify when new tasks are created
                  </p>
                </div>
                <Switch
                  checked={notificationOnNewTasks}
                  onCheckedChange={setNotificationOnNewTasks}
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Checklist"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
