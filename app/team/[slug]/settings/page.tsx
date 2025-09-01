"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/trpc/client";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Save,
  Trash2,
  Users,
  Calendar,
  Key,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { TeamNotificationSettings } from "@/components/team-notification-settings";
import { TeamDefaultNotificationSettings } from "@/components/team-default-notification-settings";
import { TeamInvitations } from "@/components/team-invitations";

export default function TeamSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [teamName, setTeamName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCloneable, setIsCloneable] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const { data: teamData, isLoading } = api.teams.getBySlug.useQuery(
    { slug },
    {
      onSuccess: (data) => {
        if (data?.team) {
          setTeamName(data.team.name);
          setIsPrivate(data.team.isPrivate || false);
          setIsCloneable(data.team.isCloneable || false);
        }
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Team not found or you don't have access.",
          variant: "destructive",
        });
        router.push("/");
      },
    }
  );

  const updateTeam = api.teams.update.useMutation({
    onSuccess: () => {
      toast({
        title: "Team updated",
        description: "Team settings have been updated successfully.",
      });
      setIsSubmitting(false);
      // If name changed, redirect to new slug
      if (teamName !== teamData?.team?.name) {
        router.refresh();
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update team",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const deleteTeam = api.teams.delete.useMutation({
    onSuccess: () => {
      toast({
        title: "Team deleted",
        description: "Team has been deleted successfully.",
      });
      router.push("/");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete team",
        variant: "destructive",
      });
      setIsDeleting(false);
    },
  });

  const updateTeamPassword = api.teams.updatePassword.useMutation({
    onSuccess: () => {
      toast({
        title: "Password updated",
        description: "Team password has been changed successfully.",
      });
      // Clear the form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsChangingPassword(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update team password",
        variant: "destructive",
      });
      setIsChangingPassword(false);
    },
  });

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamData?.team) return;

    setIsSubmitting(true);
    await updateTeam.mutateAsync({
      teamId: teamData.team.id,
      name: teamName,
      isPrivate,
      isCloneable,
    });
  };

  const handleDeleteTeam = async () => {
    if (!teamData?.team) return;

    setIsDeleting(true);
    await deleteTeam.mutateAsync({
      teamId: teamData.team.id,
    });
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamData?.team) return;

    // Validate passwords
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords don't match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 4) {
      toast({
        title: "Error",
        description: "Password must be at least 4 characters",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    await updateTeamPassword.mutateAsync({
      teamId: teamData.team.id,
      currentPassword: currentPassword || undefined,
      newPassword,
    });
  };

  // Check if user is admin
  const isAdmin = teamData?.teamMembers?.some(
    (member) => member.role === "admin" && member.id === userId
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need to be an admin to access team settings.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push(`/team/${slug}`)}>Back</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Team Settings</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Team Information</CardTitle>
            <CardDescription>Details about your team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center">
                  <Key className="h-4 w-4 mr-2 text-muted-foreground" />
                  <h3 className="font-medium">Team ID</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {teamData?.team?.id}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                  <h3 className="font-medium">Created</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {teamData?.team?.createdAt
                    ? format(new Date(teamData.team.createdAt), "PPP")
                    : "Unknown"}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                  <h3 className="font-medium">Members</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {teamData?.teamMembers?.length || 0} members
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>
              {`Manage your team's basic information.`}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdateTeam}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter team name"
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="private-mode"
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                />
                <Label htmlFor="private-mode">
                  Private Team (hidden from home page)
                </Label>
              </div>

              <div className="flex items-center space-x-2 mt-4">
                <Switch
                  id="cloneable-mode"
                  checked={isCloneable}
                  onCheckedChange={setIsCloneable}
                />
                <Label htmlFor="cloneable-mode">Allow team cloning</Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {`When enabled, members can clone this team to create their own version with all tasks intact.`}
              </p>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {teamData?.team && (
          <>
            {/* Individual User's Team Notification Preferences */}
            <TeamNotificationSettings
              teamId={teamData.team.id}
              teamName={teamData.team.name}
            />

            {/* Admin-only sections */}
            {teamData.teamMembers.find((member) => member.id === userId)
              ?.role &&
              ["admin", "owner"].includes(
                teamData.teamMembers.find((member) => member.id === userId)
                  ?.role || ""
              ) && (
                <>
                  {/* Team Default Notification Settings */}
                  <TeamDefaultNotificationSettings
                    teamId={teamData.team.id}
                    teamName={teamData.team.name}
                    userRole={
                      teamData.teamMembers.find(
                        (member) => member.id === userId
                      )?.role || ""
                    }
                  />

                  {/* Team Invitations */}
                  <TeamInvitations
                    teamId={teamData.team.id}
                    teamName={teamData.team.name}
                    userRole={
                      teamData.teamMembers.find(
                        (member) => member.id === userId
                      )?.role || ""
                    }
                  />
                </>
              )}
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Change Team Password</CardTitle>
            <CardDescription>
              Update the password that members use to join your team
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdatePassword}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {showCurrentPassword ? "Hide password" : "Show password"}
                    </span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  As a team admin, you can leave this blank to skip verification
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    minLength={4}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {showNewPassword ? "Hide password" : "Show password"}
                    </span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Password must be at least 4 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Change Password
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              These actions cannot be undone. Be careful.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Team
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    the team and all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive"
                    onClick={handleDeleteTeam}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
