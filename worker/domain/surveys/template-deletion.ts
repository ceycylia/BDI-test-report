type SurveyTemplateDeletionInput = {
  campaignCount: number;
  responseCount?: number;
};

export function surveyTemplateDeletionPolicy({
  campaignCount,
  responseCount = 0,
}: SurveyTemplateDeletionInput) {
  if (responseCount > 0) {
    return {
      canDelete: false,
      reason: "Template tidak dapat dihapus karena memiliki riwayat respons peserta.",
    };
  }

  if (campaignCount > 0) {
    return {
      canDelete: false,
      reason: "Template tidak dapat dihapus karena memiliki riwayat Pelaksanaan Evaluasi.",
    };
  }

  return { canDelete: true, reason: null };
}
