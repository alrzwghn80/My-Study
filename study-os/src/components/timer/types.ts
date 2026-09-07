import type { IntervalType, SessionStatus } from "@/generated/prisma/enums";

export interface ActiveSessionData {
  id: string;
  status: SessionStatus;
  categoryId: string | null;
  focusSeconds: number;
  breakSeconds: number;
  startedAt: Date | null;
  lastHeartbeatAt: Date | null;
  createdAt: Date;
  intervals: { id: string; type: IntervalType; startedAt: Date }[];
}

export interface CategoryOption {
  id: string;
  name: string;
  color: string;
}
