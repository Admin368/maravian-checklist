"use client";

import { useEffect, useState, useRef } from "react";
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
import { TaskType } from "@/types/task";

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
  const [isAlarmOn, setIsAlarmOn] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

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

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new AudioContext();
    return () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
      }
    };
  }, []);

  const playAlarm = () => {
    if (!audioContextRef.current) return;

    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    const lfo = audioContextRef.current.createOscillator();
    const lfoGain = audioContextRef.current.createGain();

    // Connect the audio nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);
    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain);

    // Set up the main tone
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(
      200,
      audioContextRef.current.currentTime
    ); // A4 note

    // Set up the LFO for beeping effect
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.5, audioContextRef.current.currentTime); // 2 beeps per second
    lfoGain.gain.setValueAtTime(0.1, audioContextRef.current.currentTime); // Moderate modulation
    gainNode.gain.setValueAtTime(0.01, audioContextRef.current.currentTime); // Lower overall volume

    // Start both oscillators
    oscillator.start();
    lfo.start();

    // Store oscillator to stop it later
    oscillatorRef.current = oscillator;
  };

  const stopAlarm = () => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current = null;
    }
  };

  useEffect(() => {
    if (isAlarmOn) {
      playAlarm();
    } else {
      stopAlarm();
    }
  }, [isAlarmOn]);

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
              setIsAlarmOn(true);
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

    return () => {
      clearInterval(interval);
      setIsAlarmOn(false);
    };
  }, [isRunning, timerMode]);

  // Update countdown time when input values change
  const updateCountdownTime = () => {
    const totalSeconds =
      parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
    setCountdownTime(totalSeconds);
    setTime(totalSeconds);
  };

  const handleTimeInput = (value: string, setter: (value: string) => void) => {
    console.log(value);
    //if value is 3 digits and first is 0, remove the 0
    let numValue = value;
    if (value.length === 3) {
      numValue = value.slice(1);
    }
    numValue = numValue === "" ? "0" : numValue.replace(/[^\d]/g, "");
    setter(numValue);
  };

  const handleStartPause = () => {
    if (timerMode === "countdown" && !isRunning && time === 0) {
      setTime(countdownTime);
    }
    setIsAlarmOn(false);
    setIsRunning(!isRunning);
    // if (!isRunning && timerMode === "countdown" && time === 0) {
    //   setIsAlarmOn(true);
    // } else {
    //   setIsAlarmOn(false);
    // }
  };

  const handleReset = () => {
    setIsRunning(false);
    setTime(timerMode === "countdown" ? countdownTime : 0);
    setIsAlarmOn(false);
  };

  const handleModeToggle = () => {
    setIsRunning(false);
    setTimerMode((prev) => (prev === "stopwatch" ? "countdown" : "stopwatch"));
    if (timerMode === "stopwatch") {
      updateCountdownTime();
    } else {
      setTime(0);
    }
    setIsAlarmOn(false);
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
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-2 items-center mb-4 w-full max-w-sm mx-auto">
              <div className="grid grid-cols-3 gap-2 w-full sm:flex sm:items-center">
                <div className="flex flex-col items-center">
                  <Input
                    type="text"
                    value={hours}
                    onChange={(e) => handleTimeInput(e.target.value, setHours)}
                    className="w-full text-center h-12 text-lg"
                    maxLength={3}
                  />
                  <span className="text-sm text-muted-foreground mt-1">
                    Hours
                  </span>
                </div>
                {/* <span className="text-2xl self-start mt-3">:</span> */}
                <div className="flex flex-col items-center">
                  <Input
                    type="text"
                    value={minutes}
                    onChange={(e) =>
                      handleTimeInput(e.target.value, setMinutes)
                    }
                    className="w-full text-center h-12 text-lg"
                    maxLength={3}
                  />
                  <span className="text-sm text-muted-foreground mt-1">
                    Minutes
                  </span>
                </div>
                {/* <span className="text-2xl self-start mt-3">:</span> */}
                <div className="flex flex-col items-center">
                  <Input
                    type="text"
                    value={seconds}
                    onChange={(e) =>
                      handleTimeInput(e.target.value, setSeconds)
                    }
                    className="w-full text-center h-12 text-lg"
                    maxLength={3}
                  />
                  <span className="text-sm text-muted-foreground mt-1">
                    Seconds
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center h-full">
                <Button
                  variant="default"
                  onClick={updateCountdownTime}
                  className="w-full sm:w-auto"
                >
                  Set Time
                </Button>
                <span className="text-sm text-muted-foreground mt-1">
                  {`${hours}:${minutes}:${seconds}`}
                </span>
              </div>
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
          <div className="text-sm text-muted-foreground mt-1">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsAlarmOn(!isAlarmOn)}
              className={`
                ${
                  isAlarmOn
                    ? "animate-[blink_1s_ease-in-out_infinite]"
                    : "hidden"
                }`}
            >
              {isAlarmOn ? "Turn Alarm Off" : "Turn Alarm On"}
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
          // isAdmin={false}
          focusOnTask={taskData}
          taskType={TaskType.ALL}
        />
      </div>
    </div>
  );
}
