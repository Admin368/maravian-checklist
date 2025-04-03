import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function TimePicker({
  disabled,
  initialTime,
  onChange,
}: {
  disabled?: boolean;
  initialTime?: string;
  onChange?: (time: string | undefined) => void;
}) {
  const [hours, setHours] = useState<number | undefined>(undefined);
  const [minutes, setMinutes] = useState<number | undefined>(undefined);

  const handleHoursChange = (value: number) => {
    if (value >= 0 && value <= 23) {
      setHours(value);
    }
  };

  const handleMinutesChange = (value: number) => {
    if (value >= 0 && value <= 59) {
      setMinutes(value);
    }
  };

  // Simplified conversion function
  const parseTime = (time24: string): { hours: string; minutes: string } => {
    const [hours, minutes] = time24.split(":");
    return { hours, minutes };
  };
  const formatTime = (number?: number) => {
    if (number === undefined) {
      return "";
    }
    const newNumber = number === 0 ? "00" : number < 10 ? `0${number}` : number;
    return newNumber;
  };

  useEffect(() => {
    if (initialTime) {
      const { hours, minutes } = parseTime(initialTime);
      setHours(parseInt(hours));
      setMinutes(parseInt(minutes));
    }
  }, [initialTime]);

  useEffect(() => {
    if (hours && minutes) {
      onChange?.(`${formatTime(hours)}:${formatTime(minutes)}`);
    } else {
      onChange?.(undefined);
    }
  }, [hours, minutes, onChange]);

  return (
    <div className="grid grid-cols-4 items-center gap-4">
      <span className="text-right">Time</span>
      <span className="col-span-3 flex gap-1 items-center w-full justify-between">
        <Input
          type="number"
          placeholder="00"
          value={formatTime(hours)}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "") {
              setHours(undefined);
            } else {
              let number = parseInt(value);
              // if greater than 100, delete the last digit no decimal
              if (number > 100) {
                number = Math.floor(number / 10);
              }
              // if number greater than 24, end at 24
              if (number > 24) {
                number = 23;
              }
              handleHoursChange(number);
            }
          }}
          className="text-center"
          disabled={disabled}
          min={0}
          max={24}
          maxLength={2}
        />
        <span className="text-lg font-medium select-none text-center w-10">
          :
        </span>
        <Input
          type="number"
          placeholder="00"
          value={formatTime(minutes)}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "") {
              setMinutes(undefined);
            } else {
              let number = parseInt(value);
              // if greater than 100, delete the last digit no decimal
              if (number > 100) {
                number = Math.floor(number / 10);
              }
              // if number greater than 60, end at 60
              if (number > 60) {
                number = 59;
              }
              handleMinutesChange(number);
            }
          }}
          className="text-center"
          disabled={disabled}
          min={-1}
          max={59}
          maxLength={2}
        />
        <span className="flex items-center justify-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={() => {
              setHours(undefined);
              setMinutes(undefined);
            }}
            disabled={
              disabled || (hours === undefined && minutes === undefined)
            }
          >
            <X className="h-4 w-4" />
          </Button>
        </span>
      </span>
    </div>
  );
}
