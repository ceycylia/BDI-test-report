import { adminDownload, adminMutation } from "../admin-auth/admin-api";
import { buildCertificatePrintArchive } from "../../../worker/domain/certificates/download";

const PARTICIPANTS_PER_REQUEST = 5;

type CertificateDownloadPlan = {
  participantIds: string[];
};

async function pdfBytes(path: string, body: Record<string, unknown>) {
  const blob = await adminDownload(path, {
    method: "POST",
    headers: { Accept: "application/pdf" },
    body: JSON.stringify(body),
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function prepareCertificatePrintArchive(trainingId: string, cohortId: string) {
  const plan = await adminMutation<CertificateDownloadPlan>(
    "/api/admin/participants/certificates/download-plan",
    { method: "POST", body: JSON.stringify({ trainingId, cohortId }) },
  );

  const frontParts: Uint8Array[] = [];
  for (let index = 0; index < plan.participantIds.length; index += PARTICIPANTS_PER_REQUEST) {
    const participantIds = plan.participantIds.slice(index, index + PARTICIPANTS_PER_REQUEST);
    frontParts.push(await pdfBytes(
      "/api/admin/participants/certificates/download-fronts",
      { trainingId, cohortId, participantIds },
    ));
  }

  const back = await pdfBytes(
    "/api/admin/participants/certificates/download-back",
    { trainingId, cohortId, participantId: plan.participantIds[0] },
  );
  return buildCertificatePrintArchive(frontParts, back);
}
