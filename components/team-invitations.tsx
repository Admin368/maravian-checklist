"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Icons } from "@/components/icons";
import { UserPlus, Mail, Clock, CheckCircle } from "lucide-react";

const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface TeamInvitationsProps {
  teamId: string;
  teamName: string;
  userRole: string;
}

export function TeamInvitations({
  teamId,
  teamName,
  userRole,
}: TeamInvitationsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const utils = api.useUtils();

  const isAdmin = userRole === "admin" || userRole === "owner";

  // Fetch team invitations
  const { data: invitations, isLoading: isLoadingInvitations } =
    api.teams.getInvitations.useQuery({ teamId }, { enabled: isAdmin });

  // Send invitation mutation
  const sendInvitation = api.teams.inviteByEmail.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent successfully!");
      setIsDialogOpen(false);
      reset();
      utils.teams.getInvitations.invalidate({ teamId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
  });

  const onSubmit = (data: InviteFormData) => {
    sendInvitation.mutate({
      teamId,
      email: data.email,
    });
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Team Invitations
        </CardTitle>
        <CardDescription>
          Invite new members to {teamName} by email
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Mail className="mr-2 h-4 w-4" />
              Invite by Email
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite User by Email</DialogTitle>
              <DialogDescription>
                Send an invitation link to the user's email address.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={sendInvitation.isLoading}
                  className="flex-1"
                >
                  {sendInvitation.isLoading && (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Send Invitation
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Pending Invitations */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Pending Invitations</h4>
          {isLoadingInvitations ? (
            <div className="flex items-center justify-center py-4">
              <Icons.spinner className="h-4 w-4 animate-spin" />
            </div>
          ) : invitations && invitations.length > 0 ? (
            <div className="space-y-2">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{invitation.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Invited by {invitation.inviter.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {invitation.acceptedAt ? (
                      <>
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        Accepted
                      </>
                    ) : invitation.expiresAt < new Date() ? (
                      <>
                        <Clock className="h-3 w-3 text-red-600" />
                        Expired
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" />
                        Pending
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No pending invitations
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
