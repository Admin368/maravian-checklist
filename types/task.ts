export interface Task {
  id: string;
  title: string;
  parentId: string | null;
  position: number;
  teamId: string | null;
  isDeleted: boolean;
  createdAt: Date | null;
  type: string;
  visibility: string;
  deadline?: Date | null;
  time?: string | null;
  assignments: { userId: string }[];
}

export enum TaskType {
  DAILY = "daily",
  CHECKLIST = "checklist",
  ALL = "all",
}
