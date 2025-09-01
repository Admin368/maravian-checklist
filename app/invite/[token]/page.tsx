"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isAccepting, setIsAccepting] = useState(false);

  const token = params.token as string;

  const acceptInvitation = api.teams.acceptInvitation.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      router.push(`/team/${data.team.slug}`);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsAccepting(false);
    },
  });

  const handleAcceptInvitation = async () => {
    if (!session) {
      toast.error("Please sign in to accept the invitation");
      return;
    }

    setIsAccepting(true);
    acceptInvitation.mutate({ token });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Team Invitation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              You need to sign in to accept this team invitation.
            </p>
            <div className="space-y-2">
              <Button asChild className="w-full">
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(
                    `/invite/${token}`
                  )}`}
                >
                  Sign In
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link
                  href={`/register?callbackUrl=${encodeURIComponent(
                    `/invite/${token}`
                  )}`}
                >
                  Create Account
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Team Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            You've been invited to join a team. Click the button below to accept
            the invitation.
          </p>
          <Button
            onClick={handleAcceptInvitation}
            disabled={isAccepting}
            className="w-full"
          >
            {isAccepting && (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            )}
            Accept Invitation
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            This invitation may expire after some time.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
