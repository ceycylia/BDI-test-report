import { describe, expect, it } from "vitest";
import masterMigration from "../migrations/0003_training_participants_certificates.sql?raw";
import identityMigration from "../migrations/0004_participant_exam_identity.sql?raw";
import softDeleteMigration from "../migrations/0005_soft_delete_trainings.sql?raw";

describe("relasi master data", () => {
  it("mengikat materi ke pelatihan dan satu bank aktif ke satu materi", () => {
    expect(masterMigration).toContain("FOREIGN KEY (training_id) REFERENCES trainings(id)");
    expect(masterMigration).toMatch(/CREATE UNIQUE INDEX one_active_bank_per_material[\s\S]*WHERE is_active = 1/iu);
  });

  it("mencegah NIK ganda dalam angkatan tetapi mengizinkan nama yang sama", () => {
    expect(masterMigration).toContain("UNIQUE (cohort_id, nik)");
    expect(identityMigration).toContain("UNIQUE (profile_id, batch_id)");
    expect(identityMigration).not.toContain("UNIQUE (batch_id, normalized_name)");
  });

  it("menghapus pelatihan secara logis agar data historis tetap utuh", () => {
    expect(softDeleteMigration).toContain("is_deleted INTEGER NOT NULL DEFAULT 0");
    expect(softDeleteMigration).not.toContain("DELETE FROM trainings");
  });
});

describe("riwayat reset dan sertifikat", () => {
  it("menyimpan attempt reset beserta admin, waktu, dan alasan", () => {
    expect(masterMigration).toContain("reset_by_admin_id TEXT");
    expect(masterMigration).toContain("reset_at TEXT");
    expect(masterMigration).toContain("reset_reason TEXT");
    expect(masterMigration).toContain("status = 'RESET'");
  });

  it("mengikat sertifikat ke profil, pelatihan, dan angkatan", () => {
    expect(masterMigration).toContain("FOREIGN KEY (participant_profile_id) REFERENCES participant_profiles(id)");
    expect(masterMigration).toContain("FOREIGN KEY (training_id) REFERENCES trainings(id)");
    expect(masterMigration).toContain("FOREIGN KEY (cohort_id) REFERENCES training_cohorts(id)");
  });
});
