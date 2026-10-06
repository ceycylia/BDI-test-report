import { Route, Routes } from "react-router-dom";
import { ProtectedAdminRoute } from "../features/admin-auth/ProtectedAdminRoute";
import { AdminLayout } from "../layouts/AdminLayout";
import { AdminFoundationPage } from "../pages/admin/AdminFoundationPage";
import { AdminLoginFoundationPage } from "../pages/admin/AdminLoginFoundationPage";
import { AdminManagementPage } from "../pages/admin/AdminManagementPage";
import { AdminAccountPage } from "../pages/admin/AdminAccountPage";
import { QuestionBankDetailPage } from "../pages/admin/QuestionBankDetailPage";
import { QuestionBankListPage } from "../pages/admin/QuestionBankListPage";
import { QuestionImportPage } from "../pages/admin/QuestionImportPage";
import { TrainingCreatePage } from "../pages/admin/TrainingCreatePage";
import { TrainingDetailPage } from "../pages/admin/TrainingDetailPage";
import { TrainingListPage } from "../pages/admin/TrainingListPage";
import { ResultsPage } from "../pages/admin/ResultsPage";
import { ParticipantResultDetailPage } from "../pages/admin/ParticipantResultDetailPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PublicHomePage } from "../pages/participant/PublicHomePage";
import { TrainingEntryFoundationPage } from "../pages/participant/TrainingEntryFoundationPage";
import { AttemptPage } from "../pages/participant/AttemptPage";
import { ParticipantsPage } from "../pages/admin/ParticipantsPage";
import { TrainingCatalogPage } from "../pages/admin/TrainingCatalogPage";
import { SurveyTemplateListPage } from "../pages/admin/SurveyTemplateListPage";
import { SurveyTemplateDetailPage } from "../pages/admin/SurveyTemplateDetailPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<PublicHomePage />} />
      <Route path="/t/:slug" element={<TrainingEntryFoundationPage />} />
      <Route path="/t/:slug/attempt/:attemptId" element={<AttemptPage />} />
      <Route path="/admin/login" element={<AdminLoginFoundationPage />} />
      <Route element={<ProtectedAdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminFoundationPage />} />

          <Route path="admins" element={<AdminManagementPage />} />
          <Route path="akun" element={<AdminAccountPage />} />

          <Route path="bank-soal" element={<QuestionBankListPage />} />
          <Route
            path="bank-soal/:bankId"
            element={<QuestionBankDetailPage />}
          />
          <Route
            path="bank-soal/:bankId/import"
            element={<QuestionImportPage />}
          />

          <Route path="evaluasi" element={<SurveyTemplateListPage />} />
          <Route
            path="evaluasi/:templateId"
            element={<SurveyTemplateDetailPage />}
          />

          <Route path="pelatihan" element={<TrainingListPage />} />
          <Route path="master-pelatihan" element={<TrainingCatalogPage />} />
          <Route path="pelatihan/baru" element={<TrainingCreatePage />} />
          <Route path="pelatihan/:sessionId" element={<TrainingDetailPage />} />

          <Route path="hasil" element={<ResultsPage />} />
          <Route path="peserta" element={<ParticipantsPage />} />
          <Route
            path="hasil/:participantId"
            element={<ParticipantResultDetailPage />}
          />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
