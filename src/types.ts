export type RoutineType = 'work' | 'leisure' | 'habit' | 'rest';

export interface Task {
  id: string;
  userId: string;
  title: string; // May be encrypted if E2E is enabled
  notes: string; // May be encrypted if E2E is enabled
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  routine: RoutineType;
  completed: boolean;
  date: string; // YYYY-MM-DD
  createdAt: number;
  updatedAt: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  activityName: string;
  type: 'focus' | 'rest' | 'distraction';
  durationMinutes: number;
  timestamp: number;
  date: string; // YYYY-MM-DD
}

export interface UserSettings {
  userId: string;
  futureGoals: string;
  freeTimeRanges: string[]; // e.g. ["12:00-13:00", "17:00-19:00"]
  e2eEnabled: boolean;
  e2ePassword?: string; // Kept strictly locally
  emailReportEnabled: boolean;
  emailRecipient: string;
  theme: 'dark' | 'light';
  autoAIPlannerEnabled?: boolean;
}

export interface DailySummary {
  id: string; // YYYY-MM-DD
  userId: string;
  tasksCompleted: number;
  totalTasks: number;
  focusMinutes: number;
  restMinutes: number;
  distractionMinutes: number;
  moodQuote: string; // AI generated personalized motivation
  date: string;
}

export interface MonthlyEvaluation {
  id: string; // YYYY-MM
  userId: string;
  monthString: string; // "Mei 2026"
  productivityScore: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  analyticsHtml?: string; // visual breakdown
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: string;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}
