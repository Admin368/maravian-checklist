"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/trpc/client";
import { Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CloneTeamButtonProps {
  teamId: string;
  teamName: string;
  isCloneable: boolean;
}

export function CloneTeamButton({
  teamId,
  teamName,
  isCloneable,
}: CloneTeamButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState(`${teamName} (Clone)`);
  const [password, setPassword] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    teamName?: string;
    password?: string;
    general?: string;
  }>({});

  const cloneTeamMutation = api.teams.cloneTeam.useMutation({
    onSuccess: (team) => {
      toast.success("Team cloned", {
        description: `${team.name} has been created successfully`,
      });
      setIsOpen(false);
      router.push(`/team/${team.slug}`);
    },
    onError: (error) => {
      setIsSubmitting(false);

      // Handle specific error types
      if (error.data?.code === "CONFLICT") {
        setErrors({
          ...errors,
          teamName: error.message || "Team name already exists",
        });
        toast.error("Team name conflict", {
          description:
            error.message ||
            "Team name already exists. Please choose a different name.",
        });
        return;
      }

      if (error.data?.code === "FORBIDDEN") {
        setErrors({
          ...errors,
          general:
            error.message || "You don't have permission to clone this team",
        });
        toast.error("Permission error", {
          description:
            error.message || "You don't have permission to clone this team",
        });
        return;
      }

      // Generic error handling
      setErrors({
        ...errors,
        general:
          "An error occurred while cloning the team. Please try again later.",
      });
      toast.error("Error", {
        description:
          error.message || "Failed to clone team. Please try again later.",
      });
      console.error("Clone team error:", error);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset errors
    setErrors({});

    // Validate input
    let hasErrors = false;
    const newErrors: {
      teamName?: string;
      password?: string;
      general?: string;
    } = {};

    if (!newTeamName.trim()) {
      newErrors.teamName = "Team name is required";
      hasErrors = true;
    }

    if (password.length < 4) {
      newErrors.password = "Password must be at least 4 characters";
      hasErrors = true;
    }

    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await cloneTeamMutation.mutateAsync({
        teamId,
        newTeamName: newTeamName.trim(),
        newTeamPassword: password,
        isPrivate,
      });
    } catch (error) {
      // Error handled in the mutation onError callback
    }
  };

  const handleClose = (open: boolean) => {
    // If dialog is closing and not submitting, reset form
    if (!open && !isSubmitting) {
      setErrors({});
    }
    // Only allow dialog to be opened, not closed during submission
    if (open || !isSubmitting) {
      setIsOpen(open);
    }
  };

  if (!isCloneable) {
    return (
      <Button variant="outline" className="w-full" disabled>
        <Copy className="mr-2 h-4 w-4" />
        Cloning Disabled
      </Button>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            console.log("Clone button clicked");
            setIsOpen(true);
          }}
        >
          <Copy className="mr-2 h-4 w-4" />
          Make own copy of this checklist
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Clone Checklist</DialogTitle>
          <DialogDescription>
            Create a new checklist with all tasks from {teamName}
          </DialogDescription>
        </DialogHeader>
        {errors.general && (
          <Alert variant="destructive" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{errors.general}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="team-name">New Checklist Name</Label>
              <Input
                id="team-name"
                value={newTeamName}
                onChange={(e) => {
                  setNewTeamName(e.target.value);
                  setErrors({ ...errors, teamName: undefined });
                }}
                placeholder="Enter checklist name"
                required
                className={errors.teamName ? "border-red-500" : ""}
              />
              {errors.teamName && (
                <p className="text-sm text-red-500">{errors.teamName}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors({ ...errors, password: undefined });
                }}
                placeholder="Set a password for your checklist"
                required
                minLength={4}
                className={errors.password ? "border-red-500" : ""}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password}</p>
              )}
              <p className="text-xs text-muted-foreground">
                This password will be used by team members to join your
                checklist.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="private-mode"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
              <Label htmlFor="private-mode">Private Team</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                console.log("Cancel button clicked");
                setIsOpen(false);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cloning...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Create Clone
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
