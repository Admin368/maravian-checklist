"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TaskItem } from "@/components/task-item";
import { TaskDialog } from "@/components/task-dialog";
import { api } from "@/lib/trpc/client";
import { ArrowLeft, Play, Pause, RotateCcw, Timer, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
// import { formatTime } from "@/lib/utils";
import { toast } from "sonner";
import { TaskList } from "./task-list";

interface TaskFocusModeProps {
  taskId: string;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function TaskFocusMode({ taskId }: TaskFocusModeProps) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0); // Time in seconds
  const [timerMode, setTimerMode] = useState<"stopwatch" | "countdown">(
    "stopwatch"
  );
  const [countdownTime, setCountdownTime] = useState(25 * 60); // 25 minutes in seconds
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("25");
  const [seconds, setSeconds] = useState("0");

  // Fetch task data
  const {
    data: taskData,
    isLoading,
    refetch,
  } = api.tasks.getById.useQuery(
    { taskId },
    {
      enabled: !!taskId,
    }
  );

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning) {
      interval = setInterval(() => {
        if (timerMode === "stopwatch") {
          setTime((prevTime) => prevTime + 1);
        } else {
          setTime((prevTime) => {
            if (prevTime <= 0) {
              setIsRunning(false);
              toast.info("Time's up!", {
                description: "Your countdown timer has finished.",
              });
              return 0;
            }
            return prevTime - 1;
          });
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, timerMode]);

  // Update countdown time when input values change
  const updateCountdownTime = () => {
    const totalSeconds =
      parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
    setCountdownTime(totalSeconds);
    setTime(totalSeconds);
  };

  const handleTimeInput = (value: string, setter: (value: string) => void) => {
    const numValue = value === "" ? "0" : value.replace(/[^\d]/g, "");
    setter(numValue);
  };

  const handleStartPause = () => {
    if (timerMode === "countdown" && !isRunning && time === 0) {
      setTime(countdownTime);
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTime(timerMode === "countdown" ? countdownTime : 0);
  };

  const handleModeToggle = () => {
    setIsRunning(false);
    setTimerMode((prev) => (prev === "stopwatch" ? "countdown" : "stopwatch"));
    if (timerMode === "stopwatch") {
      updateCountdownTime();
    } else {
      setTime(0);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!taskData) {
    return <div>Task not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold truncate">Return to Team</h1>
      </div>

      {/* Timer Card */}
      <Card className="p-6">
        <div className="flex flex-col items-center space-y-4">
          {timerMode === "countdown" && !isRunning && (
            <div className="flex gap-2 items-center mb-4">
              <div className="flex flex-col items-center">
                <Input
                  type="text"
                  value={hours}
                  onChange={(e) => handleTimeInput(e.target.value, setHours)}
                  className="w-16 text-center"
                  maxLength={2}
                />
                <span className="text-sm text-muted-foreground">Hours</span>
              </div>
              <span className="text-2xl">:</span>
              <div className="flex flex-col items-center">
                <Input
                  type="text"
                  value={minutes}
                  onChange={(e) => handleTimeInput(e.target.value, setMinutes)}
                  className="w-16 text-center"
                  maxLength={2}
                />
                <span className="text-sm text-muted-foreground">Minutes</span>
              </div>
              <span className="text-2xl">:</span>
              <div className="flex flex-col items-center">
                <Input
                  type="text"
                  value={seconds}
                  onChange={(e) => handleTimeInput(e.target.value, setSeconds)}
                  className="w-16 text-center"
                  maxLength={2}
                />
                <span className="text-sm text-muted-foreground">Seconds</span>
              </div>
              <Button
                variant="outline"
                onClick={updateCountdownTime}
                className="ml-2"
              >
                Set Time
              </Button>
            </div>
          )}
          <div className="text-6xl font-mono tabular-nums">
            {formatTime(time)}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant={isRunning ? "destructive" : "default"}
              size="lg"
              onClick={handleStartPause}
              className="min-w-[120px]"
            >
              {isRunning ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleReset}
              className="min-w-[120px]"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleModeToggle}
              className="min-w-[120px]"
            >
              <Timer className="mr-2 h-4 w-4" />
              {timerMode === "stopwatch" ? "Countdown" : "Stopwatch"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Task Details */}
      <div className="space-y-4">
        <h1 className="text-2xl font-bold truncate">Task: {taskData.title}</h1>
        <TaskList
          teamId={taskData.teamId!}
          // teamName={"Task: " + taskData.title}
          teamName={""}
          isAdmin={false}
          focusOnTask={taskData}
        />
      </div>
    </div>
  );
}
