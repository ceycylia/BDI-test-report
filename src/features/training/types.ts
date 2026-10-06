export type TrainingSummary = {
  id: string;
  name: string;
  slug: string;
  bankId: string;
  bankName: string;
  questionCount: number;
  durationMinutes: number;
  passingScore: number;
  trainingStartDate: string;
  trainingEndDate: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED";
  scheduleStatus: "NOT_OPEN" | "ONGOING" | "FINISHED";
  trainingId: string;
  trainingName: string;
  materialId: string;
  materialName: string;
  cohorts: Array<{ id: string; name: string }>;
};

export type TrainingDetail = TrainingSummary & {
  availableQuestionCount: number;
  pre: ScheduleSetting;
  post: ScheduleSetting;
};

export type ScheduleSetting = {
  mode: "MANUAL" | "SCHEDULED";
  startAt: string | null;
  endAt: string | null;
  manualOpen: boolean;
};

export type TrainingBatch = {
  id: string;
  number: number;
  name: string;
  questionCount: number;
};

export type TrainingPackage = {
  batchId: string;
  batchNumber: number;
  batchName: string;
  questionIds: string[];
  layoutCount: number;
};

export type PackageOverlap = {
  leftBatchId: string;
  rightBatchId: string;
  count: number;
};
