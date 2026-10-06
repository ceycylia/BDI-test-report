export type QuestionBankSummary = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  activeQuestionCount: number;
  inactiveQuestionCount: number;
  createdAt: string;
  updatedAt: string;
  materialId: string | null;
  materialName: string | null;
  trainingId: string | null;
  trainingName: string | null;
};

export type QuestionBank = Omit<
  QuestionBankSummary,
  "activeQuestionCount" | "inactiveQuestionCount"
>;

export type Question = {
  id: string;
  bankId: string;
  questionText: string;
  imageKey: string | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOptionKey: "A" | "B" | "C" | "D";
  isActive: boolean;
  timesAssigned: number;
  createdAt: string;
  updatedAt: string;
};

export type QuestionInput = Omit<
  Question,
  "id" | "bankId" | "isActive" | "timesAssigned" | "createdAt" | "updatedAt"
>;
