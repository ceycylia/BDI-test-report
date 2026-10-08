import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { ProtectedAdminRoute } from "../features/admin-auth/ProtectedAdminRoute";
import { AdminLayout } from "../layouts/AdminLayout";
const AdminFoundationPage = lazy(() => import("../pages/admin/AdminFoundationPage").then((m) => ({ default: m.AdminFoundationPage })));
const AdminLoginFoundationPage = lazy(() => import("../pages/admin/AdminLoginFoundationPage").then((m) => ({ default: m.AdminLoginFoundationPage })));
const AdminManagementPage = lazy(() => import("../pages/admin/AdminManagementPage").then((m) => ({ default: m.AdminManagementPage })));
const AdminAccountPage = lazy(() => import("../pages/admin/AdminAccountPage").then((m) => ({ default: m.AdminAccountPage })));
const QuestionBankDetailPage = lazy(() => import("../pages/admin/QuestionBankDetailPage").then((m) => ({ default: m.QuestionBankDetailPage })));
const QuestionBankListPage = lazy(() => import("../pages/admin/QuestionBankListPage").then((m) => ({ default: m.QuestionBankListPage })));
const QuestionImportPage = lazy(() => import("../pages/admin/QuestionImportPage").then((m) => ({ default: m.QuestionImportPage })));
const TrainingCreatePage = lazy(() => import("../pages/admin/TrainingCreatePage").then((m) => ({ default: m.TrainingCreatePage })));
const TrainingDetailPage = lazy(() => import("../pages/admin/TrainingDetailPage").then((m) => ({ default: m.TrainingDetailPage })));
const TrainingListPage = lazy(() => import("../pages/admin/TrainingListPage").then((m) => ({ default: m.TrainingListPage })));
const ResultsPage = lazy(() => import("../pages/admin/ResultsPage").then((m) => ({ default: m.ResultsPage })));
const ParticipantResultDetailPage = lazy(() => import("../pages/admin/ParticipantResultDetailPage").then((m) => ({ default: m.ParticipantResultDetailPage })));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));
const PublicHomePage = lazy(() => import("../pages/participant/PublicHomePage").then((m) => ({ default: m.PublicHomePage })));
const TrainingEntryFoundationPage = lazy(() => import("../pages/participant/TrainingEntryFoundationPage").then((m) => ({ default: m.TrainingEntryFoundationPage })));
const AttemptPage = lazy(() => import("../pages/participant/AttemptPage").then((m) => ({ default: m.AttemptPage })));
const ParticipantsPage = lazy(() => import("../pages/admin/ParticipantsPage").then((m) => ({ default: m.ParticipantsPage })));
const TrainingCatalogPage = lazy(() => import("../pages/admin/TrainingCatalogPage").then((m) => ({ default: m.TrainingCatalogPage })));
const SurveyTemplateDetailPage = lazy(() => import("../pages/admin/SurveyTemplateDetailPage").then((m) => ({ default: m.SurveyTemplateDetailPage })));
const EvaluationPage = lazy(() => import("../pages/admin/EvaluationPage").then((m) => ({ default: m.EvaluationPage })));
const EvaluationDetailPage = lazy(() => import("../pages/admin/EvaluationDetailPage").then((m) => ({ default: m.EvaluationDetailPage })));
const EvaluationParticipantPage = lazy(() => import("../pages/participant/EvaluationParticipantPage").then((m) => ({ default: m.EvaluationParticipantPage })));

export function AppRouter() {
  return <Suspense fallback={<div className="route-loading" role="status">Memuat halaman…</div>}>
    <Routes>
      <Route path="/" element={<PublicHomePage />} />
      <Route path="/t/:slug" element={<TrainingEntryFoundationPage />} />
      <Route path="/t/:slug/attempt/:attemptId" element={<AttemptPage />} />
      <Route path="/e/:slug" element={<EvaluationParticipantPage />} />
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

          <Route path="evaluasi" element={<EvaluationPage />} />
          <Route
            path="evaluasi/template/:templateId"
            element={<SurveyTemplateDetailPage />}
          />
          <Route
            path="evaluasi/pelaksanaan/:campaignId"
            element={<EvaluationDetailPage />}
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
  </Suspense>;
}
