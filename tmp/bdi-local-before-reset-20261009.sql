PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_initial.sql','2026-10-01 11:25:13');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'0002_admin_roles.sql','2026-10-01 11:25:14');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'0003_training_participants_certificates.sql','2026-10-01 11:25:15');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(4,'0004_participant_exam_identity.sql','2026-10-01 11:25:16');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(5,'0005_soft_delete_trainings.sql','2026-10-01 11:25:17');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(6,'0006_certificate_print_overlay.sql','2026-10-01 11:25:18');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(7,'0007_certificate_stamp_asset.sql','2026-10-01 11:25:19');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(8,'0008_certificate_issue_date.sql','2026-10-01 11:25:20');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(9,'0009_remove_training_description.sql','2026-10-01 11:44:12');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(10,'0011_allow_repeating_cohorts_by_year.sql','2026-10-06 04:26:16');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(11,'0013_add_surveys.sql','2026-10-06 04:33:17');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(12,'0014_add_survey_text_fields.sql','2026-10-06 06:39:33');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(13,'0015_add_survey_template_lifecycle.sql','2026-10-06 07:09:58');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(14,'0016_seed_training_evaluation_survey.sql','2026-10-06 07:12:59');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(15,'0017_fix_survey_question_text.sql','2026-10-06 07:18:10');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(16,'0010_global_certificate_settings.sql','2026-10-06 09:05:20');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(17,'0012_completion_letters.sql','2026-10-07 01:30:04');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(18,'0018_reconcile_cohort_year_to_start_date.sql','2026-10-07 01:33:45');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(19,'0019_add_survey_campaign_execution.sql','2026-10-07 01:33:46');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(20,'0020_add_training_material_unit_code.sql','2026-10-07 15:40:26');
CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL CHECK (password_iterations > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, role TEXT NOT NULL DEFAULT 'ADMIN'
CHECK (role IN ('SUPERADMIN', 'ADMIN')),
  UNIQUE (username)
) STRICT;
INSERT INTO "admins" ("id","name","username","password_hash","password_salt","password_iterations","is_active","created_at","updated_at","role") VALUES('5114ac1f-82c7-44b5-8b41-7c821f1056b1','admin','admin','eg1GH2x2VzvEiwmnj-xtiIGRWdGCMdD1OOAzZMDwpXw','6NMp3BRJfkrZXjS8uUgAfA',100000,1,'2026-10-01 11:26:09','2026-10-01 11:26:09','SUPERADMIN');
CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
) STRICT;
INSERT INTO "admin_sessions" ("id","admin_id","token_hash","csrf_token_hash","expires_at","last_seen_at","created_at") VALUES('6fe03e4d-4931-4537-a1ab-534ca144acdf','5114ac1f-82c7-44b5-8b41-7c821f1056b1','1Xh7xyKkhidOsIkXvOvkL3c4RDW4--OUEQsUDtsPZe0','wBpB5r4Ww-za_b4N3dQidnRCRFXSIeJl1Fpd5d-w40k','2026-10-01T19:27:49.318Z','2026-10-01 12:38:33','2026-10-01 11:27:49');
INSERT INTO "admin_sessions" ("id","admin_id","token_hash","csrf_token_hash","expires_at","last_seen_at","created_at") VALUES('5a29eb80-2fe7-4d42-9c39-fdf9d590caeb','5114ac1f-82c7-44b5-8b41-7c821f1056b1','DOLzgxHNnp92TLExwaE59_ifyzbqRQvEtB9Che8VYaM','mwJUsf4btyM7XTBixXcSPvW-oal7IjgK6m_CBGcDYEI','2026-10-02T06:58:26.058Z','2026-10-02 06:56:13','2026-10-01 22:58:26');
INSERT INTO "admin_sessions" ("id","admin_id","token_hash","csrf_token_hash","expires_at","last_seen_at","created_at") VALUES('3de4695f-46db-4b77-8f95-49fa624bde29','5114ac1f-82c7-44b5-8b41-7c821f1056b1','j6NfZIiqgHG0e2SiSiMbcRxF86ib8LukGJJQFz3Ochg','7ujNuvFI2Ysl2bPc6Y1ernnNEo4NwLOoOaOyIDyrOKs','2026-10-02T15:03:15.553Z','2026-10-02 07:58:09','2026-10-02 07:03:15');
INSERT INTO "admin_sessions" ("id","admin_id","token_hash","csrf_token_hash","expires_at","last_seen_at","created_at") VALUES('e319f290-40e7-443e-81ff-3ab8760b364f','5114ac1f-82c7-44b5-8b41-7c821f1056b1','t10v5rKxyJPY8SP3KM6y0_IK2rrzCArzaegifjvtKbQ','zQVQoiGE2VnzNyC1BPXVyI_y0fNNhkbySRQ0v2DUzvc','2026-10-05T10:13:08.312Z','2026-10-05 08:53:03','2026-10-05 02:13:08');
INSERT INTO "admin_sessions" ("id","admin_id","token_hash","csrf_token_hash","expires_at","last_seen_at","created_at") VALUES('47189803-d53e-4790-8ef8-68761fcb75c9','5114ac1f-82c7-44b5-8b41-7c821f1056b1','Obvpq7Ylrgs6LxGlPjEK2-NsGnzR27cbwreS9xlgHq0','nc2dDlcjBb_uGLsv9szIsl4kS5_qwDUqlHvkkY0nejo','2026-10-06T10:26:47.304Z','2026-10-06 09:07:28','2026-10-06 02:26:47');
INSERT INTO "admin_sessions" ("id","admin_id","token_hash","csrf_token_hash","expires_at","last_seen_at","created_at") VALUES('04c2fc2f-f4c7-4e2f-b773-76b24340899c','5114ac1f-82c7-44b5-8b41-7c821f1056b1','Oi-P0SGibJeCKYy5kndHOhvSPNQ8Mn9PCCW-mxFPRjk','BvTrwpLXVBhBdH-rew3VGwGZR-DK9EhCXAu34PGzOgM','2026-10-07T09:08:30.189Z','2026-10-07 03:22:40','2026-10-07 01:08:30');
INSERT INTO "admin_sessions" ("id","admin_id","token_hash","csrf_token_hash","expires_at","last_seen_at","created_at") VALUES('da664d67-a527-4260-89bf-b8e559c93cb4','5114ac1f-82c7-44b5-8b41-7c821f1056b1','7Gg-efR4pBsmnEIaNp_nrLVeOQKNUVbom2Z7PHyzVlg','A8Uo4eV-pInElAw3VwpmGEHjgs4LWdwcXK3DYLxr1io','2026-10-07T23:18:21.688Z','2026-10-07 23:10:23','2026-10-07 15:18:21');
INSERT INTO "admin_sessions" ("id","admin_id","token_hash","csrf_token_hash","expires_at","last_seen_at","created_at") VALUES('4476f816-6122-4427-88ba-4f41f77a73af','5114ac1f-82c7-44b5-8b41-7c821f1056b1','OPy4QXXQMPYXcvu_CJseeTE6gpjAX0t3u3YmT1vWnyQ','SUlgZ6KAlY8RkkwMUpZNjWHKbvgLS4YkGNJ3mhaKi6Y','2026-10-08T09:00:16.202Z','2026-10-08 06:57:29','2026-10-08 01:00:16');
INSERT INTO "admin_sessions" ("id","admin_id","token_hash","csrf_token_hash","expires_at","last_seen_at","created_at") VALUES('7238b66d-4f7f-4410-a8c9-7fc42befd8f7','5114ac1f-82c7-44b5-8b41-7c821f1056b1','Js-486cpJlTINiNLk3z3NzzZuiUOorPzg-z6AaCnyo0','o_cAuWzhG9DSXG5nSzceKBoOoYGTaE2z7H7cM6AGhNk','2026-10-08T09:53:24.700Z','2026-10-08 08:26:52','2026-10-08 01:53:24');
INSERT INTO "admin_sessions" ("id","admin_id","token_hash","csrf_token_hash","expires_at","last_seen_at","created_at") VALUES('c3288cda-74c7-4cbd-8bf8-74b4c353e4c7','5114ac1f-82c7-44b5-8b41-7c821f1056b1','oRIvV1u-pZY_y4hC5R2wgHYxl2axueqypuUCIuZ2MwY','kyfXegs-uhLjfm-y4kyQJZO8G6ByxIQZFvEwLXKSzJQ','2026-10-09T01:36:35.014Z','2026-10-08 17:59:48','2026-10-08 17:36:35');
CREATE TABLE question_banks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, material_id TEXT REFERENCES training_materials(id) ON DELETE RESTRICT) STRICT;
INSERT INTO "question_banks" ("id","name","description","is_active","created_at","updated_at","material_id") VALUES('99775b28-6e53-4988-bcc6-1c0361f66cab','Kelapa sawit',NULL,1,'2026-10-01 22:59:03','2026-10-05 04:13:26','5eefcd9c-3ff0-4e1b-bfcb-7fff8048e477');
INSERT INTO "question_banks" ("id","name","description","is_active","created_at","updated_at","material_id") VALUES('ac1187c3-08c4-46df-a475-4953a4d3274d','Pengoperasian Proses Kering Industri Crumb Rubber',NULL,1,'2026-10-07 15:30:54','2026-10-07 15:30:54','1ec66453-00f4-4f9a-93ff-c980c135c09c');
INSERT INTO "question_banks" ("id","name","description","is_active","created_at","updated_at","material_id") VALUES('69b7a39b-80e0-4bfc-932c-f4d309a468cf','Pengoperasian Proses Kering Industri Crumb Rubber',NULL,1,'2026-10-07 15:30:54','2026-10-07 15:30:54','3eafc746-5185-4814-9835-240f20ff5bde');
INSERT INTO "question_banks" ("id","name","description","is_active","created_at","updated_at","material_id") VALUES('f7a240bc-5b80-4c1b-8add-2a4bb3581f7b','Pengoperasian Proses Kering Industri Crumb Rubber',NULL,1,'2026-10-07 15:30:54','2026-10-07 15:30:54','7f395637-567e-49d3-b6d1-382f87447220');
INSERT INTO "question_banks" ("id","name","description","is_active","created_at","updated_at","material_id") VALUES('901dfa40-1f19-444e-8828-fef7f82de5d1','Pengoperasian Proses Kering Industri Crumb Rubber',NULL,1,'2026-10-07 15:30:54','2026-10-07 15:30:54','1b0e0e5f-1ceb-49f6-9c03-7cb3a79dfb65');
INSERT INTO "question_banks" ("id","name","description","is_active","created_at","updated_at","material_id") VALUES('cafb76fc-a276-4d1d-b512-c1392e5b41be','Pengoperasian Proses Kering Industri Crumb Rubber',NULL,1,'2026-10-07 15:30:54','2026-10-07 15:30:54','d4b00115-6426-4286-9b2b-22e7e45f85cf');
INSERT INTO "question_banks" ("id","name","description","is_active","created_at","updated_at","material_id") VALUES('60e4e6ba-6447-4137-bde3-6c32ec91ee11','Pengoperasian Proses Kering Industri Crumb Rubber',NULL,1,'2026-10-07 15:30:54','2026-10-07 15:30:54','09486ec9-6133-48fa-b718-a678bef5acd1');
INSERT INTO "question_banks" ("id","name","description","is_active","created_at","updated_at","material_id") VALUES('ab3ba0e8-8456-4fec-96d9-96bd45fdf5f3','Pengoperasian Proses Kering Industri Crumb Rubber',NULL,1,'2026-10-07 15:30:54','2026-10-07 15:30:54','8a34387c-b7ce-4e9e-81b2-ce92b083c95d');
INSERT INTO "question_banks" ("id","name","description","is_active","created_at","updated_at","material_id") VALUES('a36e1c57-4b23-4472-b4ee-4f7b6ddaf441','Pengoperasian Proses Kering Industri Crumb Rubber',NULL,1,'2026-10-07 15:30:54','2026-10-07 15:30:54','5824eeb6-ecdb-4a35-862c-002f3c981043');
CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  bank_id TEXT NOT NULL,
  question_text TEXT NOT NULL CHECK (length(trim(question_text)) > 0),
  image_key TEXT,
  option_a TEXT NOT NULL CHECK (length(trim(option_a)) > 0),
  option_b TEXT NOT NULL CHECK (length(trim(option_b)) > 0),
  option_c TEXT NOT NULL CHECK (length(trim(option_c)) > 0),
  option_d TEXT NOT NULL CHECK (length(trim(option_d)) > 0),
  correct_option_key TEXT NOT NULL CHECK (correct_option_key IN ('A', 'B', 'C', 'D')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  times_assigned INTEGER NOT NULL DEFAULT 0 CHECK (times_assigned >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE RESTRICT
) STRICT;
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('2f94eaf4-e40b-429e-a13e-44f622ce01ce','a36e1c57-4b23-4472-b4ee-4f7b6ddaf441','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,2,'2026-10-07 15:45:01','2026-10-07 15:45:01');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('27554319-0fc9-4a04-bff9-4fe0426ed2a5','a36e1c57-4b23-4472-b4ee-4f7b6ddaf441','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,2,'2026-10-07 15:45:01','2026-10-07 15:45:01');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('0870e49b-f416-410f-85cf-ec9c7f5b90c1','ab3ba0e8-8456-4fec-96d9-96bd45fdf5f3','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,1,'2026-10-07 17:54:23','2026-10-07 17:54:23');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('a5a76649-cc39-4ee9-8c76-a82f40655cb9','ab3ba0e8-8456-4fec-96d9-96bd45fdf5f3','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,1,'2026-10-07 17:54:23','2026-10-07 17:54:23');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('c0b413d9-bb2f-4fa4-8cd3-125b65caded1','60e4e6ba-6447-4137-bde3-6c32ec91ee11','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,1,'2026-10-07 17:54:53','2026-10-07 17:54:53');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('52d25ce7-45d7-4646-8ddc-5cf1e848e26f','60e4e6ba-6447-4137-bde3-6c32ec91ee11','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,1,'2026-10-07 17:54:53','2026-10-07 17:54:53');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('de1d390c-abfb-44b8-b40f-db6bbf59e5d5','cafb76fc-a276-4d1d-b512-c1392e5b41be','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,1,'2026-10-07 17:55:21','2026-10-07 17:55:21');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('387d9dd5-be80-47d0-af56-f4b5e6008bdf','cafb76fc-a276-4d1d-b512-c1392e5b41be','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,1,'2026-10-07 17:55:21','2026-10-07 17:55:21');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('1824adb2-ba92-48c8-a941-bfd80463dc43','901dfa40-1f19-444e-8828-fef7f82de5d1','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,1,'2026-10-07 17:55:48','2026-10-07 17:55:48');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('f3ea3025-06ac-4894-87ea-b792b334fb0a','901dfa40-1f19-444e-8828-fef7f82de5d1','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,1,'2026-10-07 17:55:48','2026-10-07 17:55:48');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('53f41547-a3c7-419f-aa7b-dc30c4428aa2','f7a240bc-5b80-4c1b-8add-2a4bb3581f7b','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,1,'2026-10-07 17:56:12','2026-10-07 17:56:12');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('4d2e50ff-c711-4fa4-ab19-71a2b1a09c47','f7a240bc-5b80-4c1b-8add-2a4bb3581f7b','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,1,'2026-10-07 17:56:12','2026-10-07 17:56:12');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('21f7a501-30f3-43de-95be-ad2cbab27e6a','69b7a39b-80e0-4bfc-932c-f4d309a468cf','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,1,'2026-10-07 17:56:53','2026-10-07 17:56:53');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('3cc9b951-0171-4d5e-be48-09b0d129703e','69b7a39b-80e0-4bfc-932c-f4d309a468cf','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,1,'2026-10-07 17:56:53','2026-10-07 17:56:53');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('ac709e7b-4f60-43ad-ae97-5db4460e92e1','ac1187c3-08c4-46df-a475-4953a4d3274d','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,1,'2026-10-07 17:57:22','2026-10-07 17:57:22');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('2712bc1b-df66-49d7-b535-d0dc457267d8','ac1187c3-08c4-46df-a475-4953a4d3274d','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,1,'2026-10-07 17:57:22','2026-10-07 17:57:22');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('a7120eca-7269-4924-8180-8f7881feae58','99775b28-6e53-4988-bcc6-1c0361f66cab','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,0,'2026-10-07 17:57:40','2026-10-07 17:57:40');
INSERT INTO "questions" ("id","bank_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","is_active","times_assigned","created_at","updated_at") VALUES('39e2f463-74d0-46e7-82e9-2d72c86b7c2c','99775b28-6e53-4988-bcc6-1c0361f66cab','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,0,'2026-10-07 17:57:40','2026-10-07 17:57:40');
CREATE TABLE training_sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL COLLATE NOCASE,
  bank_id TEXT NOT NULL,
  question_count INTEGER NOT NULL CHECK (question_count > 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  passing_score REAL NOT NULL CHECK (passing_score >= 0 AND passing_score <= 100),
  training_start_date TEXT NOT NULL,
  training_end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED')),
  pre_mode TEXT NOT NULL DEFAULT 'MANUAL' CHECK (pre_mode IN ('MANUAL', 'SCHEDULED')),
  pre_start_at TEXT,
  pre_end_at TEXT,
  pre_manual_open INTEGER NOT NULL DEFAULT 0 CHECK (pre_manual_open IN (0, 1)),
  post_mode TEXT NOT NULL DEFAULT 'MANUAL' CHECK (post_mode IN ('MANUAL', 'SCHEDULED')),
  post_start_at TEXT,
  post_end_at TEXT,
  post_manual_open INTEGER NOT NULL DEFAULT 0 CHECK (post_manual_open IN (0, 1)),
  activated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, training_id TEXT REFERENCES trainings(id) ON DELETE RESTRICT, material_id TEXT REFERENCES training_materials(id) ON DELETE RESTRICT,
  CHECK (training_end_date >= training_start_date),
  CHECK (
    pre_mode = 'MANUAL'
    OR (pre_start_at IS NOT NULL AND pre_end_at IS NOT NULL AND pre_end_at > pre_start_at)
  ),
  CHECK (
    post_mode = 'MANUAL'
    OR (post_start_at IS NOT NULL AND post_end_at IS NOT NULL AND post_end_at > post_start_at)
  ),
  UNIQUE (slug),
  FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE RESTRICT
) STRICT;
INSERT INTO "training_sessions" ("id","name","slug","bank_id","question_count","duration_minutes","passing_score","training_start_date","training_end_date","status","pre_mode","pre_start_at","pre_end_at","pre_manual_open","post_mode","post_start_at","post_end_at","post_manual_open","activated_at","created_at","updated_at","training_id","material_id") VALUES('772ad24c-fc82-4acf-9297-76cc96774e05','Mengoperasikan Alat Shrink Fast/Gun','mengoperasikan-alat-shrink-fast-gun-angkatan-1-772ad24c','a36e1c57-4b23-4472-b4ee-4f7b6ddaf441',2,7,80,'2026-10-12','2026-10-18','ACTIVE','MANUAL',NULL,NULL,0,'MANUAL',NULL,NULL,0,'2026-10-07 16:52:10','2026-10-07 16:52:05','2026-10-07 17:59:18','912a3c82-030a-498a-94e7-1a1844b346bd','5824eeb6-ecdb-4a35-862c-002f3c981043');
INSERT INTO "training_sessions" ("id","name","slug","bank_id","question_count","duration_minutes","passing_score","training_start_date","training_end_date","status","pre_mode","pre_start_at","pre_end_at","pre_manual_open","post_mode","post_start_at","post_end_at","post_manual_open","activated_at","created_at","updated_at","training_id","material_id") VALUES('c1a0fb08-ea1b-4c29-93af-62462d2dfb89','Mengoperasikan Alat Strapping','mengoperasikan-alat-strapping-angkatan-1-c1a0fb08','ab3ba0e8-8456-4fec-96d9-96bd45fdf5f3',2,7,80,'2026-10-12','2026-10-18','ACTIVE','MANUAL',NULL,NULL,0,'MANUAL',NULL,NULL,0,'2026-10-07 17:59:27','2026-10-07 17:58:44','2026-10-07 18:00:35','912a3c82-030a-498a-94e7-1a1844b346bd','8a34387c-b7ce-4e9e-81b2-ce92b083c95d');
INSERT INTO "training_sessions" ("id","name","slug","bank_id","question_count","duration_minutes","passing_score","training_start_date","training_end_date","status","pre_mode","pre_start_at","pre_end_at","pre_manual_open","post_mode","post_start_at","post_end_at","post_manual_open","activated_at","created_at","updated_at","training_id","material_id") VALUES('6b13c4ea-77fe-4a06-baa9-6fafb675148b','Memberikan Labelling Pada Pallet','memberikan-labelling-pada-pallet-angkatan-1-6b13c4ea','60e4e6ba-6447-4137-bde3-6c32ec91ee11',2,7,80,'2026-10-12','2026-10-18','ACTIVE','MANUAL',NULL,NULL,0,'MANUAL',NULL,NULL,0,'2026-10-07 18:01:16','2026-10-07 18:01:05','2026-10-07 18:02:19','912a3c82-030a-498a-94e7-1a1844b346bd','09486ec9-6133-48fa-b718-a678bef5acd1');
INSERT INTO "training_sessions" ("id","name","slug","bank_id","question_count","duration_minutes","passing_score","training_start_date","training_end_date","status","pre_mode","pre_start_at","pre_end_at","pre_manual_open","post_mode","post_start_at","post_end_at","post_manual_open","activated_at","created_at","updated_at","training_id","material_id") VALUES('43ce57d1-4611-4be4-9f91-c435aa2d66e9','Mengatur Penyusunan Bandela Dalam Pallet/Box','mengatur-penyusunan-bandela-dalam-pallet-box-angkatan-1-43ce57d1','cafb76fc-a276-4d1d-b512-c1392e5b41be',2,7,80,'2026-10-12','2026-10-18','ACTIVE','MANUAL',NULL,NULL,0,'MANUAL',NULL,NULL,0,'2026-10-07 18:05:25','2026-10-07 18:02:55','2026-10-07 18:06:35','912a3c82-030a-498a-94e7-1a1844b346bd','d4b00115-6426-4286-9b2b-22e7e45f85cf');
INSERT INTO "training_sessions" ("id","name","slug","bank_id","question_count","duration_minutes","passing_score","training_start_date","training_end_date","status","pre_mode","pre_start_at","pre_end_at","pre_manual_open","post_mode","post_start_at","post_end_at","post_manual_open","activated_at","created_at","updated_at","training_id","material_id") VALUES('38d4e552-f3fe-485a-845c-61801c716a52','Mengoperasikan Mesin Metal Detector','mengoperasikan-mesin-metal-detector-angkatan-1-38d4e552','901dfa40-1f19-444e-8828-fef7f82de5d1',2,7,80,'2026-10-12','2026-10-18','ACTIVE','MANUAL',NULL,NULL,0,'MANUAL',NULL,NULL,0,'2026-10-07 18:07:00','2026-10-07 18:03:24','2026-10-07 18:08:33','912a3c82-030a-498a-94e7-1a1844b346bd','1b0e0e5f-1ceb-49f6-9c03-7cb3a79dfb65');
INSERT INTO "training_sessions" ("id","name","slug","bank_id","question_count","duration_minutes","passing_score","training_start_date","training_end_date","status","pre_mode","pre_start_at","pre_end_at","pre_manual_open","post_mode","post_start_at","post_end_at","post_manual_open","activated_at","created_at","updated_at","training_id","material_id") VALUES('dbe498ee-3d60-4d3d-88cc-01b69ad1472b','Mengoperasikan Mesin Press Bandela','mengoperasikan-mesin-press-bandela-angkatan-1-dbe498ee','f7a240bc-5b80-4c1b-8add-2a4bb3581f7b',2,7,80,'2026-10-12','2026-10-18','ACTIVE','MANUAL',NULL,NULL,0,'MANUAL',NULL,NULL,0,'2026-10-07 18:08:45','2026-10-07 18:03:46','2026-10-07 18:09:59','912a3c82-030a-498a-94e7-1a1844b346bd','7f395637-567e-49d3-b6d1-382f87447220');
INSERT INTO "training_sessions" ("id","name","slug","bank_id","question_count","duration_minutes","passing_score","training_start_date","training_end_date","status","pre_mode","pre_start_at","pre_end_at","pre_manual_open","post_mode","post_start_at","post_end_at","post_manual_open","activated_at","created_at","updated_at","training_id","material_id") VALUES('88d6a3d6-2c66-4922-b94a-68948a0c9ed2','Mengoperasikan Timbangan Bandela','mengoperasikan-timbangan-bandela-angkatan-1-88d6a3d6','69b7a39b-80e0-4bfc-932c-f4d309a468cf',2,7,80,'2026-10-12','2026-10-18','ACTIVE','MANUAL',NULL,NULL,0,'MANUAL',NULL,NULL,0,'2026-10-07 18:10:18','2026-10-07 18:04:13','2026-10-07 18:11:29','912a3c82-030a-498a-94e7-1a1844b346bd','3eafc746-5185-4814-9835-240f20ff5bde');
INSERT INTO "training_sessions" ("id","name","slug","bank_id","question_count","duration_minutes","passing_score","training_start_date","training_end_date","status","pre_mode","pre_start_at","pre_end_at","pre_manual_open","post_mode","post_start_at","post_end_at","post_manual_open","activated_at","created_at","updated_at","training_id","material_id") VALUES('905247aa-3650-4131-9ab8-ddd7eb02e924','Mengoperasikan Unit Dryer','mengoperasikan-unit-dryer-angkatan-1-905247aa','ac1187c3-08c4-46df-a475-4953a4d3274d',2,7,80,'2026-10-12','2026-10-18','ACTIVE','MANUAL',NULL,NULL,1,'MANUAL',NULL,NULL,0,'2026-10-07 18:11:46','2026-10-07 18:04:37','2026-10-08 08:21:34','912a3c82-030a-498a-94e7-1a1844b346bd','1ec66453-00f4-4f9a-93ff-c980c135c09c');
CREATE TABLE batches (
  id TEXT PRIMARY KEY,
  training_session_id TEXT NOT NULL,
  batch_number INTEGER NOT NULL CHECK (batch_number > 0),
  batch_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, cohort_id TEXT REFERENCES training_cohorts(id) ON DELETE RESTRICT,
  UNIQUE (training_session_id, batch_number),
  UNIQUE (training_session_id, batch_name),
  FOREIGN KEY (training_session_id) REFERENCES training_sessions(id) ON DELETE CASCADE
) STRICT;
INSERT INTO "batches" ("id","training_session_id","batch_number","batch_name","created_at","cohort_id") VALUES('0821dc04-1a0c-45b0-b5fe-88c36f4c1cb7','772ad24c-fc82-4acf-9297-76cc96774e05',1,'Angkatan 1','2026-10-07 16:52:05','88f8bf15-7c9f-48d3-87af-075da9fedbed');
INSERT INTO "batches" ("id","training_session_id","batch_number","batch_name","created_at","cohort_id") VALUES('c40e2032-3fe1-4013-a7a5-88ef39774694','c1a0fb08-ea1b-4c29-93af-62462d2dfb89',1,'Angkatan 1','2026-10-07 17:58:44','88f8bf15-7c9f-48d3-87af-075da9fedbed');
INSERT INTO "batches" ("id","training_session_id","batch_number","batch_name","created_at","cohort_id") VALUES('36756d0e-5b65-404f-9239-cb1d01f55124','6b13c4ea-77fe-4a06-baa9-6fafb675148b',1,'Angkatan 1','2026-10-07 18:01:05','88f8bf15-7c9f-48d3-87af-075da9fedbed');
INSERT INTO "batches" ("id","training_session_id","batch_number","batch_name","created_at","cohort_id") VALUES('95dff543-135d-439c-9f47-1d71e52c5b54','43ce57d1-4611-4be4-9f91-c435aa2d66e9',1,'Angkatan 1','2026-10-07 18:02:55','88f8bf15-7c9f-48d3-87af-075da9fedbed');
INSERT INTO "batches" ("id","training_session_id","batch_number","batch_name","created_at","cohort_id") VALUES('0017cc10-f8ab-473e-a0b0-21b819f1601a','38d4e552-f3fe-485a-845c-61801c716a52',1,'Angkatan 1','2026-10-07 18:03:24','88f8bf15-7c9f-48d3-87af-075da9fedbed');
INSERT INTO "batches" ("id","training_session_id","batch_number","batch_name","created_at","cohort_id") VALUES('d211a7be-a3a8-44e4-bce9-ed068556e3a4','dbe498ee-3d60-4d3d-88cc-01b69ad1472b',1,'Angkatan 1','2026-10-07 18:03:46','88f8bf15-7c9f-48d3-87af-075da9fedbed');
INSERT INTO "batches" ("id","training_session_id","batch_number","batch_name","created_at","cohort_id") VALUES('7dddc48f-a321-41af-a59b-9114726f5b1c','88d6a3d6-2c66-4922-b94a-68948a0c9ed2',1,'Angkatan 1','2026-10-07 18:04:13','88f8bf15-7c9f-48d3-87af-075da9fedbed');
INSERT INTO "batches" ("id","training_session_id","batch_number","batch_name","created_at","cohort_id") VALUES('0170c2e9-b287-4d02-b84c-8f83cd85a6f9','905247aa-3650-4131-9ab8-ddd7eb02e924',1,'Angkatan 1','2026-10-07 18:04:37','88f8bf15-7c9f-48d3-87af-075da9fedbed');
CREATE TABLE batch_questions (
  batch_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (batch_id, question_id),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT
) STRICT;
INSERT INTO "batch_questions" ("batch_id","question_id","created_at") VALUES('0821dc04-1a0c-45b0-b5fe-88c36f4c1cb7','27554319-0fc9-4a04-bff9-4fe0426ed2a5','2026-10-07 16:52:10');
INSERT INTO "batch_questions" ("batch_id","question_id","created_at") VALUES('0821dc04-1a0c-45b0-b5fe-88c36f4c1cb7','2f94eaf4-e40b-429e-a13e-44f622ce01ce','2026-10-07 16:52:10');
INSERT INTO "batch_questions" ("batch_id","question_id","created_at") VALUES('c40e2032-3fe1-4013-a7a5-88ef39774694','a5a76649-cc39-4ee9-8c76-a82f40655cb9','2026-10-07 17:59:27');
INSERT INTO "batch_questions" ("batch_id","question_id","created_at") VALUES('c40e2032-3fe1-4013-a7a5-88ef39774694','0870e49b-f416-410f-85cf-ec9c7f5b90c1','2026-10-07 17:59:27');
INSERT INTO "batch_questions" ("batch_id","question_id","created_at") VALUES('36756d0e-5b65-404f-9239-cb1d01f55124','c0b413d9-bb2f-4fa4-8cd3-125b65caded1','2026-10-07 18:01:16');
INSERT INTO "batch_questions" ("batch_id","question_id","created_at") VALUES('36756d0e-5b65-404f-9239-cb1d01f55124','52d25ce7-45d7-4646-8ddc-5cf1e848e26f','2026-10-07 18:01:16');
INSERT INTO "batch_questions" ("batch_id","question_id","created_at") VALUES('95dff543-135d-439c-9f47-1d71e52c5b54','de1d390c-abfb-44b8-b40f-db6bbf59e5d5','2026-10-07 18:05:25');
INSERT INTO "batch_questions" ("batch_id","question_id","created_at") VALUES('95dff543-135d-439c-9f47-1d71e52c5b54','387d9dd5-be80-47d0-af56-f4b5e6008bdf','2026-10-07 18:05:25');
INSERT INTO "batch_questions" ("batch_id","question_id","created_at") VALUES('0017cc10-f8ab-473e-a0b0-21b819f1601a','f3ea3025-06ac-4894-87ea-b792b334fb0a','2026-10-07 18:07:00');
INSERT INTO "batch_questions" ("batch_id","question_id","created_at") VALUES('0017cc10-f8ab-473e-a0b0-21b819f1601a','1824adb2-ba92-48c8-a941-bfd80463dc43','2026-10-07 18:07:00');
INSERT INTO "batch_questions" ("batch_id","question_id","created_at") VALUES('d211a7be-a3a8-44e4-bce9-ed068556e3a4','53f41547-a3c7-419f-aa7b-dc30c4428aa2','2026-10-07 18:08:45');
INSERT INTO "batch_questions" ("batch_id","question_id","created_at") VALUES('d211a7be-a3a8-44e4-bce9-ed068556e3a4','4d2e50ff-c711-4fa4-ab19-71a2b1a09c47','2026-10-07 18:08:45');
INSERT INTO "batch_questions" ("batch_id","question_id","created_at") VALUES('7dddc48f-a321-41af-a59b-9114726f5b1c','3cc9b951-0171-4d5e-be48-09b0d129703e','2026-10-07 18:10:18');
INSERT INTO "batch_questions" ("batch_id","question_id","created_at") VALUES('7dddc48f-a321-41af-a59b-9114726f5b1c','21f7a501-30f3-43de-95be-ad2cbab27e6a','2026-10-07 18:10:18');
INSERT INTO "batch_questions" ("batch_id","question_id","created_at") VALUES('0170c2e9-b287-4d02-b84c-8f83cd85a6f9','2712bc1b-df66-49d7-b535-d0dc457267d8','2026-10-07 19:10:29');
INSERT INTO "batch_questions" ("batch_id","question_id","created_at") VALUES('0170c2e9-b287-4d02-b84c-8f83cd85a6f9','ac709e7b-4f60-43ad-ae97-5db4460e92e1','2026-10-07 19:10:29');
CREATE TABLE batch_layouts (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('PRE', 'POST', 'REMEDIAL_1', 'REMEDIAL_2', 'REMEDIAL_3')),
  question_order_json TEXT NOT NULL CHECK (json_valid(question_order_json)),
  option_orders_json TEXT NOT NULL CHECK (json_valid(option_orders_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (batch_id, stage),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
) STRICT;
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('9316e5ce-c257-45f6-9a28-3d068672befa','0821dc04-1a0c-45b0-b5fe-88c36f4c1cb7','PRE','["2f94eaf4-e40b-429e-a13e-44f622ce01ce","27554319-0fc9-4a04-bff9-4fe0426ed2a5"]','{"27554319-0fc9-4a04-bff9-4fe0426ed2a5":["A","B","C","D"],"2f94eaf4-e40b-429e-a13e-44f622ce01ce":["A","B","C","D"]}','2026-10-07 16:52:10');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('43e70b36-9e1f-4e02-bd73-d4603885d924','0821dc04-1a0c-45b0-b5fe-88c36f4c1cb7','POST','["27554319-0fc9-4a04-bff9-4fe0426ed2a5","2f94eaf4-e40b-429e-a13e-44f622ce01ce"]','{"27554319-0fc9-4a04-bff9-4fe0426ed2a5":["A","B","C","D"],"2f94eaf4-e40b-429e-a13e-44f622ce01ce":["A","B","C","D"]}','2026-10-07 16:52:10');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('73a4c939-0e09-48df-b1d4-3e73f432e45b','0821dc04-1a0c-45b0-b5fe-88c36f4c1cb7','REMEDIAL_1','["2f94eaf4-e40b-429e-a13e-44f622ce01ce","27554319-0fc9-4a04-bff9-4fe0426ed2a5"]','{"27554319-0fc9-4a04-bff9-4fe0426ed2a5":["A","B","C","D"],"2f94eaf4-e40b-429e-a13e-44f622ce01ce":["A","B","C","D"]}','2026-10-07 16:52:10');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('02985d85-924d-4117-8e73-c6cf6d344b3d','0821dc04-1a0c-45b0-b5fe-88c36f4c1cb7','REMEDIAL_2','["27554319-0fc9-4a04-bff9-4fe0426ed2a5","2f94eaf4-e40b-429e-a13e-44f622ce01ce"]','{"27554319-0fc9-4a04-bff9-4fe0426ed2a5":["A","B","C","D"],"2f94eaf4-e40b-429e-a13e-44f622ce01ce":["A","B","C","D"]}','2026-10-07 16:52:10');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('2db87de5-c2fb-405d-845d-0e807447eebe','c40e2032-3fe1-4013-a7a5-88ef39774694','PRE','["0870e49b-f416-410f-85cf-ec9c7f5b90c1","a5a76649-cc39-4ee9-8c76-a82f40655cb9"]','{"a5a76649-cc39-4ee9-8c76-a82f40655cb9":["A","B","C","D"],"0870e49b-f416-410f-85cf-ec9c7f5b90c1":["A","B","C","D"]}','2026-10-07 17:59:27');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('30a88348-e479-4b9c-a413-be61dd831883','c40e2032-3fe1-4013-a7a5-88ef39774694','POST','["a5a76649-cc39-4ee9-8c76-a82f40655cb9","0870e49b-f416-410f-85cf-ec9c7f5b90c1"]','{"a5a76649-cc39-4ee9-8c76-a82f40655cb9":["A","B","C","D"],"0870e49b-f416-410f-85cf-ec9c7f5b90c1":["A","B","C","D"]}','2026-10-07 17:59:27');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('5e29db46-a2ba-49b6-bd91-62582d39e07a','c40e2032-3fe1-4013-a7a5-88ef39774694','REMEDIAL_1','["0870e49b-f416-410f-85cf-ec9c7f5b90c1","a5a76649-cc39-4ee9-8c76-a82f40655cb9"]','{"a5a76649-cc39-4ee9-8c76-a82f40655cb9":["A","B","C","D"],"0870e49b-f416-410f-85cf-ec9c7f5b90c1":["A","B","C","D"]}','2026-10-07 17:59:27');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('ba3b24c0-8b37-4942-bf8b-36e9d4ed31ad','c40e2032-3fe1-4013-a7a5-88ef39774694','REMEDIAL_2','["a5a76649-cc39-4ee9-8c76-a82f40655cb9","0870e49b-f416-410f-85cf-ec9c7f5b90c1"]','{"a5a76649-cc39-4ee9-8c76-a82f40655cb9":["A","B","C","D"],"0870e49b-f416-410f-85cf-ec9c7f5b90c1":["A","B","C","D"]}','2026-10-07 17:59:27');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('42153d71-f6f2-4cfe-b9fe-fdd8008b7a80','36756d0e-5b65-404f-9239-cb1d01f55124','PRE','["c0b413d9-bb2f-4fa4-8cd3-125b65caded1","52d25ce7-45d7-4646-8ddc-5cf1e848e26f"]','{"c0b413d9-bb2f-4fa4-8cd3-125b65caded1":["A","B","C","D"],"52d25ce7-45d7-4646-8ddc-5cf1e848e26f":["A","B","C","D"]}','2026-10-07 18:01:16');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('d9a97d73-e0f6-4ce2-a752-f38bcbfdcf51','36756d0e-5b65-404f-9239-cb1d01f55124','POST','["52d25ce7-45d7-4646-8ddc-5cf1e848e26f","c0b413d9-bb2f-4fa4-8cd3-125b65caded1"]','{"c0b413d9-bb2f-4fa4-8cd3-125b65caded1":["A","B","C","D"],"52d25ce7-45d7-4646-8ddc-5cf1e848e26f":["A","B","C","D"]}','2026-10-07 18:01:16');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('d8ffe8ef-97b4-4190-9394-83da59e131a6','36756d0e-5b65-404f-9239-cb1d01f55124','REMEDIAL_1','["c0b413d9-bb2f-4fa4-8cd3-125b65caded1","52d25ce7-45d7-4646-8ddc-5cf1e848e26f"]','{"c0b413d9-bb2f-4fa4-8cd3-125b65caded1":["A","B","C","D"],"52d25ce7-45d7-4646-8ddc-5cf1e848e26f":["A","B","C","D"]}','2026-10-07 18:01:16');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('5716c0d3-2841-4791-a624-acb4947aca0d','36756d0e-5b65-404f-9239-cb1d01f55124','REMEDIAL_2','["52d25ce7-45d7-4646-8ddc-5cf1e848e26f","c0b413d9-bb2f-4fa4-8cd3-125b65caded1"]','{"c0b413d9-bb2f-4fa4-8cd3-125b65caded1":["A","B","C","D"],"52d25ce7-45d7-4646-8ddc-5cf1e848e26f":["A","B","C","D"]}','2026-10-07 18:01:16');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('d3107ec6-da7c-4825-a92c-5339d18140a8','95dff543-135d-439c-9f47-1d71e52c5b54','PRE','["de1d390c-abfb-44b8-b40f-db6bbf59e5d5","387d9dd5-be80-47d0-af56-f4b5e6008bdf"]','{"de1d390c-abfb-44b8-b40f-db6bbf59e5d5":["A","B","C","D"],"387d9dd5-be80-47d0-af56-f4b5e6008bdf":["A","B","C","D"]}','2026-10-07 18:05:25');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('f12fbfb9-acf9-4a54-bdf5-0c640d509528','95dff543-135d-439c-9f47-1d71e52c5b54','POST','["387d9dd5-be80-47d0-af56-f4b5e6008bdf","de1d390c-abfb-44b8-b40f-db6bbf59e5d5"]','{"de1d390c-abfb-44b8-b40f-db6bbf59e5d5":["A","B","C","D"],"387d9dd5-be80-47d0-af56-f4b5e6008bdf":["A","B","C","D"]}','2026-10-07 18:05:25');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('edd7a72b-faf6-45e9-9554-5028fb380f48','95dff543-135d-439c-9f47-1d71e52c5b54','REMEDIAL_1','["de1d390c-abfb-44b8-b40f-db6bbf59e5d5","387d9dd5-be80-47d0-af56-f4b5e6008bdf"]','{"de1d390c-abfb-44b8-b40f-db6bbf59e5d5":["A","B","C","D"],"387d9dd5-be80-47d0-af56-f4b5e6008bdf":["A","B","C","D"]}','2026-10-07 18:05:25');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('14d8f806-0854-4e8f-9c82-61a9a071247b','95dff543-135d-439c-9f47-1d71e52c5b54','REMEDIAL_2','["387d9dd5-be80-47d0-af56-f4b5e6008bdf","de1d390c-abfb-44b8-b40f-db6bbf59e5d5"]','{"de1d390c-abfb-44b8-b40f-db6bbf59e5d5":["A","B","C","D"],"387d9dd5-be80-47d0-af56-f4b5e6008bdf":["A","B","C","D"]}','2026-10-07 18:05:25');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('5f12a136-68a5-4a57-a95d-25a0a4a10509','0017cc10-f8ab-473e-a0b0-21b819f1601a','PRE','["f3ea3025-06ac-4894-87ea-b792b334fb0a","1824adb2-ba92-48c8-a941-bfd80463dc43"]','{"f3ea3025-06ac-4894-87ea-b792b334fb0a":["A","B","C","D"],"1824adb2-ba92-48c8-a941-bfd80463dc43":["A","B","C","D"]}','2026-10-07 18:07:00');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('744e02b9-a531-42e2-8852-349ba381fc7b','0017cc10-f8ab-473e-a0b0-21b819f1601a','POST','["1824adb2-ba92-48c8-a941-bfd80463dc43","f3ea3025-06ac-4894-87ea-b792b334fb0a"]','{"f3ea3025-06ac-4894-87ea-b792b334fb0a":["A","B","C","D"],"1824adb2-ba92-48c8-a941-bfd80463dc43":["A","B","C","D"]}','2026-10-07 18:07:00');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('539960da-6b36-4445-8c0f-e5df52057d2d','0017cc10-f8ab-473e-a0b0-21b819f1601a','REMEDIAL_1','["f3ea3025-06ac-4894-87ea-b792b334fb0a","1824adb2-ba92-48c8-a941-bfd80463dc43"]','{"f3ea3025-06ac-4894-87ea-b792b334fb0a":["A","B","C","D"],"1824adb2-ba92-48c8-a941-bfd80463dc43":["A","B","C","D"]}','2026-10-07 18:07:00');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('a6cbce1f-9515-432d-83e4-d449f04b4a31','0017cc10-f8ab-473e-a0b0-21b819f1601a','REMEDIAL_2','["1824adb2-ba92-48c8-a941-bfd80463dc43","f3ea3025-06ac-4894-87ea-b792b334fb0a"]','{"f3ea3025-06ac-4894-87ea-b792b334fb0a":["A","B","C","D"],"1824adb2-ba92-48c8-a941-bfd80463dc43":["A","B","C","D"]}','2026-10-07 18:07:00');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('52da5902-ea46-4afb-94a4-b5cdc24de2fb','d211a7be-a3a8-44e4-bce9-ed068556e3a4','PRE','["4d2e50ff-c711-4fa4-ab19-71a2b1a09c47","53f41547-a3c7-419f-aa7b-dc30c4428aa2"]','{"53f41547-a3c7-419f-aa7b-dc30c4428aa2":["A","B","C","D"],"4d2e50ff-c711-4fa4-ab19-71a2b1a09c47":["A","B","C","D"]}','2026-10-07 18:08:45');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('d3bc1a58-c124-4dfa-9de3-5a8792665812','d211a7be-a3a8-44e4-bce9-ed068556e3a4','POST','["53f41547-a3c7-419f-aa7b-dc30c4428aa2","4d2e50ff-c711-4fa4-ab19-71a2b1a09c47"]','{"53f41547-a3c7-419f-aa7b-dc30c4428aa2":["A","B","C","D"],"4d2e50ff-c711-4fa4-ab19-71a2b1a09c47":["A","B","C","D"]}','2026-10-07 18:08:45');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('b1a3b46a-5eee-4b24-b5c1-9c7b4fd9fd5e','d211a7be-a3a8-44e4-bce9-ed068556e3a4','REMEDIAL_1','["4d2e50ff-c711-4fa4-ab19-71a2b1a09c47","53f41547-a3c7-419f-aa7b-dc30c4428aa2"]','{"53f41547-a3c7-419f-aa7b-dc30c4428aa2":["A","B","C","D"],"4d2e50ff-c711-4fa4-ab19-71a2b1a09c47":["A","B","C","D"]}','2026-10-07 18:08:45');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('8a18116c-27ed-48b5-ac4d-a644dadc58e0','d211a7be-a3a8-44e4-bce9-ed068556e3a4','REMEDIAL_2','["53f41547-a3c7-419f-aa7b-dc30c4428aa2","4d2e50ff-c711-4fa4-ab19-71a2b1a09c47"]','{"53f41547-a3c7-419f-aa7b-dc30c4428aa2":["A","B","C","D"],"4d2e50ff-c711-4fa4-ab19-71a2b1a09c47":["A","B","C","D"]}','2026-10-07 18:08:45');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('b5593faf-4bff-4b4b-a54c-38c072278c71','7dddc48f-a321-41af-a59b-9114726f5b1c','PRE','["21f7a501-30f3-43de-95be-ad2cbab27e6a","3cc9b951-0171-4d5e-be48-09b0d129703e"]','{"3cc9b951-0171-4d5e-be48-09b0d129703e":["A","B","C","D"],"21f7a501-30f3-43de-95be-ad2cbab27e6a":["A","B","C","D"]}','2026-10-07 18:10:18');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('c2af0cff-e451-41bf-be77-ecef7de89951','7dddc48f-a321-41af-a59b-9114726f5b1c','POST','["3cc9b951-0171-4d5e-be48-09b0d129703e","21f7a501-30f3-43de-95be-ad2cbab27e6a"]','{"3cc9b951-0171-4d5e-be48-09b0d129703e":["A","B","C","D"],"21f7a501-30f3-43de-95be-ad2cbab27e6a":["A","B","C","D"]}','2026-10-07 18:10:18');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('e3abeed6-e355-421a-9546-caaabfba93a5','7dddc48f-a321-41af-a59b-9114726f5b1c','REMEDIAL_1','["21f7a501-30f3-43de-95be-ad2cbab27e6a","3cc9b951-0171-4d5e-be48-09b0d129703e"]','{"3cc9b951-0171-4d5e-be48-09b0d129703e":["A","B","C","D"],"21f7a501-30f3-43de-95be-ad2cbab27e6a":["A","B","C","D"]}','2026-10-07 18:10:18');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('3a8fb2f6-ecae-4995-b90f-1cc876827bf8','7dddc48f-a321-41af-a59b-9114726f5b1c','REMEDIAL_2','["3cc9b951-0171-4d5e-be48-09b0d129703e","21f7a501-30f3-43de-95be-ad2cbab27e6a"]','{"3cc9b951-0171-4d5e-be48-09b0d129703e":["A","B","C","D"],"21f7a501-30f3-43de-95be-ad2cbab27e6a":["A","B","C","D"]}','2026-10-07 18:10:18');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('894d5899-81f4-46d5-8c30-497b8f1bba38','0170c2e9-b287-4d02-b84c-8f83cd85a6f9','PRE','["2712bc1b-df66-49d7-b535-d0dc457267d8","ac709e7b-4f60-43ad-ae97-5db4460e92e1"]','{"2712bc1b-df66-49d7-b535-d0dc457267d8":["A","B","C","D"],"ac709e7b-4f60-43ad-ae97-5db4460e92e1":["A","B","C","D"]}','2026-10-07 19:10:29');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('d34ae999-0dbb-47f3-9e19-978024928e46','0170c2e9-b287-4d02-b84c-8f83cd85a6f9','POST','["ac709e7b-4f60-43ad-ae97-5db4460e92e1","2712bc1b-df66-49d7-b535-d0dc457267d8"]','{"2712bc1b-df66-49d7-b535-d0dc457267d8":["A","B","C","D"],"ac709e7b-4f60-43ad-ae97-5db4460e92e1":["A","B","C","D"]}','2026-10-07 19:10:29');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('d4231e1f-5a1a-4b66-a761-2edc2079a1fe','0170c2e9-b287-4d02-b84c-8f83cd85a6f9','REMEDIAL_1','["2712bc1b-df66-49d7-b535-d0dc457267d8","ac709e7b-4f60-43ad-ae97-5db4460e92e1"]','{"2712bc1b-df66-49d7-b535-d0dc457267d8":["A","B","C","D"],"ac709e7b-4f60-43ad-ae97-5db4460e92e1":["A","B","C","D"]}','2026-10-07 19:10:29');
INSERT INTO "batch_layouts" ("id","batch_id","stage","question_order_json","option_orders_json","created_at") VALUES('1cef28a3-4599-45d2-8cd9-75a9cbb18afb','0170c2e9-b287-4d02-b84c-8f83cd85a6f9','REMEDIAL_2','["ac709e7b-4f60-43ad-ae97-5db4460e92e1","2712bc1b-df66-49d7-b535-d0dc457267d8"]','{"2712bc1b-df66-49d7-b535-d0dc457267d8":["A","B","C","D"],"ac709e7b-4f60-43ad-ae97-5db4460e92e1":["A","B","C","D"]}','2026-10-07 19:10:29');
CREATE TABLE attempt_question_snapshots (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  question_text TEXT NOT NULL,
  image_key TEXT,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option_key TEXT NOT NULL CHECK (correct_option_key IN ('A', 'B', 'C', 'D')),
  display_position INTEGER NOT NULL CHECK (display_position > 0),
  display_option_order_json TEXT NOT NULL CHECK (json_valid(display_option_order_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (attempt_id, question_id),
  UNIQUE (attempt_id, display_position),
  FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT
) STRICT;
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('fc701f4b-d4cd-49f1-ba6f-fe6c7cbceee6','d4ff0ff4-f91c-4df6-9543-1686c07bd395','27554319-0fc9-4a04-bff9-4fe0426ed2a5','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,'["A","B","C","D"]','2026-10-07 16:52:39');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('3325c756-1595-42ad-b5b8-397826407a49','d4ff0ff4-f91c-4df6-9543-1686c07bd395','2f94eaf4-e40b-429e-a13e-44f622ce01ce','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',2,'["A","B","C","D"]','2026-10-07 16:52:39');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('55214e4f-8053-4ad3-9f58-083961b7e6d0','863033ee-aee2-409c-972c-efa9ae874d48','27554319-0fc9-4a04-bff9-4fe0426ed2a5','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,'["A","B","C","D"]','2026-10-07 16:53:05');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('331d6d1a-dde3-412e-b88f-5c896f3405a6','863033ee-aee2-409c-972c-efa9ae874d48','2f94eaf4-e40b-429e-a13e-44f622ce01ce','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',2,'["A","B","C","D"]','2026-10-07 16:53:05');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('2b99fd7f-223a-402e-938b-ef3ea8b70daa','f225fdc6-4fe5-4ed8-b961-a63257e61dc8','27554319-0fc9-4a04-bff9-4fe0426ed2a5','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,'["A","B","C","D"]','2026-10-07 17:01:11');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('27924e8b-a635-42b7-92be-4c7e23d5d897','f225fdc6-4fe5-4ed8-b961-a63257e61dc8','2f94eaf4-e40b-429e-a13e-44f622ce01ce','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',2,'["A","B","C","D"]','2026-10-07 17:01:11');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('feb4c2ef-5d1c-45d3-a3c7-a9d05abe610d','636be42c-2aa0-4a90-aa5c-6097555fed19','27554319-0fc9-4a04-bff9-4fe0426ed2a5','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,'["A","B","C","D"]','2026-10-07 17:01:22');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('6a36ff5c-c856-4ee2-a13c-dcea50dfa0e9','636be42c-2aa0-4a90-aa5c-6097555fed19','2f94eaf4-e40b-429e-a13e-44f622ce01ce','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',2,'["A","B","C","D"]','2026-10-07 17:01:22');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('1867365e-04bb-431b-a659-6f345da3c081','e22b7198-af3e-40f2-8d9f-d12485e492c1','27554319-0fc9-4a04-bff9-4fe0426ed2a5','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,'["A","B","C","D"]','2026-10-07 17:23:46');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('37349ec9-ad31-43b2-8f62-5155143df09a','e22b7198-af3e-40f2-8d9f-d12485e492c1','2f94eaf4-e40b-429e-a13e-44f622ce01ce','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',2,'["A","B","C","D"]','2026-10-07 17:23:46');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('0fdc4605-c6b7-4e77-880c-608694f1fd60','9c5f4928-d423-421f-960a-8fa6093b1dc3','0870e49b-f416-410f-85cf-ec9c7f5b90c1','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,'["A","B","C","D"]','2026-10-07 17:59:48');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('a8c636f8-77c1-485f-84b5-48c773b180e8','9c5f4928-d423-421f-960a-8fa6093b1dc3','a5a76649-cc39-4ee9-8c76-a82f40655cb9','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',2,'["A","B","C","D"]','2026-10-07 17:59:48');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('fc1345d8-89ee-4d59-9241-8f82d1bceb70','818fa2cf-e768-4691-aab5-d085676878b9','0870e49b-f416-410f-85cf-ec9c7f5b90c1','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,'["A","B","C","D"]','2026-10-07 18:00:08');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('49dc8c0b-6355-40c2-a133-5306def2c6a0','818fa2cf-e768-4691-aab5-d085676878b9','a5a76649-cc39-4ee9-8c76-a82f40655cb9','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',2,'["A","B","C","D"]','2026-10-07 18:00:08');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('737b1833-7010-4103-8819-ca95c4bb2034','d7cd432d-3e5f-4535-8de1-510f9645f6cd','52d25ce7-45d7-4646-8ddc-5cf1e848e26f','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,'["A","B","C","D"]','2026-10-07 18:01:30');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('ee4e0700-a461-480f-b239-d8a8ae4d2421','d7cd432d-3e5f-4535-8de1-510f9645f6cd','c0b413d9-bb2f-4fa4-8cd3-125b65caded1','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',2,'["A","B","C","D"]','2026-10-07 18:01:30');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('b666636b-9cde-44ce-9ea1-ec96cad973c7','1ce2bcdd-cd05-4049-a2ef-eb10af57ba17','52d25ce7-45d7-4646-8ddc-5cf1e848e26f','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,'["A","B","C","D"]','2026-10-07 18:01:49');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('b407f675-50ef-4b16-b2fc-a94605eb803f','1ce2bcdd-cd05-4049-a2ef-eb10af57ba17','c0b413d9-bb2f-4fa4-8cd3-125b65caded1','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',2,'["A","B","C","D"]','2026-10-07 18:01:49');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('7c5890a9-b02c-45af-8280-69d3bee9757f','134ea828-689a-409a-9722-9ea218a1fe85','de1d390c-abfb-44b8-b40f-db6bbf59e5d5','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,'["A","B","C","D"]','2026-10-07 18:05:44');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('16e2d0b6-0e5c-4e0b-8a6b-b043b51ecac0','134ea828-689a-409a-9722-9ea218a1fe85','387d9dd5-be80-47d0-af56-f4b5e6008bdf','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',2,'["A","B","C","D"]','2026-10-07 18:05:44');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('953a6227-8684-4063-9321-e99b17bd5a57','3cdf3497-fa70-4a34-bb4b-a5f388144095','de1d390c-abfb-44b8-b40f-db6bbf59e5d5','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,'["A","B","C","D"]','2026-10-07 18:06:01');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('4f6ceca7-8593-443e-9bca-c688a54fe2f0','3cdf3497-fa70-4a34-bb4b-a5f388144095','387d9dd5-be80-47d0-af56-f4b5e6008bdf','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',2,'["A","B","C","D"]','2026-10-07 18:06:01');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('9f9fda22-9898-4135-8407-9000fcac2028','b1f68dc3-01a8-43cb-b3da-e0e08bfc2159','de1d390c-abfb-44b8-b40f-db6bbf59e5d5','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,'["A","B","C","D"]','2026-10-07 18:06:10');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('75ec4598-da31-4094-bf98-e153842ad33b','b1f68dc3-01a8-43cb-b3da-e0e08bfc2159','387d9dd5-be80-47d0-af56-f4b5e6008bdf','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',2,'["A","B","C","D"]','2026-10-07 18:06:10');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('b494fc0f-ac5e-4579-9394-4db59e461af5','fca12d5d-990c-497d-be08-f0e06de7b0fa','f3ea3025-06ac-4894-87ea-b792b334fb0a','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,'["A","B","C","D"]','2026-10-07 18:07:17');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('297169ca-6ec4-4128-9c66-14509d8974a6','fca12d5d-990c-497d-be08-f0e06de7b0fa','1824adb2-ba92-48c8-a941-bfd80463dc43','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',2,'["A","B","C","D"]','2026-10-07 18:07:17');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('496dd44e-0571-49d1-b549-e625f341fe03','02f043a7-eaa3-42a9-8760-c353348da223','1824adb2-ba92-48c8-a941-bfd80463dc43','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,'["A","B","C","D"]','2026-10-07 18:08:03');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('9a619e71-13f1-46ac-9b6b-2a03d0e8ca2e','02f043a7-eaa3-42a9-8760-c353348da223','f3ea3025-06ac-4894-87ea-b792b334fb0a','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',2,'["A","B","C","D"]','2026-10-07 18:08:03');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('b0270b38-f665-45f3-801c-9eb88987d3a9','5f71a332-b33e-4df5-aef4-0fa1b2be628f','53f41547-a3c7-419f-aa7b-dc30c4428aa2','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,'["A","B","C","D"]','2026-10-07 18:09:10');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('01dd232b-bd1e-4216-936c-a2d1185dc018','5f71a332-b33e-4df5-aef4-0fa1b2be628f','4d2e50ff-c711-4fa4-ab19-71a2b1a09c47','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',2,'["A","B","C","D"]','2026-10-07 18:09:10');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('756b3b98-0759-44a8-beae-b9b0829a5bcc','f8eb6286-2f39-4599-9f7c-9014b3d724c3','53f41547-a3c7-419f-aa7b-dc30c4428aa2','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,'["A","B","C","D"]','2026-10-07 18:09:36');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('bbcfd22f-2b93-484b-8dc8-f3395e00c5d9','f8eb6286-2f39-4599-9f7c-9014b3d724c3','4d2e50ff-c711-4fa4-ab19-71a2b1a09c47','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',2,'["A","B","C","D"]','2026-10-07 18:09:36');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('86afba57-31c4-4f37-bcc9-4a50c451923b','9dc0bdbc-e0a8-4ee4-99b5-c95cd4d50713','3cc9b951-0171-4d5e-be48-09b0d129703e','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,'["A","B","C","D"]','2026-10-07 18:10:40');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('f944b7c3-9c3b-4bec-8280-a292ef40325f','9dc0bdbc-e0a8-4ee4-99b5-c95cd4d50713','21f7a501-30f3-43de-95be-ad2cbab27e6a','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',2,'["A","B","C","D"]','2026-10-07 18:10:40');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('f17b104f-fd88-44fb-95d5-274561277791','7166b8ba-018c-41fa-a794-4114506b4f4b','21f7a501-30f3-43de-95be-ad2cbab27e6a','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',1,'["A","B","C","D"]','2026-10-07 18:11:01');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('75b5f0b2-6f8a-4715-9164-0dc503df6efd','7166b8ba-018c-41fa-a794-4114506b4f4b','3cc9b951-0171-4d5e-be48-09b0d129703e','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',2,'["A","B","C","D"]','2026-10-07 18:11:01');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('b924116e-9ffa-4be6-8971-96ba27a3f7cd','fa2ed49c-49ac-4479-ad83-e58d5325d3de','2712bc1b-df66-49d7-b535-d0dc457267d8','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,'["A","B","C","D"]','2026-10-07 18:11:59');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('746b8d81-6ba2-4eca-8e08-eeda268722a8','fa2ed49c-49ac-4479-ad83-e58d5325d3de','ac709e7b-4f60-43ad-ae97-5db4460e92e1','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',2,'["A","B","C","D"]','2026-10-07 18:11:59');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('ea84b9b4-873b-4d27-9225-6996c34e5b3c','934a81ae-cacf-4132-abd5-8d33a22c6a54','2712bc1b-df66-49d7-b535-d0dc457267d8','Tuliskan pertanyaan kedua di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','C',1,'["A","B","C","D"]','2026-10-07 18:12:16');
INSERT INTO "attempt_question_snapshots" ("id","attempt_id","question_id","question_text","image_key","option_a","option_b","option_c","option_d","correct_option_key","display_position","display_option_order_json","created_at") VALUES('d3adf427-ed72-4078-b1bb-fcabd60934b1','934a81ae-cacf-4132-abd5-8d33a22c6a54','ac709e7b-4f60-43ad-ae97-5db4460e92e1','Tuliskan pertanyaan pertama di sini.',NULL,'Pilihan jawaban pertama','Pilihan jawaban kedua','Pilihan jawaban ketiga','Pilihan jawaban keempat','B',2,'["A","B","C","D"]','2026-10-07 18:12:16');
CREATE TABLE attempt_answers (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_original_option_key TEXT NOT NULL CHECK (
    selected_original_option_key IN ('A', 'B', 'C', 'D')
  ),
  correct_original_option_key TEXT NOT NULL CHECK (
    correct_original_option_key IN ('A', 'B', 'C', 'D')
  ),
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (attempt_id, question_id),
  FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT
) STRICT;
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('122c1327-5978-4fdc-bf62-d4edd5fc1f46','d4ff0ff4-f91c-4df6-9543-1686c07bd395','27554319-0fc9-4a04-bff9-4fe0426ed2a5','C','C',1,'2026-10-07 16:52:54');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('b40ae871-25f8-4bfc-a134-221c79e397ea','d4ff0ff4-f91c-4df6-9543-1686c07bd395','2f94eaf4-e40b-429e-a13e-44f622ce01ce','B','B',1,'2026-10-07 16:52:54');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('28591a65-a094-48f7-a94f-df94586cff5c','863033ee-aee2-409c-972c-efa9ae874d48','27554319-0fc9-4a04-bff9-4fe0426ed2a5','D','C',0,'2026-10-07 16:53:10');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('c3dac695-62e3-417e-8f53-d51334281318','863033ee-aee2-409c-972c-efa9ae874d48','2f94eaf4-e40b-429e-a13e-44f622ce01ce','D','B',0,'2026-10-07 16:53:10');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('de14aa48-f392-4a69-89d0-83d4258d2760','f225fdc6-4fe5-4ed8-b961-a63257e61dc8','27554319-0fc9-4a04-bff9-4fe0426ed2a5','A','C',0,'2026-10-07 17:01:20');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('b7a14eb5-456f-4313-95e8-64751bf53aa4','f225fdc6-4fe5-4ed8-b961-a63257e61dc8','2f94eaf4-e40b-429e-a13e-44f622ce01ce','A','B',0,'2026-10-07 17:01:20');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('b79b10dc-055a-4240-8c7c-45dfb0f59e55','636be42c-2aa0-4a90-aa5c-6097555fed19','27554319-0fc9-4a04-bff9-4fe0426ed2a5','B','C',0,'2026-10-07 17:01:29');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('fa979cd8-1ab9-4478-afc9-252af8273df4','636be42c-2aa0-4a90-aa5c-6097555fed19','2f94eaf4-e40b-429e-a13e-44f622ce01ce','B','B',1,'2026-10-07 17:01:29');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('1c656ede-9721-4a71-8436-2b1a0e3d5323','e22b7198-af3e-40f2-8d9f-d12485e492c1','27554319-0fc9-4a04-bff9-4fe0426ed2a5','C','C',1,'2026-10-07 17:23:53');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('71afd4d4-1613-4c18-a18e-959eccda26d6','e22b7198-af3e-40f2-8d9f-d12485e492c1','2f94eaf4-e40b-429e-a13e-44f622ce01ce','B','B',1,'2026-10-07 17:23:53');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('c84daed9-938a-428d-b0cb-823d0023efb6','9c5f4928-d423-421f-960a-8fa6093b1dc3','0870e49b-f416-410f-85cf-ec9c7f5b90c1','B','B',1,'2026-10-07 17:59:58');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('27065ca6-7864-4722-a6d7-68f24ef75d7e','9c5f4928-d423-421f-960a-8fa6093b1dc3','a5a76649-cc39-4ee9-8c76-a82f40655cb9','C','C',1,'2026-10-07 17:59:58');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('6f1dd408-aea8-4fb3-b64c-3713fd32c8ac','818fa2cf-e768-4691-aab5-d085676878b9','0870e49b-f416-410f-85cf-ec9c7f5b90c1','B','B',1,'2026-10-07 18:00:15');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('2fec3261-7be8-4412-b0cf-6b52932d3f42','818fa2cf-e768-4691-aab5-d085676878b9','a5a76649-cc39-4ee9-8c76-a82f40655cb9','C','C',1,'2026-10-07 18:00:15');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('fa54ea13-9afb-4cbe-aea5-d1cdb73af954','d7cd432d-3e5f-4535-8de1-510f9645f6cd','52d25ce7-45d7-4646-8ddc-5cf1e848e26f','C','C',1,'2026-10-07 18:01:38');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('da6669d1-5fd2-44e3-9d4f-dabb28e72bbd','d7cd432d-3e5f-4535-8de1-510f9645f6cd','c0b413d9-bb2f-4fa4-8cd3-125b65caded1','B','B',1,'2026-10-07 18:01:38');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('7e47a716-b8c7-4239-82c4-df7d3b153d56','1ce2bcdd-cd05-4049-a2ef-eb10af57ba17','52d25ce7-45d7-4646-8ddc-5cf1e848e26f','C','C',1,'2026-10-07 18:02:00');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('0e3bf207-1580-4c07-8784-fb5964b85ad3','1ce2bcdd-cd05-4049-a2ef-eb10af57ba17','c0b413d9-bb2f-4fa4-8cd3-125b65caded1','B','B',1,'2026-10-07 18:02:00');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('e6921777-82c0-433d-baff-453f3a8a850b','134ea828-689a-409a-9722-9ea218a1fe85','de1d390c-abfb-44b8-b40f-db6bbf59e5d5','C','B',0,'2026-10-07 18:05:51');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('5f3962e6-e08b-4016-b6c0-03b5de130baf','134ea828-689a-409a-9722-9ea218a1fe85','387d9dd5-be80-47d0-af56-f4b5e6008bdf','B','C',0,'2026-10-07 18:05:51');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('c1941f31-8622-4541-964e-235e36670812','3cdf3497-fa70-4a34-bb4b-a5f388144095','de1d390c-abfb-44b8-b40f-db6bbf59e5d5','C','B',0,'2026-10-07 18:06:08');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('1e6e3699-12a5-4378-a1ea-7a4f28b3d528','3cdf3497-fa70-4a34-bb4b-a5f388144095','387d9dd5-be80-47d0-af56-f4b5e6008bdf','B','C',0,'2026-10-07 18:06:08');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('7acde3d9-92f9-48aa-a426-d612a92e96b5','b1f68dc3-01a8-43cb-b3da-e0e08bfc2159','de1d390c-abfb-44b8-b40f-db6bbf59e5d5','B','B',1,'2026-10-07 18:06:17');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('5ebfd32d-4cd7-4aaf-b076-572a52ac37b6','b1f68dc3-01a8-43cb-b3da-e0e08bfc2159','387d9dd5-be80-47d0-af56-f4b5e6008bdf','C','C',1,'2026-10-07 18:06:17');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('6771871c-551e-473b-99e2-ecf6246c0b30','fca12d5d-990c-497d-be08-f0e06de7b0fa','f3ea3025-06ac-4894-87ea-b792b334fb0a','C','C',1,'2026-10-07 18:07:25');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('70d46136-5f03-4480-9c17-4a25bd74e4fd','fca12d5d-990c-497d-be08-f0e06de7b0fa','1824adb2-ba92-48c8-a941-bfd80463dc43','B','B',1,'2026-10-07 18:07:25');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('22238fa4-41a4-4e00-b38a-af2d023064b9','02f043a7-eaa3-42a9-8760-c353348da223','1824adb2-ba92-48c8-a941-bfd80463dc43','B','B',1,'2026-10-07 18:08:11');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('c46d5569-7d73-4700-b5c9-e742c8c097e4','02f043a7-eaa3-42a9-8760-c353348da223','f3ea3025-06ac-4894-87ea-b792b334fb0a','C','C',1,'2026-10-07 18:08:11');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('8e7a39ab-e560-4b6f-8b3c-817ffb0f7ab7','5f71a332-b33e-4df5-aef4-0fa1b2be628f','53f41547-a3c7-419f-aa7b-dc30c4428aa2','B','B',1,'2026-10-07 18:09:20');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('f378c0fb-bf7d-43ac-a28a-5cffb5cbd274','5f71a332-b33e-4df5-aef4-0fa1b2be628f','4d2e50ff-c711-4fa4-ab19-71a2b1a09c47','C','C',1,'2026-10-07 18:09:20');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('8bc59d62-3480-469e-8a27-52e4c2aba930','f8eb6286-2f39-4599-9f7c-9014b3d724c3','53f41547-a3c7-419f-aa7b-dc30c4428aa2','B','B',1,'2026-10-07 18:09:42');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('c99817a1-8f30-4b50-8e5d-5cf593d1454d','f8eb6286-2f39-4599-9f7c-9014b3d724c3','4d2e50ff-c711-4fa4-ab19-71a2b1a09c47','C','C',1,'2026-10-07 18:09:42');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('cc6d8125-d4c6-464b-853b-cb52233b15c8','9dc0bdbc-e0a8-4ee4-99b5-c95cd4d50713','3cc9b951-0171-4d5e-be48-09b0d129703e','C','C',1,'2026-10-07 18:10:51');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('613beee9-ef7a-4f53-a46a-b0afd425f436','9dc0bdbc-e0a8-4ee4-99b5-c95cd4d50713','21f7a501-30f3-43de-95be-ad2cbab27e6a','B','B',1,'2026-10-07 18:10:51');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('238ab8a8-fb37-4d8a-97dd-1ff8bbaa8a0c','7166b8ba-018c-41fa-a794-4114506b4f4b','21f7a501-30f3-43de-95be-ad2cbab27e6a','B','B',1,'2026-10-07 18:11:11');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('a10ea3c4-5330-4e4b-8762-4237655e3886','7166b8ba-018c-41fa-a794-4114506b4f4b','3cc9b951-0171-4d5e-be48-09b0d129703e','C','C',1,'2026-10-07 18:11:11');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('76869b2b-b2d5-4a0f-9602-3acb78967eae','fa2ed49c-49ac-4479-ad83-e58d5325d3de','2712bc1b-df66-49d7-b535-d0dc457267d8','C','C',1,'2026-10-07 18:12:09');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('5cad63f1-2da3-4864-a195-b61da069845f','fa2ed49c-49ac-4479-ad83-e58d5325d3de','ac709e7b-4f60-43ad-ae97-5db4460e92e1','B','B',1,'2026-10-07 18:12:09');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('e4e9a70f-4b11-4c5f-aa61-a4850d4d034e','934a81ae-cacf-4132-abd5-8d33a22c6a54','2712bc1b-df66-49d7-b535-d0dc457267d8','C','C',1,'2026-10-07 18:12:24');
INSERT INTO "attempt_answers" ("id","attempt_id","question_id","selected_original_option_key","correct_original_option_key","is_correct","created_at") VALUES('0f64ae38-b5fb-4ed3-862d-fc1d9e889c73','934a81ae-cacf-4132-abd5-8d33a22c6a54','ac709e7b-4f60-43ad-ae97-5db4460e92e1','B','B',1,'2026-10-07 18:12:24');
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) STRICT;
INSERT INTO "audit_logs" ("id","admin_id","action","entity_type","entity_id","metadata_json","created_at") VALUES('d68dfe73-5ed0-4979-8fea-5960d6e1092e','5114ac1f-82c7-44b5-8b41-7c821f1056b1','DELETE_TRAINING_SESSION','training_session','0c599747-3871-40ef-93fd-b365217fae1c','{"name":"Mengoperasikan Alat Shrink Fast/Gun","participants":0,"attempts":0,"answers":0}','2026-10-07 16:49:16');
INSERT INTO "audit_logs" ("id","admin_id","action","entity_type","entity_id","metadata_json","created_at") VALUES('288fff80-fd4b-4134-8150-58138fb9593b','5114ac1f-82c7-44b5-8b41-7c821f1056b1','ADJUST_FINAL_SCORE','attempt','636be42c-2aa0-4a90-aa5c-6097555fed19','{"participantId":"1b384658-0ac1-44fe-a711-9dbaa9b452e2","score":80.0}','2026-10-07 17:12:19');
CREATE TABLE trainings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
, is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1))) STRICT;
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('118efb5d-dffb-4d1f-9f4f-71f26c226a65','pelatihan 1',0,'2026-10-01 11:45:48','2026-10-01 11:46:04',1);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('7c50adc1-de75-4cc8-a857-dd79a6636155','pelatihan 1',0,'2026-10-01 11:45:51','2026-10-01 11:46:01',1);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('a136fba7-d2df-41b6-9f3c-a64a353af4a6','Politeknik Linux Community',0,'2026-10-01 11:47:12','2026-10-01 11:51:47',1);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('50e4a22c-0c0d-4918-b492-6de986f96918','pelatihan 1',0,'2026-10-01 11:51:56','2026-10-02 01:32:06',1);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','pelatihan 2',0,'2026-10-01 12:15:32','2026-10-02 01:32:04',1);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('b4d660c1-6d1d-4eff-8150-7334074c3628','Operator Backhoe Loader',1,'2026-10-02 01:32:51','2026-10-02 01:32:51',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('e7824acf-da25-4b8a-9244-8268e51c3d20','Pengoperasian Mesin Peralatan Boiler Kelapa Sawit',1,'2026-10-02 01:36:04','2026-10-02 01:36:04',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('4a6edf40-b67f-425f-92ba-51cf9bfe60f8','Pengoperasian Mesin Peralatan Clarification Kelapa Sawit',1,'2026-10-02 01:39:28','2026-10-02 01:39:28',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('cdfd39d6-5e4a-4aa3-bc88-88c95e5fdf42','Operator Dump Truck',1,'2026-10-02 01:44:23','2026-10-02 01:44:23',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('f6f9868f-27df-4892-bafc-638f8938a815','Pengoperasian Mesin Peralatan Effluent Treatment Plant Kelapa Sawit',1,'2026-10-02 01:48:28','2026-10-02 01:48:28',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('7a6808cc-532d-4723-a63c-1ec1ae2a56c1','Pengoperasian Mesin Peralatan Kernel Recovery Kelapa Sawit',1,'2026-10-02 01:50:35','2026-10-02 01:50:35',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('80585f2c-ae38-4af7-aa1a-18472545161d','Pengoperasian Mesin Peralatan Loading Ramp Kelapa Sawit',1,'2026-10-02 01:53:39','2026-10-02 01:53:39',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('709a8f9a-563a-4464-9532-5388e06aef3e','Pengoperasian Mesin Peralatan Lorry Filling Kelapa Sawit',1,'2026-10-02 03:30:52','2026-10-02 03:30:52',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('a422891b-cfad-4ba1-9ff3-157251e7f5c9','Pengoperasian Mesin Peralatan Lorry Filling Kelapa Sawit',0,'2026-10-02 03:31:09','2026-10-02 03:31:54',1);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('b03857eb-c749-475a-9dbe-07947ec9e31a','PEMROSESAN MAKANAN KERING DI INDUSTRI',1,'2026-10-02 03:38:35','2026-10-02 03:38:35',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('d650778a-2b01-48f4-8328-b8754055affd','Penimbangan Barang Kelapa Sawit',1,'2026-10-02 03:42:46','2026-10-02 03:42:46',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('eca6e4d4-e64f-4110-bb85-224a1d4ca8a1','Perencanaan Pengendalian Produksi Pabrik Minyak Kelapa Sawit',1,'2026-10-02 03:46:03','2026-10-02 03:46:03',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('de409591-9311-4bf9-ab55-f0ceee35689b','Plate Welding',1,'2026-10-02 03:47:41','2026-10-02 03:47:41',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('631f1b7e-caab-48c7-8dae-7c922cfe2e51','Penanggung Jawab Operasional Pengolahan Air Limbah',1,'2026-10-02 03:50:54','2026-10-02 03:50:54',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('4dd4b810-ecbf-4170-b2d9-9ef32bab8bec','Penanggung Jawab Operasional Instalasi Pengendalian Pencemaran Udara',1,'2026-10-02 03:55:49','2026-10-02 03:55:49',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('e2aed2c8-c8f8-4e97-8350-f17dcf79e438','Pengoperasian Mesin Peralatan Power Plant Kelapa Sawit',1,'2026-10-02 04:06:52','2026-10-02 04:06:52',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('87e8d887-e626-42c0-80e9-263c452f132d','Penanggung Jawab Pengendalian Pencemaran Air',1,'2026-10-02 04:12:36','2026-10-02 04:12:36',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('e94f11be-229c-4f19-9be5-3e701445f9fe','Penanggung Jawab Pengendalian Pencemaran Udara',1,'2026-10-02 04:15:44','2026-10-02 04:15:44',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('d3b67877-86c0-49b4-adc7-b3af86891524','Pengoperasian Mesin Peralatan Press Kelapa Sawit',1,'2026-10-02 04:18:53','2026-10-02 04:18:53',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('ac60027f-d544-4547-a984-440a298054b6','Pengoperasian Mesin Peralatan Sterilizer Kelapa Sawit',1,'2026-10-02 04:23:01','2026-10-02 04:23:01',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('a768abbb-72ac-4dc9-8da5-b3de375485bd','Pengoperasian Mesin Peralatan Tippler Kelapa Sawit',1,'2026-10-02 04:24:51','2026-10-02 04:24:51',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('76df0953-c211-4223-8742-0de0bd78757d','Pengoperasian Mesin Peralatan Transfer Carriage Kelapa Sawit',1,'2026-10-02 04:27:37','2026-10-02 04:27:37',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('105f060e-5a6a-4433-9a52-1fb36726d795','Welding Inspector Basic',1,'2026-10-02 04:30:49','2026-10-02 04:30:49',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('a8db6ba7-0559-4b8f-be49-64ba36179bd4','Pengoperasian Mesin Peralatan Water Treatment Plant Kelapa Sawit',1,'2026-10-02 06:34:53','2026-10-02 06:34:53',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('83978a8c-d1e0-4c7e-9d10-240d325b76e3','Pembuatan Minuman Berbahan Dasar Kopi',1,'2026-10-02 06:38:19','2026-10-02 06:38:19',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('6e0075b4-587c-493e-97bc-b8b77c86874f','Pengambilan Sampel Uji Laboratorium',1,'2026-10-02 06:52:34','2026-10-02 06:52:34',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('ac7912f9-b145-4eae-982b-de18085e2dc2','Pengoperasian Boiler',1,'2026-10-02 06:55:19','2026-10-02 06:55:19',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('e7810825-64c7-4073-ae60-79fd4ea2259c','Pengoperasian Forklift',1,'2026-10-02 07:03:28','2026-10-02 07:03:28',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('6c4f161e-45f9-4723-a814-50d8757b3282','Pengoperasian Mesin Produksi Industri Pangan',1,'2026-10-02 07:06:06','2026-10-02 07:06:06',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('ebb6a535-6775-4494-a1ad-1f611a4b3bc0','Pengoperasian Proses Basah Industri Crumb Rubber',1,'2026-10-02 07:08:18','2026-10-02 07:08:18',0);
INSERT INTO "trainings" ("id","name","is_active","created_at","updated_at","is_deleted") VALUES('912a3c82-030a-498a-94e7-1a1844b346bd','Pengoperasian Proses Kering Industri Crumb Rubber',1,'2026-10-02 07:12:04','2026-10-02 07:12:04',0);
CREATE TABLE training_materials (
  id TEXT PRIMARY KEY,
  training_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  jp INTEGER NOT NULL CHECK (jp > 0),
  sort_order INTEGER NOT NULL CHECK (sort_order > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, unit_code TEXT,
  UNIQUE (training_id, name),
  UNIQUE (training_id, sort_order),
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE RESTRICT
) STRICT;
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('5eefcd9c-3ff0-4e1b-bfcb-7fff8048e477','50e4a22c-0c0d-4918-b492-6de986f96918','Mengikuti Prosedur Kerja Menjaga Praktik Pengolahan yang Baik (GMP)',2,3,'2026-10-01 12:14:39','2026-10-01 12:14:39',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('398d281e-fb74-4a13-9a6b-41f77d3cfc7c','50e4a22c-0c0d-4918-b492-6de986f96918','Menerapkan Program dan Prosedur Keamanan Pangan',1,4,'2026-10-01 12:14:39','2026-10-01 12:14:39',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('73a96e1a-e4b5-4a48-84a2-b4237dd5b1d6','50e4a22c-0c0d-4918-b492-6de986f96918','Mengoperasikan Alat Timbang',5,5,'2026-10-01 12:14:39','2026-10-01 12:14:39',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('33c71b45-9512-47ce-bdea-fc8c9b9d82fc','50e4a22c-0c0d-4918-b492-6de986f96918','Mengoperasikan Mesin Pengaduk (Mixer)',7,6,'2026-10-01 12:14:39','2026-10-01 12:14:39',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('74545f30-adad-48ad-bfd4-cd97cde796f1','50e4a22c-0c0d-4918-b492-6de986f96918','Mengoperasikan Mesin Pencetak Adonan (Molder)',6,7,'2026-10-01 12:14:39','2026-10-01 12:14:39',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('6817f7b6-e7d5-4a79-b901-7df8d5ddd30f','50e4a22c-0c0d-4918-b492-6de986f96918','Mengoperasikan Mesin Pengeringan (Dryer)',8,8,'2026-10-01 12:14:39','2026-10-01 12:14:39',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('86d2b0b7-a2d0-43f9-a84b-513decd5c8bb','50e4a22c-0c0d-4918-b492-6de986f96918','Mengoperasikan Proses Pengemasan',4,9,'2026-10-01 12:14:39','2026-10-01 12:14:39',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('2d381a90-d9c6-4136-8c67-e86c92ecea21','50e4a22c-0c0d-4918-b492-6de986f96918','Mengoperasikan Proses Penyimpanan',4,10,'2026-10-01 12:14:39','2026-10-01 12:14:39',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('e332ced8-c459-4910-a3d3-54b52fc812e6','5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','Mengikuti Prosedur Kerja Menjaga Praktik Pengolahan yang Baik (GMP)',2,3,'2026-10-01 12:15:52','2026-10-01 12:15:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('7fd23c93-e30e-4650-b253-f251ff33ea6f','5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','Menerapkan Program dan Prosedur Keamanan Pangan',1,4,'2026-10-01 12:15:52','2026-10-01 12:15:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('4c983d36-4cdc-4f22-8395-ac2ef0bbb146','5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','Mengoperasikan Alat Timbang',5,5,'2026-10-01 12:15:52','2026-10-01 12:15:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('52d070eb-03f0-4336-8c7e-b40f3955c1e9','5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','Mengoperasikan Mesin Pengaduk (Mixer)',7,6,'2026-10-01 12:15:52','2026-10-01 12:15:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('d0240d6e-4a03-44fe-96d6-bfcb05d5c5ed','5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','Mengoperasikan Mesin Pencetak Adonan (Molder)',6,7,'2026-10-01 12:15:52','2026-10-01 12:15:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('d1d187df-4c41-468a-bda9-02060b2993a3','5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','Mengoperasikan Mesin Pengeringan (Dryer)',8,8,'2026-10-01 12:15:52','2026-10-01 12:15:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('be5f8ca8-53fb-48ad-b0a7-e74f14606951','5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','Mengoperasikan Proses Pengemasan',4,9,'2026-10-01 12:15:52','2026-10-01 12:15:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('406c0442-28b4-43ff-93c4-a80f836c677d','5cbe3ee2-227a-4065-b0e8-f5eba720fdb9','Mengoperasikan Proses Penyimpanan',4,10,'2026-10-01 12:15:52','2026-10-01 12:15:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('96b8d543-7a58-4d68-be7d-abc9575d20dc','b4d660c1-6d1d-4eff-8150-7334074c3628','Menerapkan Ketentuan Keselamatan dan Kesehatan Kerja (K3) dan Lingkungan Hidup di tempat kerja',1,1,'2026-10-02 01:34:23','2026-10-02 01:34:23',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('b61e1dba-b9d5-43e6-af6c-afbf2e8b39d2','b4d660c1-6d1d-4eff-8150-7334074c3628','Melakukan komunikasi dan kerjasama di tempat kerja',1,2,'2026-10-02 01:34:23','2026-10-02 01:34:23',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('ef24cf9f-b353-417a-823c-b7b67d00989a','b4d660c1-6d1d-4eff-8150-7334074c3628','Melakukan pemeliharaan harian backhoe loader sebelum operasi',1,3,'2026-10-02 01:34:23','2026-10-02 01:34:23',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('03b17c03-7df0-4d6b-9342-0744078f6d5b','b4d660c1-6d1d-4eff-8150-7334074c3628','Mengoperasikan attachment loader pada unit backhoe loader',1,4,'2026-10-02 01:34:23','2026-10-02 01:34:23',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('405bc7e8-30c5-49f2-b41c-e835cad8ba8d','b4d660c1-6d1d-4eff-8150-7334074c3628','Mengoperasikan attachment backhoe pada unit backhoe loader',1,5,'2026-10-02 01:34:23','2026-10-02 01:34:23',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('029a0b9c-dd58-46f8-9b36-4273dc47731b','b4d660c1-6d1d-4eff-8150-7334074c3628','Menaikkan dan menurunkan unit backhoe loader ke / dari atas truk trailer',1,6,'2026-10-02 01:34:23','2026-10-02 01:34:23',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('3e929e71-5255-4e5d-81a1-3c7d5bf65922','b4d660c1-6d1d-4eff-8150-7334074c3628','Melaksanakan pemeliharaan harian backhoe loader setelah operasi',1,7,'2026-10-02 01:34:23','2026-10-02 01:34:23',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('1f321a3b-cd04-45d4-b804-5f526fab0e87','b4d660c1-6d1d-4eff-8150-7334074c3628','Membuat Laporan Harian Operasi',1,8,'2026-10-02 01:34:23','2026-10-02 01:34:23',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('7d5d5a0f-6dff-4424-9c6c-146ccb48389d','e7824acf-da25-4b8a-9244-8268e51c3d20','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 01:37:36','2026-10-02 01:37:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('753be19d-09ba-4804-a8da-21bb3a61cc7f','e7824acf-da25-4b8a-9244-8268e51c3d20','Mengoperasikan Mesin dan Peralatan di Stasiun Boiler',1,2,'2026-10-02 01:37:36','2026-10-02 01:37:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('8939e1db-818d-4935-a648-519ff31efbb4','4a6edf40-b67f-425f-92ba-51cf9bfe60f8','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 01:41:58','2026-10-02 01:41:58',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('3bc7a761-aa9f-4e3f-92f3-3259b00f8455','4a6edf40-b67f-425f-92ba-51cf9bfe60f8','Mengoperasikan Mesin dan Peralatan di Stasiun Klarifikasi',1,2,'2026-10-02 01:41:58','2026-10-02 01:41:58',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('41316a71-9272-47a7-bb2a-75bee91e4cda','cdfd39d6-5e4a-4aa3-bc88-88c95e5fdf42','Menerapkan Ketentuan Keselamatan dan Kesehatan Kerja serta Lingkungan dalam Pengoperasian Dump Truck',1,1,'2026-10-02 01:45:29','2026-10-02 01:45:29',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('f053e57f-36de-4852-b5a5-8ceeb1cb1115','cdfd39d6-5e4a-4aa3-bc88-88c95e5fdf42','Melakukan Komunikasi dan Kerjasama di Tempat Kerja',1,2,'2026-10-02 01:45:29','2026-10-02 01:45:29',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('f35a289e-7c2e-4465-b147-430df3ec0d13','cdfd39d6-5e4a-4aa3-bc88-88c95e5fdf42','Melakukan Pemeliharaan Harian Dump Truck',1,3,'2026-10-02 01:45:29','2026-10-02 01:45:29',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('6af84878-ddf2-42e7-8ee6-7863eb759d56','cdfd39d6-5e4a-4aa3-bc88-88c95e5fdf42','Melakukan Persiapan Pengoperasian Dump Truck',1,4,'2026-10-02 01:45:29','2026-10-02 01:45:29',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('600be252-0c73-40bf-b286-7dcdb43e94ee','cdfd39d6-5e4a-4aa3-bc88-88c95e5fdf42','Mengoperasikan Dump Truck Sesuai dengan Prosedur',1,5,'2026-10-02 01:45:29','2026-10-02 01:45:29',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('0c4d0662-fa15-4b9f-a25e-72841188eec3','cdfd39d6-5e4a-4aa3-bc88-88c95e5fdf42','Melakukan Pemeliharaan setelah Selesai Pengoperasian Dump Truck',1,6,'2026-10-02 01:45:29','2026-10-02 01:45:29',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('c9107a00-5ae1-4515-825b-1c8b9eeeb623','f6f9868f-27df-4892-bafc-638f8938a815','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 01:48:52','2026-10-02 01:48:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('c9541431-d781-4932-b6bb-22426c50804e','f6f9868f-27df-4892-bafc-638f8938a815','Mengoperasikan Mesin dan Peralatan di Stasiun Effluent Treatment Plant',1,2,'2026-10-02 01:48:52','2026-10-02 01:48:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('597a25d1-398f-4196-a083-c874001719b8','7a6808cc-532d-4723-a63c-1ec1ae2a56c1','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 01:51:22','2026-10-02 01:51:22',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('dfc79be7-774a-4106-a305-f0c23b93168e','7a6808cc-532d-4723-a63c-1ec1ae2a56c1','Mengoperasikan Mesin dan Peralatan di Stasiun Kernel Recovery',1,2,'2026-10-02 01:51:22','2026-10-02 01:51:22',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('d2bdc6f8-d09a-4e52-9679-126434f4221b','80585f2c-ae38-4af7-aa1a-18472545161d','Menerapkan Prinsip-prinsip K3 di Tempat Kerja',1,1,'2026-10-02 03:26:22','2026-10-02 03:26:22',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('b2080eb1-ebd6-43e8-9af8-b09fd12c6107','80585f2c-ae38-4af7-aa1a-18472545161d','Mengoperasikan Mesin dan Peralatan Loading Ramp',1,2,'2026-10-02 03:26:22','2026-10-02 03:26:22',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('a988ce62-ed9c-47ef-a39c-306d7426891c','709a8f9a-563a-4464-9532-5388e06aef3e','Menerapkan Prinsip-prinsip K3 di Tempat Kerja',1,1,'2026-10-02 03:33:09','2026-10-02 03:33:09',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('a98b9c13-bb21-4342-bb06-62f2423dbc32','709a8f9a-563a-4464-9532-5388e06aef3e','Mengoperasikan Mesin dan Peralatan di Area Pengisian Lori',1,2,'2026-10-02 03:33:09','2026-10-02 03:33:09',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('46804960-508d-4fa6-97ee-e093819ef814','b03857eb-c749-475a-9dbe-07947ec9e31a','Mengkomunikasikan Informasi Tempat Kerja',1,1,'2026-10-02 03:39:52','2026-10-02 03:39:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('a365f5f0-7d19-4dd4-9f30-f66067692bf1','b03857eb-c749-475a-9dbe-07947ec9e31a','Mengikuti Prosedur Kerja dan Menjaga Praktik Pengolahan Yang baik (GMP)',2,2,'2026-10-02 03:39:52','2026-10-02 03:39:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('33f44889-957e-469a-b925-da13604453bb','b03857eb-c749-475a-9dbe-07947ec9e31a','Menerapkan Sistem dan Prosedur Keselamatan Dan Kesehatan (K3)',3,3,'2026-10-02 03:39:52','2026-10-02 03:39:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('14bc669d-dfb3-43a5-b198-fb079161f8c7','b03857eb-c749-475a-9dbe-07947ec9e31a','Mengikuti Prosedur Kerja Menjaga Kemanan Pangan',4,4,'2026-10-02 03:39:52','2026-10-02 03:39:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('f6e809c6-e372-4600-95b2-dc81189543e0','b03857eb-c749-475a-9dbe-07947ec9e31a','Menerapkan Program dan Prosedur Keamanan Pangan',5,5,'2026-10-02 03:39:52','2026-10-02 03:39:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('efac6dce-f024-4f87-b3bf-079ca8019989','b03857eb-c749-475a-9dbe-07947ec9e31a','Mengidentifikasikan Bahan/Komuditas Non Curai',6,6,'2026-10-02 03:39:52','2026-10-02 03:39:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('82641abd-244a-4417-9321-5fa9018a9f3d','b03857eb-c749-475a-9dbe-07947ec9e31a','Mengemas dan Menyimpan Bahan',7,7,'2026-10-02 03:39:52','2026-10-02 03:39:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('753d4cff-9827-471b-adff-a90e993addd5','b03857eb-c749-475a-9dbe-07947ec9e31a','Mengoperasikan Proses Pengeringan',8,8,'2026-10-02 03:39:52','2026-10-02 03:39:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('9268b22f-ded1-47cf-ac5a-860c6220f9d3','b03857eb-c749-475a-9dbe-07947ec9e31a','Mencampur Bahan Kering',9,9,'2026-10-02 03:39:52','2026-10-02 03:39:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('07f1b40c-a1b1-44b5-a86f-dada0a52bf00','b03857eb-c749-475a-9dbe-07947ec9e31a','Memilih Bahan, Cara dan Peralatan Pencampuran.',10,10,'2026-10-02 03:39:52','2026-10-02 03:39:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('4acf84d8-fa3e-49d8-9d14-a52d0ce831ba','b03857eb-c749-475a-9dbe-07947ec9e31a','Mengoperasikan Proses Penyimpanan',11,11,'2026-10-02 03:39:52','2026-10-02 03:39:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('874967c7-c3d5-4e4b-8df9-77d57ae5d144','d650778a-2b01-48f4-8328-b8754055affd','Menerapkan Prinsip-prinsip K3 di Tempat Kerja',1,1,'2026-10-02 03:43:43','2026-10-02 03:43:43',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('059f7f7f-a415-493f-9e24-aba264c7e84a','d650778a-2b01-48f4-8328-b8754055affd','Melakukan Penimbangan Barang',2,2,'2026-10-02 03:43:43','2026-10-02 03:43:43',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('4bf1d16e-6377-4d43-bf22-3887ee28c9e1','d650778a-2b01-48f4-8328-b8754055affd','Melakukan Penyusunan Data Hasil Penimbangan Barang',3,3,'2026-10-02 03:43:43','2026-10-02 03:43:43',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('86b47836-6b73-4863-a873-3e699b02215e','eca6e4d4-e64f-4110-bb85-224a1d4ca8a1','Menyusun draft estimasi biaya proses',1,1,'2026-10-02 03:46:41','2026-10-02 03:46:41',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('4ed90bed-e595-4099-9f5f-a5c1e8d73bd3','eca6e4d4-e64f-4110-bb85-224a1d4ca8a1','Menyusun rencana kerja di pabrik',2,2,'2026-10-02 03:46:41','2026-10-02 03:46:41',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('670ac3fc-65e0-45a3-ac54-a1118d527c07','eca6e4d4-e64f-4110-bb85-224a1d4ca8a1','Melakukan Pengaturan Pekerjaan Process Foreman dan/atau Operator',3,3,'2026-10-02 03:46:41','2026-10-02 03:46:41',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('213bb4b5-7382-47d3-b96f-92facfa09fb1','eca6e4d4-e64f-4110-bb85-224a1d4ca8a1','Merencanakan Pengaturan Kerja Lembur Operator',4,4,'2026-10-02 03:46:41','2026-10-02 03:46:41',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('ea7b3df3-ad68-4d21-aea6-f6bdbfbe903e','eca6e4d4-e64f-4110-bb85-224a1d4ca8a1','Mengawasi losses dan mutu produk',5,5,'2026-10-02 03:46:41','2026-10-02 03:46:41',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('10af830e-0dc3-4d7a-a703-ab8071462d6c','eca6e4d4-e64f-4110-bb85-224a1d4ca8a1','Mengendalikan kinerja (biaya produksi dan biaya-biaya lain yang berkaitan dengan) proses produksi',6,6,'2026-10-02 03:46:41','2026-10-02 03:46:41',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('6267b71d-a98c-4492-a973-0fc1f7e3cfd6','eca6e4d4-e64f-4110-bb85-224a1d4ca8a1','Melakukan troubleshooting atas masalah yang mengganggu kelancaran proses',7,7,'2026-10-02 03:46:41','2026-10-02 03:46:41',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('b2c4db66-9176-46dd-a9bc-a1365753641b','de409591-9311-4bf9-ab55-f0ceee35689b','Melaksanakan persiapan tempat kerja',1,1,'2026-10-02 03:48:48','2026-10-02 03:48:48',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('4235c6df-33f5-4ce2-8768-9c7cabea5fb7','de409591-9311-4bf9-ab55-f0ceee35689b','Memperbaiki hasil pengelasan',2,2,'2026-10-02 03:48:48','2026-10-02 03:48:48',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('c8e95258-6d2e-44a2-bc11-cb86ec5cc546','de409591-9311-4bf9-ab55-f0ceee35689b','Membuat sambungan las kampuh (groove) sesuai wps untuk pengelasan pelat ke pelat dan sesuai dengan proses las yang digunakan',3,3,'2026-10-02 03:48:48','2026-10-02 03:48:48',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('96d974f5-3387-4e4f-a77d-b997d77193a3','631f1b7e-caab-48c7-8dae-7c922cfe2e51','Mengoperasikan Instalasi Pengolahan Air Limbah (IPAL)',1,1,'2026-10-02 03:51:49','2026-10-02 03:51:49',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('4e4fdbf4-38a8-467c-9d17-42cf447e49ef','631f1b7e-caab-48c7-8dae-7c922cfe2e51','Menilai Tingkat Pencemaran Air Limbah',2,2,'2026-10-02 03:51:49','2026-10-02 03:51:49',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('5a824feb-0f56-41f7-9ae7-a8210f342b93','631f1b7e-caab-48c7-8dae-7c922cfe2e51','Melakukan Perawatan Instalasi Pengolahan Air Limbah (IPAL)',3,3,'2026-10-02 03:51:49','2026-10-02 03:51:49',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('b65a6287-9b11-4189-85f0-6da7a332043e','631f1b7e-caab-48c7-8dae-7c922cfe2e51','Mengidentifikasi Bahaya Dalam Pengolahan Air Limbah',4,4,'2026-10-02 03:51:49','2026-10-02 03:51:49',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('ba11b2df-117c-41df-94d1-4d01ca8c9954','631f1b7e-caab-48c7-8dae-7c922cfe2e51','Melakukan Tindakan Keselamatan Dan Kesehatan Kerja (K3) Terhadap Bahaya Dalam Pengolahan Air Limbah',5,5,'2026-10-02 03:51:49','2026-10-02 03:51:49',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('92c1d6bc-fd76-42a0-829a-9e9563c1e92f','4dd4b810-ecbf-4170-b2d9-9ef32bab8bec','Mengoperasikan Alat Pengendali Pencemaran Udara dari Emisi',1,1,'2026-10-02 03:57:28','2026-10-02 03:57:28',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('43518268-597a-4f9e-8f59-a7dc0c66a608','4dd4b810-ecbf-4170-b2d9-9ef32bab8bec','Melakukan Perawatan Peralatan Pengendali Pencemaran Udara',2,2,'2026-10-02 03:57:28','2026-10-02 03:57:28',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('7a251456-6168-4918-a384-643c078185e5','4dd4b810-ecbf-4170-b2d9-9ef32bab8bec','Menilai Tingkat Pencemaran Udara dari Emisi',3,3,'2026-10-02 03:57:28','2026-10-02 03:57:28',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('cee8eb6b-360a-4897-99ff-6349952cfecf','4dd4b810-ecbf-4170-b2d9-9ef32bab8bec','Mengidentifikasi Bahaya Dalam Pengendalian Pencemaran Udara dari Emisi',4,4,'2026-10-02 03:57:28','2026-10-02 03:57:28',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('22888147-1792-4099-af06-705d03cd86f7','4dd4b810-ecbf-4170-b2d9-9ef32bab8bec','Melakukan Tindakan K3 Terhadap Bahaya dalam Pengendalian Pencemaran Udara dari Emisi',5,5,'2026-10-02 03:57:28','2026-10-02 03:57:28',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('355342ea-751e-4c03-bc39-b5908d69df11','e2aed2c8-c8f8-4e97-8350-f17dcf79e438','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 04:08:47','2026-10-02 04:08:47',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('8d6d7a3c-0217-4dbb-a4d9-afc8b6318755','e2aed2c8-c8f8-4e97-8350-f17dcf79e438','Mengoperasikan Mesin dan Peralatan di Stasiun Power Plant',2,2,'2026-10-02 04:08:47','2026-10-02 04:08:47',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('16b7737c-24e5-4ee7-bbe5-2baa5de80ae8','87e8d887-e626-42c0-80e9-263c452f132d','Mengidentifikasi Sumber Pencemaran Air Limbah',1,1,'2026-10-02 04:13:36','2026-10-02 04:13:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('00f06ef8-4c4c-4ada-bfef-ab95dd32f062','87e8d887-e626-42c0-80e9-263c452f132d','Menentukan Karakteristik Sumber Pencemaran Air Limbah',2,2,'2026-10-02 04:13:36','2026-10-02 04:13:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('03cbef26-423b-46f4-8dd2-8a6a89f38240','87e8d887-e626-42c0-80e9-263c452f132d','Menilai Tingkat Pencemaran Air Limbah',3,3,'2026-10-02 04:13:36','2026-10-02 04:13:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('e202d714-e71b-4bbf-a8c0-93dc34a0b7f6','87e8d887-e626-42c0-80e9-263c452f132d','Menentukan Peralatan Instalasi Pengolahan Air Limbah (IPAL)',4,4,'2026-10-02 04:13:36','2026-10-02 04:13:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('0bc4f187-9cf4-4c85-b25b-c960718f1bb4','87e8d887-e626-42c0-80e9-263c452f132d','Mengoperasikan Instalasi Pengolahan Air Limbah (IPAL)',5,5,'2026-10-02 04:13:36','2026-10-02 04:13:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('2bfd1749-9f93-451e-8310-5d10c7ab1adf','87e8d887-e626-42c0-80e9-263c452f132d','Melaksanakan Daur Ulang Olahan Air Limbah',6,6,'2026-10-02 04:13:36','2026-10-02 04:13:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('e947191e-fecb-452a-b8a9-c4b35120f7c9','87e8d887-e626-42c0-80e9-263c452f132d','Menyusun Rencana Pemantauan Kualitas Air Limbah',7,7,'2026-10-02 04:13:36','2026-10-02 04:13:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('2a977ca8-6442-4411-879f-c10d8e90d005','87e8d887-e626-42c0-80e9-263c452f132d','Melaksanakan Pemantauan Kualitas Air Limbah',8,8,'2026-10-02 04:13:36','2026-10-02 04:13:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('21646518-da29-4d9f-85c3-2d7cffde539e','87e8d887-e626-42c0-80e9-263c452f132d','Mengidentifikasi Bahaya Dalam Pengolahan Air Limbah',9,9,'2026-10-02 04:13:36','2026-10-02 04:13:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('bbda473e-1d96-4033-9579-3dffb78587a5','87e8d887-e626-42c0-80e9-263c452f132d','Melakukan Tindakan Keselamatan Dan Kesehatan Kerja (K3) Terhadap Bahaya Dalam Pengolahan Air Limbah',10,10,'2026-10-02 04:13:36','2026-10-02 04:13:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('e5a54597-b9ff-48a7-878c-f70c37e6d846','e94f11be-229c-4f19-9be5-3e701445f9fe','Mengidentifikasi sumber pencemar udara dari emisi',1,1,'2026-10-02 04:16:43','2026-10-02 04:16:43',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('1fc8f63a-6ff7-4be2-8511-cd4575d70d3e','e94f11be-229c-4f19-9be5-3e701445f9fe','Menentukan karakteristik sumber pencemar udara dari emisi',2,2,'2026-10-02 04:16:43','2026-10-02 04:16:43',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('6c7d3227-f6bc-4a06-9aa5-6515f9af85ab','e94f11be-229c-4f19-9be5-3e701445f9fe','Menilai tingkat pencemaran udara dari emisi',3,3,'2026-10-02 04:16:43','2026-10-02 04:16:43',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('ea925b62-c6bb-4464-b9f5-48a187ae2344','e94f11be-229c-4f19-9be5-3e701445f9fe','Melaksanakan pengendalian pencemaran udara dari emisi',4,4,'2026-10-02 04:16:43','2026-10-02 04:16:43',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('4df94ed1-738e-4ea4-ad56-1746ceaad7f7','e94f11be-229c-4f19-9be5-3e701445f9fe','Menentukan peralatan pengendali pencemaran udara dari emisi',5,5,'2026-10-02 04:16:43','2026-10-02 04:16:43',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('ec3ce988-6762-46ea-8cde-5aa886a324c0','e94f11be-229c-4f19-9be5-3e701445f9fe','Mengoperasikan alat pengendali pencemaran udara dari emisi',6,6,'2026-10-02 04:16:43','2026-10-02 04:16:43',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('016d6076-7d03-427a-8b69-535bd16e3569','e94f11be-229c-4f19-9be5-3e701445f9fe','Menyusun rencana pemantauan pencemaran udara dari emisi',7,7,'2026-10-02 04:16:43','2026-10-02 04:16:43',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('52ee8870-01a4-4d2b-9f05-2486bdf964c2','e94f11be-229c-4f19-9be5-3e701445f9fe','Melaksanakan pemantauan pencemaran udara dari emisi',8,8,'2026-10-02 04:16:43','2026-10-02 04:16:43',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('93788ccd-277d-40d7-be82-b6077e423611','e94f11be-229c-4f19-9be5-3e701445f9fe','Mengidentifikasi bahaya dalam pengendalian pencemaran udara dari emisi',9,9,'2026-10-02 04:16:43','2026-10-02 04:16:43',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('27dc8c5a-b478-4286-a386-4269983b1538','e94f11be-229c-4f19-9be5-3e701445f9fe','Melakukan tindakan K3 terhadap bahaya dalam pengendalian pencemaran udara dari emisi',10,10,'2026-10-02 04:16:43','2026-10-02 04:16:43',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('1707fe35-187c-468b-b447-6e6afa804535','d3b67877-86c0-49b4-adc7-b3af86891524','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 04:19:52','2026-10-02 04:19:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('6c4fbd76-c054-4403-bb39-e41c7d39df4a','d3b67877-86c0-49b4-adc7-b3af86891524','Mengoperasikan Mesin dan Peralatan di Stasiun Press',2,2,'2026-10-02 04:19:52','2026-10-02 04:19:52',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('691e4477-5b30-4d1a-b12b-35cd6d426bec','ac60027f-d544-4547-a984-440a298054b6','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 04:23:39','2026-10-02 04:23:39',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('58e51bc8-78b2-4e40-9851-c85f57196db8','ac60027f-d544-4547-a984-440a298054b6','Mengoperasikan Mesin dan Peralatan di Stasiun Sterilizer',2,2,'2026-10-02 04:23:39','2026-10-02 04:23:39',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('5c8f53ea-2ef8-43a2-b72f-621238ee231b','a768abbb-72ac-4dc9-8da5-b3de375485bd','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 04:26:01','2026-10-02 04:26:01',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('b36d5e03-3c46-479a-883e-df780254dc14','a768abbb-72ac-4dc9-8da5-b3de375485bd','Mengoperasikan Mesin dan Peralatan di Area Tippler',2,2,'2026-10-02 04:26:01','2026-10-02 04:26:01',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('749966d9-4fde-49e1-8a29-5a8ee68b957a','76df0953-c211-4223-8742-0de0bd78757d','Menerapkan Prinsip-prinsip K3 di Tempat Kerja',1,1,'2026-10-02 04:28:23','2026-10-02 04:28:23',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('1867244b-3886-428a-8124-a82007090160','76df0953-c211-4223-8742-0de0bd78757d','Mengoperasikan Mesin dan Peralatan Transfer Carriage',2,2,'2026-10-02 04:28:23','2026-10-02 04:28:23',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('ce35a978-83d1-4639-b776-f3357998787b','105f060e-5a6a-4433-9a52-1fb36726d795','Melaksanakan persiapan tempat kerja',1,1,'2026-10-02 04:31:59','2026-10-02 04:31:59',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('5a882aac-3463-47a5-b141-d62e28c5ea01','105f060e-5a6a-4433-9a52-1fb36726d795','Melakukan peran serta (contribute) pada sistem mutu',2,2,'2026-10-02 04:31:59','2026-10-02 04:31:59',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('a8fd457a-6249-46bb-b03a-5c6c1a66191a','105f060e-5a6a-4433-9a52-1fb36726d795','Melakukan inspeksi visual pengelasan',3,3,'2026-10-02 04:31:59','2026-10-02 04:31:59',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('cc30cb65-f20b-4518-a09e-64c08f2e82d9','105f060e-5a6a-4433-9a52-1fb36726d795','Melakukan penetrant test (PT)',4,4,'2026-10-02 04:31:59','2026-10-02 04:31:59',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('e6c9eee2-9242-4540-bbee-92aff9b0ae8d','105f060e-5a6a-4433-9a52-1fb36726d795','Melakukan magnetic particle test (MT)',5,5,'2026-10-02 04:31:59','2026-10-02 04:31:59',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('96b6c006-f257-4836-85e7-72c485bd5539','a8db6ba7-0559-4b8f-be49-64ba36179bd4','Menerapkan Prinsip-Prinsip K3 di Tempat Kerja',1,1,'2026-10-02 06:36:00','2026-10-02 06:36:00',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('703f58c0-6695-4d0f-a0aa-b3b59222be65','a8db6ba7-0559-4b8f-be49-64ba36179bd4','Mengoperasikan Mesin dan Peralatan di Stasiun Water Treatment Plant',2,2,'2026-10-02 06:36:00','2026-10-02 06:36:00',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('de1f3105-7be9-4e76-8083-f72a2bbc3d94','83978a8c-d1e0-4c7e-9d10-240d325b76e3','Menyiapkan Bahan Baku Minuman Berbahan Dasar Kopi',1,1,'2026-10-02 06:40:37','2026-10-02 06:40:37',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('d1f26f8c-3137-4949-a44e-b44a96a6c8b8','83978a8c-d1e0-4c7e-9d10-240d325b76e3','Menyiapkan Peralatan dan Perlengkapan Pembuatan Minuman Berbahan Dasar Kopi',2,2,'2026-10-02 06:40:37','2026-10-02 06:40:37',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('33b088fa-c508-47bf-8cab-47fd68366bc8','83978a8c-d1e0-4c7e-9d10-240d325b76e3','Menyiapkan Area Pelayanan',3,3,'2026-10-02 06:40:37','2026-10-02 06:40:37',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('ca3efcc3-3099-43f6-8d13-cbd0942f5b4b','83978a8c-d1e0-4c7e-9d10-240d325b76e3','Melayani Pelanggan',4,4,'2026-10-02 06:40:37','2026-10-02 06:40:37',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('cabc6e85-96ca-404e-9c0d-5b9af92a4ecc','83978a8c-d1e0-4c7e-9d10-240d325b76e3','Membuat Minuman Kopi Menggunakan Mesin',5,5,'2026-10-02 06:40:37','2026-10-02 06:40:37',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('669d09f2-e9b5-4018-a1b4-20605c17c18f','83978a8c-d1e0-4c7e-9d10-240d325b76e3','Membuat Minuman Kopi Menggunakan Peralatan Manual',6,6,'2026-10-02 06:40:37','2026-10-02 06:40:37',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('2ed5288b-ca0c-4a39-93c3-d8972d64f336','83978a8c-d1e0-4c7e-9d10-240d325b76e3','Memutakhirkan Pengetahuan tentang Produk Minuman dan Pelayanan',7,7,'2026-10-02 06:40:37','2026-10-02 06:40:37',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('24917a1b-3e74-4eb6-9c31-88e2910f7e62','6e0075b4-587c-493e-97bc-b8b77c86874f','Bekerja dalam suatu laboratorium/lingkungan kerja (pengenalan)',1,1,'2026-10-02 06:53:17','2026-10-02 06:53:17',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('9c4c47db-75e0-49cc-9263-0e20507039fc','6e0075b4-587c-493e-97bc-b8b77c86874f','Berkomunikasi dengan orang lain',2,2,'2026-10-02 06:53:17','2026-10-02 06:53:17',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('d80480f4-fbe2-486c-8c51-022f2c421ef2','6e0075b4-587c-493e-97bc-b8b77c86874f','Merekam dan menyajikan data',3,3,'2026-10-02 06:53:17','2026-10-02 06:53:17',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('9694ecbc-f6d9-47ed-9488-56dba8c23c60','6e0075b4-587c-493e-97bc-b8b77c86874f','Berpartisipasi dalam keselamatan kerja di laboratorium/ lingkungan kerja',4,4,'2026-10-02 06:53:17','2026-10-02 06:53:17',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('666562f7-bfcd-45a4-81da-64c31f7528bd','6e0075b4-587c-493e-97bc-b8b77c86874f','Mengambil contoh di lokasi secara rutin',5,5,'2026-10-02 06:53:17','2026-10-02 06:53:17',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('a0a201b4-cd36-4de8-88d8-5f7af7fd21b1','6e0075b4-587c-493e-97bc-b8b77c86874f','Menangani dan mengangkut contoh atau peralatan',6,6,'2026-10-02 06:53:17','2026-10-02 06:53:17',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('06e741ef-9ba4-4fee-bc45-af9aa7e2a848','6e0075b4-587c-493e-97bc-b8b77c86874f','Melakukan pengukuran rutin di lokasi',7,7,'2026-10-02 06:53:17','2026-10-02 06:53:17',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('c2fa4ba1-cb87-44c2-ba47-61923bc6d7f0','ac7912f9-b145-4eae-982b-de18085e2dc2','Menyiapkan Operasi Boiler',1,1,'2026-10-02 06:56:13','2026-10-02 06:56:13',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('c59c25d4-ed3b-4411-8a4c-ab9a68e123ca','ac7912f9-b145-4eae-982b-de18085e2dc2','Mengoperasikan Boiler',2,2,'2026-10-02 06:56:13','2026-10-02 06:56:13',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('941be3fc-652c-42af-84a1-de6c17993f47','ac7912f9-b145-4eae-982b-de18085e2dc2','Mengawasi Operasi Boiler',3,3,'2026-10-02 06:56:13','2026-10-02 06:56:13',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('694e0b91-d7d5-4027-b12e-7fadd68da040','ac7912f9-b145-4eae-982b-de18085e2dc2','Melakukan Pengawasan Kegiatan Operasional Boiler',4,4,'2026-10-02 06:56:13','2026-10-02 06:56:13',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('97e42413-e8d4-45b9-96eb-3294bad211d6','ac7912f9-b145-4eae-982b-de18085e2dc2','Menanggulangi Gangguan Operasi Boiler',5,5,'2026-10-02 06:56:13','2026-10-02 06:56:13',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('49717676-b378-401b-845c-927b103841ec','ac7912f9-b145-4eae-982b-de18085e2dc2','Melakukan Evaluasi Operasi Boiler',6,6,'2026-10-02 06:56:13','2026-10-02 06:56:13',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('b589ff18-dcfd-4ea1-8886-5b332912c8e4','e7810825-64c7-4073-ae60-79fd4ea2259c','Menerapkan Keselamatan Kerja di Tempat Kerja',1,1,'2026-10-02 07:04:36','2026-10-02 07:04:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('ffa2b2f4-7358-405b-b619-ee4904fc58c4','e7810825-64c7-4073-ae60-79fd4ea2259c','Mempersiapkan Operasi Forklift',2,2,'2026-10-02 07:04:36','2026-10-02 07:04:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('e93ca093-7d1c-4425-ae20-4c1126cc06de','e7810825-64c7-4073-ae60-79fd4ea2259c','Mengoperasikan Forklift',3,3,'2026-10-02 07:04:36','2026-10-02 07:04:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('fb027100-cd30-49e3-8bf9-ba211bf705da','e7810825-64c7-4073-ae60-79fd4ea2259c','Mengendalikan Beban',4,4,'2026-10-02 07:04:36','2026-10-02 07:04:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('18170434-e960-4797-bd43-728ab7dec99b','e7810825-64c7-4073-ae60-79fd4ea2259c','Membuat Laporan Operasi Forklift',5,5,'2026-10-02 07:04:36','2026-10-02 07:04:36',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('d7fded8d-c846-4bb5-bdfc-04117e16ac9c','6c4f161e-45f9-4723-a814-50d8757b3282','Mengkomunikasikan Informasi Tempat Kerja',1,1,'2026-10-02 07:06:47','2026-10-02 07:06:47',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('96acb6bf-c70b-4b08-8809-6d3067445525','6c4f161e-45f9-4723-a814-50d8757b3282','Mengikuti Prosedur Menjaga Kesehatan dan Keselamatan Kerja (K3)',2,2,'2026-10-02 07:06:47','2026-10-02 07:06:47',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('a34d874d-6448-45ff-adb6-94ec8b209dd0','6c4f161e-45f9-4723-a814-50d8757b3282','Mengikuti Prosedur Kerja Menjaga Praktik Pengolahan yang Baik (GMP)',3,3,'2026-10-02 07:06:47','2026-10-02 07:06:47',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('2dea7a6c-f535-452d-b98c-2f5ec9685902','6c4f161e-45f9-4723-a814-50d8757b3282','Menerapkan Program dan Prosedur Keamanan Pangan',4,4,'2026-10-02 07:06:47','2026-10-02 07:06:47',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('1d1d994e-0cdf-4105-8ec3-cc442f8bba5b','6c4f161e-45f9-4723-a814-50d8757b3282','Mengoperasikan Alat Timbang',5,5,'2026-10-02 07:06:47','2026-10-02 07:06:47',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('6c652d51-46cb-47f6-84e3-eb987b3fadbe','6c4f161e-45f9-4723-a814-50d8757b3282','Mengoperasikan Mesin Pengaduk (Mixer)',6,6,'2026-10-02 07:06:47','2026-10-02 07:06:47',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('4f1cc387-ccc7-4a98-ace2-539464f34a20','6c4f161e-45f9-4723-a814-50d8757b3282','Mengoperasikan Mesin Pencetak Adonan (Molder)',7,7,'2026-10-02 07:06:47','2026-10-02 07:06:47',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('6dd41756-6e8b-43ee-a345-5e4bd48275df','6c4f161e-45f9-4723-a814-50d8757b3282','Mengoperasikan Mesin Pengeringan (Dryer)',8,8,'2026-10-02 07:06:47','2026-10-02 07:06:47',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('8630a05f-f0e2-4d9e-bbd1-7929d590f413','6c4f161e-45f9-4723-a814-50d8757b3282','Mengoperasikan Proses Pengemasan',9,9,'2026-10-02 07:06:47','2026-10-02 07:06:47',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('3bafe707-5e46-42fb-bfb2-8a3a168636ce','6c4f161e-45f9-4723-a814-50d8757b3282','Mengoperasikan Proses Penyimpanan',10,10,'2026-10-02 07:06:47','2026-10-02 07:06:47',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('51cede42-6bfa-461b-95a3-9eb5c05b4a70','ebb6a535-6775-4494-a1ad-1f611a4b3bc0','Menentukan Kadar Karet Kering (KKK)/DRC',1,1,'2026-10-02 07:10:21','2026-10-02 07:10:21',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('80351fea-fa43-4e1d-9763-e6a4cc1f156a','ebb6a535-6775-4494-a1ad-1f611a4b3bc0','Mengoperasikan Mesin Creper/Mangle',2,2,'2026-10-02 07:10:21','2026-10-02 07:10:21',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('92a64b0a-f980-4ae2-b480-f1ac836ffc9b','ebb6a535-6775-4494-a1ad-1f611a4b3bc0','Mengoperasikan Mesin Shredder',3,3,'2026-10-02 07:10:21','2026-10-02 07:10:21',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('1ec66453-00f4-4f9a-93ff-c980c135c09c','912a3c82-030a-498a-94e7-1a1844b346bd','Mengoperasikan Unit Dryer',1,1,'2026-10-02 07:13:01','2026-10-02 07:13:01',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('3eafc746-5185-4814-9835-240f20ff5bde','912a3c82-030a-498a-94e7-1a1844b346bd','Mengoperasikan Timbangan Bandela',2,2,'2026-10-02 07:13:01','2026-10-02 07:13:01',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('7f395637-567e-49d3-b6d1-382f87447220','912a3c82-030a-498a-94e7-1a1844b346bd','Mengoperasikan Mesin Press Bandela',3,3,'2026-10-02 07:13:01','2026-10-02 07:13:01',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('1b0e0e5f-1ceb-49f6-9c03-7cb3a79dfb65','912a3c82-030a-498a-94e7-1a1844b346bd','Mengoperasikan Mesin Metal Detector',4,4,'2026-10-02 07:13:01','2026-10-02 07:13:01',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('d4b00115-6426-4286-9b2b-22e7e45f85cf','912a3c82-030a-498a-94e7-1a1844b346bd','Mengatur Penyusunan Bandela Dalam Pallet/Box',5,5,'2026-10-02 07:13:01','2026-10-02 07:13:01',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('09486ec9-6133-48fa-b718-a678bef5acd1','912a3c82-030a-498a-94e7-1a1844b346bd','Memberikan Labelling Pada Pallet',6,6,'2026-10-02 07:13:01','2026-10-02 07:13:01',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('8a34387c-b7ce-4e9e-81b2-ce92b083c95d','912a3c82-030a-498a-94e7-1a1844b346bd','Mengoperasikan Alat Strapping',7,7,'2026-10-02 07:13:01','2026-10-02 07:13:01',NULL);
INSERT INTO "training_materials" ("id","training_id","name","jp","sort_order","created_at","updated_at","unit_code") VALUES('5824eeb6-ecdb-4a35-862c-002f3c981043','912a3c82-030a-498a-94e7-1a1844b346bd','Mengoperasikan Alat Shrink Fast/Gun',8,8,'2026-10-02 07:13:01','2026-10-02 07:13:01',NULL);
CREATE TABLE participant_profiles (
  id TEXT PRIMARY KEY,
  training_id TEXT NOT NULL,
  cohort_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  normalized_name TEXT NOT NULL CHECK (length(trim(normalized_name)) > 0),
  nik TEXT NOT NULL CHECK (length(trim(nik)) > 0),
  birth_place TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  photo_key TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, address TEXT,
  UNIQUE (cohort_id, nik),
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE RESTRICT,
  FOREIGN KEY (cohort_id) REFERENCES training_cohorts(id) ON DELETE RESTRICT
) STRICT;
INSERT INTO "participant_profiles" ("id","training_id","cohort_id","name","normalized_name","nik","birth_place","birth_date","photo_key","is_active","created_at","updated_at","address") VALUES('ae5eb574-2162-45f7-938a-402f3744641c','912a3c82-030a-498a-94e7-1a1844b346bd','88f8bf15-7c9f-48d3-87af-075da9fedbed','sk','sk','123','Medan','2026-10-08',NULL,1,'2026-10-07 16:51:27','2026-10-07 16:51:27','n');
INSERT INTO "participant_profiles" ("id","training_id","cohort_id","name","normalized_name","nik","birth_place","birth_date","photo_key","is_active","created_at","updated_at","address") VALUES('adc8f52f-ffa4-4bea-a00a-25204e336c14','912a3c82-030a-498a-94e7-1a1844b346bd','88f8bf15-7c9f-48d3-87af-075da9fedbed','lol','lol','321','Medan','2026-10-06',NULL,1,'2026-10-07 17:16:00','2026-10-07 17:16:00','m');
INSERT INTO "participant_profiles" ("id","training_id","cohort_id","name","normalized_name","nik","birth_place","birth_date","photo_key","is_active","created_at","updated_at","address") VALUES('3cc8cfa5-1542-482c-aa8d-d7c30c70c102','912a3c82-030a-498a-94e7-1a1844b346bd','88f8bf15-7c9f-48d3-87af-075da9fedbed','yaya','yaya','222','Medan','2026-10-07',NULL,1,'2026-10-07 17:16:28','2026-10-07 17:16:28','k');
CREATE TABLE IF NOT EXISTS "attempts" (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  training_session_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('PRE', 'POST', 'REMEDIAL_1', 'REMEDIAL_2', 'REMEDIAL_3')),
  attempt_number INTEGER NOT NULL CHECK (attempt_number BETWEEN 1 AND 4),
  reset_sequence INTEGER NOT NULL DEFAULT 0 CHECK (reset_sequence >= 0),
  started_at TEXT NOT NULL,
  deadline_at TEXT NOT NULL,
  submitted_at TEXT,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'RESET')),
  score REAL CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  total_questions INTEGER CHECK (total_questions IS NULL OR total_questions > 0),
  correct_count INTEGER CHECK (correct_count IS NULL OR correct_count >= 0),
  wrong_count INTEGER CHECK (wrong_count IS NULL OR wrong_count >= 0),
  draft_answers_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(draft_answers_json)),
  draft_revision INTEGER NOT NULL DEFAULT 0 CHECK (draft_revision >= 0),
  reset_by_admin_id TEXT,
  reset_at TEXT,
  reset_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (deadline_at > started_at),
  CHECK ((status = 'SUBMITTED' AND submitted_at IS NOT NULL AND score IS NOT NULL) OR status <> 'SUBMITTED'),
  CHECK ((status = 'RESET' AND reset_by_admin_id IS NOT NULL AND reset_at IS NOT NULL) OR status <> 'RESET'),
  UNIQUE (participant_id, stage, reset_sequence),
  FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  FOREIGN KEY (training_session_id) REFERENCES training_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (reset_by_admin_id) REFERENCES admins(id) ON DELETE SET NULL
) STRICT;
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('d4ff0ff4-f91c-4df6-9543-1686c07bd395','1b384658-0ac1-44fe-a711-9dbaa9b452e2','0821dc04-1a0c-45b0-b5fe-88c36f4c1cb7','772ad24c-fc82-4acf-9297-76cc96774e05','PRE',1,0,'2026-10-07T16:52:39.943Z','2026-10-07T17:00:39.943Z','2026-10-07T16:52:54.712Z','SUBMITTED',100,2,2,0,'{"27554319-0fc9-4a04-bff9-4fe0426ed2a5":"C","2f94eaf4-e40b-429e-a13e-44f622ce01ce":"B"}',5,NULL,NULL,NULL,'2026-10-07 16:52:39','2026-10-07 16:52:54');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('863033ee-aee2-409c-972c-efa9ae874d48','1b384658-0ac1-44fe-a711-9dbaa9b452e2','0821dc04-1a0c-45b0-b5fe-88c36f4c1cb7','772ad24c-fc82-4acf-9297-76cc96774e05','POST',1,0,'2026-10-07T16:53:05.172Z','2026-10-07T17:01:05.172Z','2026-10-07T16:53:10.921Z','SUBMITTED',0,2,0,2,'{"27554319-0fc9-4a04-bff9-4fe0426ed2a5":"D","2f94eaf4-e40b-429e-a13e-44f622ce01ce":"D"}',3,NULL,NULL,NULL,'2026-10-07 16:53:05','2026-10-07 16:53:10');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('f225fdc6-4fe5-4ed8-b961-a63257e61dc8','1b384658-0ac1-44fe-a711-9dbaa9b452e2','0821dc04-1a0c-45b0-b5fe-88c36f4c1cb7','772ad24c-fc82-4acf-9297-76cc96774e05','REMEDIAL_1',2,0,'2026-10-07T17:01:11.668Z','2026-10-07T17:16:05.919Z','2026-10-07T17:01:20.633Z','SUBMITTED',0,2,0,2,'{"27554319-0fc9-4a04-bff9-4fe0426ed2a5":"A","2f94eaf4-e40b-429e-a13e-44f622ce01ce":"A"}',3,NULL,NULL,NULL,'2026-10-07 17:01:11','2026-10-07 17:01:20');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('636be42c-2aa0-4a90-aa5c-6097555fed19','1b384658-0ac1-44fe-a711-9dbaa9b452e2','0821dc04-1a0c-45b0-b5fe-88c36f4c1cb7','772ad24c-fc82-4acf-9297-76cc96774e05','REMEDIAL_2',3,0,'2026-10-07T17:01:22.410Z','2026-10-07T17:30:01.947Z','2026-10-07T17:01:29.588Z','SUBMITTED',80,2,1,1,'{"27554319-0fc9-4a04-bff9-4fe0426ed2a5":"B","2f94eaf4-e40b-429e-a13e-44f622ce01ce":"B"}',3,NULL,NULL,NULL,'2026-10-07 17:01:22','2026-10-07 17:12:19');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('e22b7198-af3e-40f2-8d9f-d12485e492c1','0d42220b-86ce-4252-8201-f7b48b18ea78','0821dc04-1a0c-45b0-b5fe-88c36f4c1cb7','772ad24c-fc82-4acf-9297-76cc96774e05','PRE',1,0,'2026-10-07T17:23:46.095Z','2026-10-07T17:31:46.095Z','2026-10-07T17:23:53.586Z','SUBMITTED',100,2,2,0,'{"27554319-0fc9-4a04-bff9-4fe0426ed2a5":"C","2f94eaf4-e40b-429e-a13e-44f622ce01ce":"B"}',3,NULL,NULL,NULL,'2026-10-07 17:23:46','2026-10-07 17:23:53');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('9c5f4928-d423-421f-960a-8fa6093b1dc3','ff66753e-ed8b-4f79-91d3-b6be2a685e71','c40e2032-3fe1-4013-a7a5-88ef39774694','c1a0fb08-ea1b-4c29-93af-62462d2dfb89','PRE',1,0,'2026-10-07T17:59:48.624Z','2026-10-07T18:07:48.624Z','2026-10-07T17:59:58.083Z','SUBMITTED',100,2,2,0,'{"0870e49b-f416-410f-85cf-ec9c7f5b90c1":"B","a5a76649-cc39-4ee9-8c76-a82f40655cb9":"C"}',3,NULL,NULL,NULL,'2026-10-07 17:59:48','2026-10-07 17:59:58');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('818fa2cf-e768-4691-aab5-d085676878b9','ff66753e-ed8b-4f79-91d3-b6be2a685e71','c40e2032-3fe1-4013-a7a5-88ef39774694','c1a0fb08-ea1b-4c29-93af-62462d2dfb89','POST',1,0,'2026-10-07T18:00:08.414Z','2026-10-07T18:08:08.414Z','2026-10-07T18:00:15.804Z','SUBMITTED',100,2,2,0,'{"0870e49b-f416-410f-85cf-ec9c7f5b90c1":"B","a5a76649-cc39-4ee9-8c76-a82f40655cb9":"C"}',3,NULL,NULL,NULL,'2026-10-07 18:00:08','2026-10-07 18:00:15');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('d7cd432d-3e5f-4535-8de1-510f9645f6cd','ceb51f2e-d1f0-4ef9-98ad-c409e8fb7493','36756d0e-5b65-404f-9239-cb1d01f55124','6b13c4ea-77fe-4a06-baa9-6fafb675148b','PRE',1,0,'2026-10-07T18:01:30.779Z','2026-10-07T18:09:30.779Z','2026-10-07T18:01:38.583Z','SUBMITTED',100,2,2,0,'{"52d25ce7-45d7-4646-8ddc-5cf1e848e26f":"C","c0b413d9-bb2f-4fa4-8cd3-125b65caded1":"B"}',3,NULL,NULL,NULL,'2026-10-07 18:01:30','2026-10-07 18:01:38');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('1ce2bcdd-cd05-4049-a2ef-eb10af57ba17','ceb51f2e-d1f0-4ef9-98ad-c409e8fb7493','36756d0e-5b65-404f-9239-cb1d01f55124','6b13c4ea-77fe-4a06-baa9-6fafb675148b','POST',1,0,'2026-10-07T18:01:49.519Z','2026-10-07T18:09:49.519Z','2026-10-07T18:02:00.451Z','SUBMITTED',100,2,2,0,'{"52d25ce7-45d7-4646-8ddc-5cf1e848e26f":"C","c0b413d9-bb2f-4fa4-8cd3-125b65caded1":"B"}',3,NULL,NULL,NULL,'2026-10-07 18:01:49','2026-10-07 18:02:00');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('134ea828-689a-409a-9722-9ea218a1fe85','13ac5583-acf1-43f5-8f33-0ba585a8005e','95dff543-135d-439c-9f47-1d71e52c5b54','43ce57d1-4611-4be4-9f91-c435aa2d66e9','PRE',1,0,'2026-10-07T18:05:44.233Z','2026-10-07T18:13:44.233Z','2026-10-07T18:05:51.591Z','SUBMITTED',0,2,0,2,'{"de1d390c-abfb-44b8-b40f-db6bbf59e5d5":"C","387d9dd5-be80-47d0-af56-f4b5e6008bdf":"B"}',3,NULL,NULL,NULL,'2026-10-07 18:05:44','2026-10-07 18:05:51');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('3cdf3497-fa70-4a34-bb4b-a5f388144095','13ac5583-acf1-43f5-8f33-0ba585a8005e','95dff543-135d-439c-9f47-1d71e52c5b54','43ce57d1-4611-4be4-9f91-c435aa2d66e9','POST',1,0,'2026-10-07T18:06:01.281Z','2026-10-07T18:14:01.281Z','2026-10-07T18:06:08.960Z','SUBMITTED',0,2,0,2,'{"de1d390c-abfb-44b8-b40f-db6bbf59e5d5":"C","387d9dd5-be80-47d0-af56-f4b5e6008bdf":"B"}',4,NULL,NULL,NULL,'2026-10-07 18:06:01','2026-10-07 18:06:08');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('b1f68dc3-01a8-43cb-b3da-e0e08bfc2159','13ac5583-acf1-43f5-8f33-0ba585a8005e','95dff543-135d-439c-9f47-1d71e52c5b54','43ce57d1-4611-4be4-9f91-c435aa2d66e9','REMEDIAL_1',2,0,'2026-10-07T18:06:10.537Z','2026-10-07T18:21:02.858Z','2026-10-07T18:06:17.881Z','SUBMITTED',100,2,2,0,'{"de1d390c-abfb-44b8-b40f-db6bbf59e5d5":"B","387d9dd5-be80-47d0-af56-f4b5e6008bdf":"C"}',3,NULL,NULL,NULL,'2026-10-07 18:06:10','2026-10-07 18:06:17');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('fca12d5d-990c-497d-be08-f0e06de7b0fa','4782a187-482b-4936-8ddb-e5dd7a40ea09','0017cc10-f8ab-473e-a0b0-21b819f1601a','38d4e552-f3fe-485a-845c-61801c716a52','PRE',1,0,'2026-10-07T18:07:17.056Z','2026-10-07T18:15:17.056Z','2026-10-07T18:07:25.411Z','SUBMITTED',100,2,2,0,'{"f3ea3025-06ac-4894-87ea-b792b334fb0a":"C","1824adb2-ba92-48c8-a941-bfd80463dc43":"B"}',3,NULL,NULL,NULL,'2026-10-07 18:07:17','2026-10-07 18:07:25');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('02f043a7-eaa3-42a9-8760-c353348da223','4782a187-482b-4936-8ddb-e5dd7a40ea09','0017cc10-f8ab-473e-a0b0-21b819f1601a','38d4e552-f3fe-485a-845c-61801c716a52','POST',1,0,'2026-10-07T18:08:03.613Z','2026-10-07T18:16:03.613Z','2026-10-07T18:08:11.334Z','SUBMITTED',100,2,2,0,'{"1824adb2-ba92-48c8-a941-bfd80463dc43":"B","f3ea3025-06ac-4894-87ea-b792b334fb0a":"C"}',3,NULL,NULL,NULL,'2026-10-07 18:08:03','2026-10-07 18:08:11');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('5f71a332-b33e-4df5-aef4-0fa1b2be628f','acc0adca-6508-4252-89a2-21b519d77092','d211a7be-a3a8-44e4-bce9-ed068556e3a4','dbe498ee-3d60-4d3d-88cc-01b69ad1472b','PRE',1,0,'2026-10-07T18:09:10.509Z','2026-10-07T18:17:10.509Z','2026-10-07T18:09:20.483Z','SUBMITTED',100,2,2,0,'{"53f41547-a3c7-419f-aa7b-dc30c4428aa2":"B","4d2e50ff-c711-4fa4-ab19-71a2b1a09c47":"C"}',3,NULL,NULL,NULL,'2026-10-07 18:09:10','2026-10-07 18:09:20');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('f8eb6286-2f39-4599-9f7c-9014b3d724c3','acc0adca-6508-4252-89a2-21b519d77092','d211a7be-a3a8-44e4-bce9-ed068556e3a4','dbe498ee-3d60-4d3d-88cc-01b69ad1472b','POST',1,0,'2026-10-07T18:09:36.169Z','2026-10-07T18:17:36.169Z','2026-10-07T18:09:42.589Z','SUBMITTED',100,2,2,0,'{"53f41547-a3c7-419f-aa7b-dc30c4428aa2":"B","4d2e50ff-c711-4fa4-ab19-71a2b1a09c47":"C"}',3,NULL,NULL,NULL,'2026-10-07 18:09:36','2026-10-07 18:09:42');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('9dc0bdbc-e0a8-4ee4-99b5-c95cd4d50713','489a4f26-bbcf-4e58-bc39-e8bbc1adf500','7dddc48f-a321-41af-a59b-9114726f5b1c','88d6a3d6-2c66-4922-b94a-68948a0c9ed2','PRE',1,0,'2026-10-07T18:10:40.148Z','2026-10-07T18:18:40.148Z','2026-10-07T18:10:51.325Z','SUBMITTED',100,2,2,0,'{"3cc9b951-0171-4d5e-be48-09b0d129703e":"C","21f7a501-30f3-43de-95be-ad2cbab27e6a":"B"}',4,NULL,NULL,NULL,'2026-10-07 18:10:40','2026-10-07 18:10:51');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('7166b8ba-018c-41fa-a794-4114506b4f4b','489a4f26-bbcf-4e58-bc39-e8bbc1adf500','7dddc48f-a321-41af-a59b-9114726f5b1c','88d6a3d6-2c66-4922-b94a-68948a0c9ed2','POST',1,0,'2026-10-07T18:11:01.169Z','2026-10-07T18:19:01.169Z','2026-10-07T18:11:11.649Z','SUBMITTED',100,2,2,0,'{"21f7a501-30f3-43de-95be-ad2cbab27e6a":"B","3cc9b951-0171-4d5e-be48-09b0d129703e":"C"}',3,NULL,NULL,NULL,'2026-10-07 18:11:01','2026-10-07 18:11:11');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('fa2ed49c-49ac-4479-ad83-e58d5325d3de','7ddf8f84-3506-4f0f-b8a6-0fee1c085840','0170c2e9-b287-4d02-b84c-8f83cd85a6f9','905247aa-3650-4131-9ab8-ddd7eb02e924','PRE',1,0,'2026-10-07T18:11:59.413Z','2026-10-07T18:19:59.413Z','2026-10-07T18:12:09.306Z','SUBMITTED',100,2,2,0,'{"2712bc1b-df66-49d7-b535-d0dc457267d8":"C","ac709e7b-4f60-43ad-ae97-5db4460e92e1":"B"}',4,NULL,NULL,NULL,'2026-10-07 18:11:59','2026-10-07 18:12:09');
INSERT INTO "attempts" ("id","participant_id","batch_id","training_session_id","stage","attempt_number","reset_sequence","started_at","deadline_at","submitted_at","status","score","total_questions","correct_count","wrong_count","draft_answers_json","draft_revision","reset_by_admin_id","reset_at","reset_reason","created_at","updated_at") VALUES('934a81ae-cacf-4132-abd5-8d33a22c6a54','7ddf8f84-3506-4f0f-b8a6-0fee1c085840','0170c2e9-b287-4d02-b84c-8f83cd85a6f9','905247aa-3650-4131-9ab8-ddd7eb02e924','POST',1,0,'2026-10-07T18:12:16.121Z','2026-10-07T18:20:16.121Z','2026-10-07T18:12:24.498Z','SUBMITTED',100,2,2,0,'{"2712bc1b-df66-49d7-b535-d0dc457267d8":"C","ac709e7b-4f60-43ad-ae97-5db4460e92e1":"B"}',3,NULL,NULL,NULL,'2026-10-07 18:12:16','2026-10-07 18:12:24');
CREATE TABLE certificate_settings (
  training_id TEXT PRIMARY KEY,
  certificate_prefix TEXT NOT NULL DEFAULT 'SERT/BDI',
  signer_name TEXT NOT NULL DEFAULT '',
  signer_title TEXT NOT NULL DEFAULT '',
  signer_nip TEXT NOT NULL DEFAULT '',
  logo_key TEXT,
  signature_key TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, issue_place TEXT NOT NULL DEFAULT '', offset_x_mm REAL NOT NULL DEFAULT 0, offset_y_mm REAL NOT NULL DEFAULT 0, front_template_key TEXT, back_template_key TEXT, stamp_key TEXT, issue_date TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE
) STRICT;
CREATE TABLE certificates (
  id TEXT PRIMARY KEY,
  participant_profile_id TEXT NOT NULL,
  training_id TEXT NOT NULL,
  cohort_id TEXT NOT NULL,
  certificate_number TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL,
  pdf_key TEXT,
  status TEXT NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('GENERATED', 'REVOKED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, back_pdf_key TEXT,
  UNIQUE (participant_profile_id, training_id, cohort_id),
  FOREIGN KEY (participant_profile_id) REFERENCES participant_profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE RESTRICT,
  FOREIGN KEY (cohort_id) REFERENCES training_cohorts(id) ON DELETE RESTRICT
) STRICT;
INSERT INTO "certificates" ("id","participant_profile_id","training_id","cohort_id","certificate_number","issued_at","pdf_key","status","created_at","updated_at","back_pdf_key") VALUES('563e3b63-b90f-4127-81f8-14a8285931c7','ae5eb574-2162-45f7-938a-402f3744641c','912a3c82-030a-498a-94e7-1a1844b346bd','88f8bf15-7c9f-48d3-87af-075da9fedbed','B/1/BPSDMI/BDI-Medan/DL/X/2026','2026-10-18',NULL,'GENERATED','2026-10-07 17:47:51','2026-10-08 08:27:51',NULL);
CREATE TABLE IF NOT EXISTS "participants" (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  normalized_name TEXT NOT NULL CHECK (length(trim(normalized_name)) > 0),
  profile_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (profile_id, batch_id),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES participant_profiles(id) ON DELETE RESTRICT
) STRICT;
INSERT INTO "participants" ("id","batch_id","name","normalized_name","profile_id","created_at","updated_at") VALUES('1b384658-0ac1-44fe-a711-9dbaa9b452e2','0821dc04-1a0c-45b0-b5fe-88c36f4c1cb7','sk','sk','ae5eb574-2162-45f7-938a-402f3744641c','2026-10-07 16:52:38','2026-10-07 16:52:38');
INSERT INTO "participants" ("id","batch_id","name","normalized_name","profile_id","created_at","updated_at") VALUES('0d42220b-86ce-4252-8201-f7b48b18ea78','0821dc04-1a0c-45b0-b5fe-88c36f4c1cb7','yaya','yaya','3cc8cfa5-1542-482c-aa8d-d7c30c70c102','2026-10-07 17:23:44','2026-10-07 17:23:44');
INSERT INTO "participants" ("id","batch_id","name","normalized_name","profile_id","created_at","updated_at") VALUES('ff66753e-ed8b-4f79-91d3-b6be2a685e71','c40e2032-3fe1-4013-a7a5-88ef39774694','sk','sk','ae5eb574-2162-45f7-938a-402f3744641c','2026-10-07 17:59:46','2026-10-07 17:59:46');
INSERT INTO "participants" ("id","batch_id","name","normalized_name","profile_id","created_at","updated_at") VALUES('ceb51f2e-d1f0-4ef9-98ad-c409e8fb7493','36756d0e-5b65-404f-9239-cb1d01f55124','sk','sk','ae5eb574-2162-45f7-938a-402f3744641c','2026-10-07 18:01:30','2026-10-07 18:01:30');
INSERT INTO "participants" ("id","batch_id","name","normalized_name","profile_id","created_at","updated_at") VALUES('13ac5583-acf1-43f5-8f33-0ba585a8005e','95dff543-135d-439c-9f47-1d71e52c5b54','sk','sk','ae5eb574-2162-45f7-938a-402f3744641c','2026-10-07 18:05:42','2026-10-07 18:05:42');
INSERT INTO "participants" ("id","batch_id","name","normalized_name","profile_id","created_at","updated_at") VALUES('4782a187-482b-4936-8ddb-e5dd7a40ea09','0017cc10-f8ab-473e-a0b0-21b819f1601a','sk','sk','ae5eb574-2162-45f7-938a-402f3744641c','2026-10-07 18:07:15','2026-10-07 18:07:15');
INSERT INTO "participants" ("id","batch_id","name","normalized_name","profile_id","created_at","updated_at") VALUES('acc0adca-6508-4252-89a2-21b519d77092','d211a7be-a3a8-44e4-bce9-ed068556e3a4','sk','sk','ae5eb574-2162-45f7-938a-402f3744641c','2026-10-07 18:09:08','2026-10-07 18:09:08');
INSERT INTO "participants" ("id","batch_id","name","normalized_name","profile_id","created_at","updated_at") VALUES('489a4f26-bbcf-4e58-bc39-e8bbc1adf500','7dddc48f-a321-41af-a59b-9114726f5b1c','sk','sk','ae5eb574-2162-45f7-938a-402f3744641c','2026-10-07 18:10:38','2026-10-07 18:10:38');
INSERT INTO "participants" ("id","batch_id","name","normalized_name","profile_id","created_at","updated_at") VALUES('7ddf8f84-3506-4f0f-b8a6-0fee1c085840','0170c2e9-b287-4d02-b84c-8f83cd85a6f9','sk','sk','ae5eb574-2162-45f7-938a-402f3744641c','2026-10-07 18:11:57','2026-10-07 18:11:57');
CREATE TABLE IF NOT EXISTS "training_cohorts" (
  id TEXT PRIMARY KEY,
  training_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (
      status IN ('ACTIVE', 'INACTIVE', 'COMPLETED')
    ),

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CHECK (end_date >= start_date),

  FOREIGN KEY (training_id)
    REFERENCES trainings(id)
    ON DELETE RESTRICT
) STRICT;
INSERT INTO "training_cohorts" ("id","training_id","name","start_date","end_date","status","created_at","updated_at") VALUES('8a4616fe-c244-4db5-bb99-b51507363187','50e4a22c-0c0d-4918-b492-6de986f96918','Angkatan 1','2026-10-01','2026-10-07','ACTIVE','2026-10-01 12:26:40','2026-10-01 12:26:40');
INSERT INTO "training_cohorts" ("id","training_id","name","start_date","end_date","status","created_at","updated_at") VALUES('748cd294-ab93-46d2-a8fe-3502d3f4e893','50e4a22c-0c0d-4918-b492-6de986f96918','Angkatan 2','2026-10-01','2026-10-07','ACTIVE','2026-10-01 12:26:40','2026-10-01 12:26:40');
INSERT INTO "training_cohorts" ("id","training_id","name","start_date","end_date","status","created_at","updated_at") VALUES('88f8bf15-7c9f-48d3-87af-075da9fedbed','912a3c82-030a-498a-94e7-1a1844b346bd','Angkatan 1','2026-10-12','2026-10-18','ACTIVE','2026-10-07 15:46:44','2026-10-08 06:06:47');
CREATE TABLE survey_templates (
  id TEXT PRIMARY KEY,

  name TEXT NOT NULL
    CHECK (length(trim(name)) > 0),

  version INTEGER NOT NULL DEFAULT 1
    CHECK (version > 0),

  is_active INTEGER NOT NULL DEFAULT 1
    CHECK (is_active IN (0, 1)),

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, description TEXT, status TEXT NOT NULL DEFAULT 'DRAFT'
CHECK (
  status IN (
    'DRAFT',
    'PUBLISHED',
    'ARCHIVED'
  )
), published_at TEXT, source_template_id TEXT
REFERENCES survey_templates(id)
ON DELETE SET NULL,

  UNIQUE (name, version)
) STRICT;
INSERT INTO "survey_templates" ("id","name","version","is_active","created_at","updated_at","description","status","published_at","source_template_id") VALUES('a0000000-0000-4000-8000-000000000001','Evaluasi Penyelenggaraan Pelatihan Vokasi',1,1,'2026-10-06 07:12:59','2026-10-06 07:12:59','Silakan isi sesuai dengan penilaian Anda sebagai Peserta Pelatihan.','PUBLISHED','2026-10-06 07:12:59',NULL);
CREATE TABLE survey_sections (
  id TEXT PRIMARY KEY,

  survey_template_id TEXT NOT NULL,

  section_code TEXT NOT NULL
    CHECK (length(trim(section_code)) > 0),

  title TEXT NOT NULL
    CHECK (length(trim(title)) > 0),

  sort_order INTEGER NOT NULL
    CHECK (sort_order > 0),

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, description TEXT,

  UNIQUE (survey_template_id, section_code),
  UNIQUE (survey_template_id, sort_order),

  FOREIGN KEY (survey_template_id)
    REFERENCES survey_templates(id)
    ON DELETE CASCADE
) STRICT;
INSERT INTO "survey_sections" ("id","survey_template_id","section_code","title","sort_order","created_at","updated_at","description") VALUES('a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','A','PENDAFTARAN PELATIHAN',1,'2026-10-06 07:12:59','2026-10-06 07:12:59','Pilih jawaban yang paling tepat, kemudian beri nilai pada skala 1–4.');
INSERT INTO "survey_sections" ("id","survey_template_id","section_code","title","sort_order","created_at","updated_at","description") VALUES('a1000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','B','PROGRAM PELATIHAN',2,'2026-10-06 07:12:59','2026-10-06 07:12:59','Beri penilaian pada skala 1–4.');
INSERT INTO "survey_sections" ("id","survey_template_id","section_code","title","sort_order","created_at","updated_at","description") VALUES('a1000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','C','INSTRUKTUR',3,'2026-10-06 07:12:59','2026-10-06 07:12:59','Beri penilaian pada skala 1–4.');
INSERT INTO "survey_sections" ("id","survey_template_id","section_code","title","sort_order","created_at","updated_at","description") VALUES('a1000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001','D','PENYELENGGARAAN PELATIHAN',4,'2026-10-06 07:12:59','2026-10-06 07:12:59','Beri penilaian pada skala 1–4.');
CREATE TABLE survey_questions (
  id TEXT PRIMARY KEY,

  survey_section_id TEXT NOT NULL,

  question_text TEXT NOT NULL
    CHECK (length(trim(question_text)) > 0),

  question_type TEXT NOT NULL
    CHECK (
      question_type IN (
        'SINGLE_CHOICE',
        'SCALE',
        'LONG_TEXT'
      )
    ),

  is_required INTEGER NOT NULL DEFAULT 1
    CHECK (is_required IN (0, 1)),

  sort_order INTEGER NOT NULL
    CHECK (sort_order > 0),

  -- Hanya digunakan untuk SCALE
  scale_min INTEGER,
  scale_max INTEGER,
  scale_min_label TEXT,
  scale_max_label TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, helper_text TEXT,

  -- Jika tipe SCALE, min/max wajib tersedia.
  CHECK (
    question_type <> 'SCALE'
    OR (
      scale_min IS NOT NULL
      AND scale_max IS NOT NULL
      AND scale_max > scale_min
    )
  ),

  -- Selain SCALE tidak boleh mempunyai min/max.
  CHECK (
    question_type = 'SCALE'
    OR (
      scale_min IS NULL
      AND scale_max IS NULL
      AND scale_min_label IS NULL
      AND scale_max_label IS NULL
    )
  ),

  UNIQUE (survey_section_id, sort_order),

  FOREIGN KEY (survey_section_id)
    REFERENCES survey_sections(id)
    ON DELETE CASCADE
) STRICT;
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Dari mana Anda mendapatkan informasi tentang pelatihan ini?','SINGLE_CHOICE',1,1,NULL,NULL,NULL,NULL,'2026-10-06 07:12:59','2026-10-06 07:12:59',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','Apakah informasi pelatihan mudah untuk didapatkan?','SCALE',1,2,1,4,'Sangat sulit','Sangat mudah','2026-10-06 07:12:59','2026-10-06 07:12:59',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','Apakah pendaftaran dan tahapannya mudah untuk dilakukan?','SCALE',1,3,1,4,'Sangat sulit','Sangat mudah','2026-10-06 07:12:59','2026-10-06 07:12:59',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000001','Apakah petunjuk tata cara pendaftaran jelas dan mudah dipahami?','SCALE',1,4,1,4,'Sangat kurang jelas dan sulit dipahami','Sangat jelas dan mudah dipahami','2026-10-06 07:12:59','2026-10-06 07:12:59',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000002','Apakah program pelatihan jelas dan mudah dipahami?','SCALE',1,1,1,4,'Sangat kurang jelas dan sulit dipahami','Sangat jelas dan mudah dipahami','2026-10-06 07:12:59','2026-10-06 07:12:59',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000002','Apakah program pelatihan menarik?','SCALE',1,2,1,4,'Sangat kurang menarik','Sangat menarik','2026-10-06 07:12:59','2026-10-06 07:12:59',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000007','a1000000-0000-4000-8000-000000000002','Apakah program pelatihan bermanfaat?','SCALE',1,3,1,4,'Sangat kurang bermanfaat','Sangat bermanfaat','2026-10-06 07:12:59','2026-10-06 07:12:59',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000008','a1000000-0000-4000-8000-000000000002','Apakah program pelatihan berhasil meningkatkan kompetensi Anda?','SCALE',1,4,1,4,'Sangat kurang berhasil','Sangat berhasil','2026-10-06 07:12:59','2026-10-06 07:12:59',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000009','a1000000-0000-4000-8000-000000000002','Apakah durasi untuk menyelesaikan pelatihan sudah sesuai?','SCALE',1,5,1,4,'Sangat tidak sesuai','Sangat sesuai','2026-10-06 07:12:59','2026-10-06 07:18:10',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000010','a1000000-0000-4000-8000-000000000002','Komentar dan saran Anda terhadap program pelatihan','LONG_TEXT',1,6,NULL,NULL,NULL,NULL,'2026-10-06 07:12:59','2026-10-06 07:12:59',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000003','Apakah instruktur menguasai program pelatihan yang disampaikan?','SCALE',1,1,1,4,'Sangat kurang menguasai','Sangat menguasai','2026-10-06 07:12:59','2026-10-06 07:12:59',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000003','Bagaimana kemampuan instruktur dalam menyampaikan program pelatihan?','SCALE',1,2,1,4,'Sangat kurang baik','Sangat baik','2026-10-06 07:12:59','2026-10-06 07:18:10',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000013','a1000000-0000-4000-8000-000000000003','Bagaimana kemampuan instruktur dalam mengelola Peserta Pelatihan?','SCALE',1,3,1,4,'Sangat kurang baik','Sangat baik','2026-10-06 07:12:59','2026-10-06 07:18:10',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000014','a1000000-0000-4000-8000-000000000003','Bagaimana sikap, disiplin, penampilan, dan keteladanan instruktur selama pelatihan?','SCALE',1,4,1,4,'Sangat kurang baik','Sangat baik','2026-10-06 07:12:59','2026-10-06 07:12:59',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000015','a1000000-0000-4000-8000-000000000003','Komentar dan saran Anda terhadap instruktur','LONG_TEXT',1,5,NULL,NULL,NULL,NULL,'2026-10-06 07:12:59','2026-10-06 07:12:59',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000016','a1000000-0000-4000-8000-000000000004','Bagaimana pelayanan petugas terhadap Peserta Pelatihan?','SCALE',1,1,1,4,'Sangat kurang baik','Sangat baik','2026-10-06 07:12:59','2026-10-06 07:18:10',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000017','a1000000-0000-4000-8000-000000000004','Apakah pelaksanaan jadwal pelatihan sudah sesuai dengan rencana?','SCALE',1,2,1,4,'Sangat kurang sesuai','Sangat sesuai','2026-10-06 07:12:59','2026-10-06 07:12:59',NULL);
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000018','a1000000-0000-4000-8000-000000000004','Apakah perlengkapan Peserta Pelatihan (training material) diberikan tepat waktu?','SCALE',1,3,1,4,'Sangat tidak tepat','Sangat tepat','2026-10-06 07:12:59','2026-10-06 07:18:10','Contoh: atribut pelatihan/seragam, Alat Pelindung Diri, modul, materi, ATK, bahan, konten, dan lain-lain.');
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000019','a1000000-0000-4000-8000-000000000004','Apakah sarana/prasarana/fasilitas pelatihan sudah memadai?','SCALE',1,4,1,4,'Sangat kurang memadai','Sangat memadai','2026-10-06 07:12:59','2026-10-06 07:12:59','Contoh: kelas, workshop, mesin, alat, website sistem manajemen pembelajaran, dan lain-lain.');
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000020','a1000000-0000-4000-8000-000000000004','Apakah sarana/prasarana/fasilitas penunjang pelatihan sudah memadai?','SCALE',1,5,1,4,'Sangat kurang memadai','Sangat memadai','2026-10-06 07:12:59','2026-10-06 07:12:59','Contoh: asrama, tempat ibadah, kantin, toilet, perpustakaan, website lembaga pelatihan, dan lain-lain.');
INSERT INTO "survey_questions" ("id","survey_section_id","question_text","question_type","is_required","sort_order","scale_min","scale_max","scale_min_label","scale_max_label","created_at","updated_at","helper_text") VALUES('a2000000-0000-4000-8000-000000000021','a1000000-0000-4000-8000-000000000004','Komentar dan saran Anda terhadap penyelenggaraan pelatihan','LONG_TEXT',1,6,NULL,NULL,NULL,NULL,'2026-10-06 07:12:59','2026-10-06 07:12:59',NULL);
CREATE TABLE survey_question_options (
  id TEXT PRIMARY KEY,

  survey_question_id TEXT NOT NULL,

  option_value TEXT NOT NULL
    CHECK (length(trim(option_value)) > 0),

  option_label TEXT NOT NULL
    CHECK (length(trim(option_label)) > 0),

  allows_other_text INTEGER NOT NULL DEFAULT 0
    CHECK (allows_other_text IN (0, 1)),

  sort_order INTEGER NOT NULL
    CHECK (sort_order > 0),

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (survey_question_id, option_value),
  UNIQUE (survey_question_id, sort_order),

  FOREIGN KEY (survey_question_id)
    REFERENCES survey_questions(id)
    ON DELETE CASCADE
) STRICT;
INSERT INTO "survey_question_options" ("id","survey_question_id","option_value","option_label","allows_other_text","sort_order","created_at") VALUES('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','NEWSPAPER_BROCHURE','Iklan di koran/majalah atau brosur',0,1,'2026-10-06 07:12:59');
INSERT INTO "survey_question_options" ("id","survey_question_id","option_value","option_label","allows_other_text","sort_order","created_at") VALUES('a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','BILLBOARD','Billboard/spanduk',0,2,'2026-10-06 07:12:59');
INSERT INTO "survey_question_options" ("id","survey_question_id","option_value","option_label","allows_other_text","sort_order","created_at") VALUES('a3000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000001','INTERNET_ONLINE_EMAIL','Internet/iklan online/surat elektronik',0,3,'2026-10-06 07:12:59');
INSERT INTO "survey_question_options" ("id","survey_question_id","option_value","option_label","allows_other_text","sort_order","created_at") VALUES('a3000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000001','GOVERNMENT_AGENCY','Dinas tenaga kerja/Instansi lainnya',0,4,'2026-10-06 07:12:59');
INSERT INTO "survey_question_options" ("id","survey_question_id","option_value","option_label","allows_other_text","sort_order","created_at") VALUES('a3000000-0000-4000-8000-000000000005','a2000000-0000-4000-8000-000000000001','TRAINING_INSTITUTION','Lembaga pelatihan',0,5,'2026-10-06 07:12:59');
INSERT INTO "survey_question_options" ("id","survey_question_id","option_value","option_label","allows_other_text","sort_order","created_at") VALUES('a3000000-0000-4000-8000-000000000006','a2000000-0000-4000-8000-000000000001','RELATION','Relasi (misalnya instruktur, orang tua, saudara, teman, dan lain-lain)',0,6,'2026-10-06 07:12:59');
INSERT INTO "survey_question_options" ("id","survey_question_id","option_value","option_label","allows_other_text","sort_order","created_at") VALUES('a3000000-0000-4000-8000-000000000007','a2000000-0000-4000-8000-000000000001','SIAPKERJA','Aplikasi SIAPKerja',0,7,'2026-10-06 07:12:59');
INSERT INTO "survey_question_options" ("id","survey_question_id","option_value","option_label","allows_other_text","sort_order","created_at") VALUES('a3000000-0000-4000-8000-000000000008','a2000000-0000-4000-8000-000000000001','KEMNAKER_OFFICIAL','Situs resmi KEMNAKER',0,8,'2026-10-06 07:12:59');
INSERT INTO "survey_question_options" ("id","survey_question_id","option_value","option_label","allows_other_text","sort_order","created_at") VALUES('a3000000-0000-4000-8000-000000000009','a2000000-0000-4000-8000-000000000001','TRAINING_OFFICIAL_SITE','Situs resmi lembaga pelatihan',0,9,'2026-10-06 07:12:59');
INSERT INTO "survey_question_options" ("id","survey_question_id","option_value","option_label","allows_other_text","sort_order","created_at") VALUES('a3000000-0000-4000-8000-000000000010','a2000000-0000-4000-8000-000000000001','OTHER','Yang lain',1,10,'2026-10-06 07:12:59');
CREATE TABLE survey_campaigns (
  id TEXT PRIMARY KEY,

  survey_template_id TEXT NOT NULL,
  cohort_id TEXT NOT NULL,

  opens_at TEXT,
  opened_manually_at TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, slug TEXT, mode TEXT NOT NULL DEFAULT 'SCHEDULED'
  CHECK (mode IN ('MANUAL', 'SCHEDULED')), closes_at TEXT, manual_open INTEGER NOT NULL DEFAULT 0
  CHECK (manual_open IN (0, 1)), closed_at TEXT,

  -- Satu survey evaluasi per cohort.
  UNIQUE (cohort_id),

  FOREIGN KEY (survey_template_id)
    REFERENCES survey_templates(id)
    ON DELETE RESTRICT,

  FOREIGN KEY (cohort_id)
    REFERENCES training_cohorts(id)
    ON DELETE RESTRICT
) STRICT;
INSERT INTO "survey_campaigns" ("id","survey_template_id","cohort_id","opens_at","opened_manually_at","created_at","updated_at","slug","mode","closes_at","manual_open","closed_at") VALUES('0a265218-648f-4e7b-b621-bbd7513bbfe9','a0000000-0000-4000-8000-000000000001','88f8bf15-7c9f-48d3-87af-075da9fedbed',NULL,'2026-10-07T17:51:44.096Z','2026-10-07 17:51:44','2026-10-07 17:51:44','evaluasi-0ba96c2999d445dc','MANUAL',NULL,1,NULL);
CREATE TABLE survey_responses (
  id TEXT PRIMARY KEY,

  survey_campaign_id TEXT NOT NULL,
  participant_profile_id TEXT NOT NULL,

  started_at TEXT,
  submitted_at TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (
    survey_campaign_id,
    participant_profile_id
  ),

  FOREIGN KEY (survey_campaign_id)
    REFERENCES survey_campaigns(id)
    ON DELETE RESTRICT,

  FOREIGN KEY (participant_profile_id)
    REFERENCES participant_profiles(id)
    ON DELETE RESTRICT
) STRICT;
INSERT INTO "survey_responses" ("id","survey_campaign_id","participant_profile_id","started_at","submitted_at","created_at","updated_at") VALUES('5d6916ea-1d8e-4901-92f7-715227eae233','0a265218-648f-4e7b-b621-bbd7513bbfe9','ae5eb574-2162-45f7-938a-402f3744641c','2026-10-07 18:13:38','2026-10-07 18:14:21','2026-10-07 18:13:38','2026-10-07 18:14:21');
CREATE TABLE survey_answers (
  id TEXT PRIMARY KEY,

  survey_response_id TEXT NOT NULL,
  survey_question_id TEXT NOT NULL,

  option_id TEXT,
  other_text TEXT,

  numeric_value INTEGER,

  text_value TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Minimal harus mempunyai satu bentuk jawaban.
  CHECK (
    option_id IS NOT NULL
    OR numeric_value IS NOT NULL
    OR text_value IS NOT NULL
  ),

  UNIQUE (
    survey_response_id,
    survey_question_id
  ),

  FOREIGN KEY (survey_response_id)
    REFERENCES survey_responses(id)
    ON DELETE CASCADE,

  FOREIGN KEY (survey_question_id)
    REFERENCES survey_questions(id)
    ON DELETE RESTRICT,

  FOREIGN KEY (option_id)
    REFERENCES survey_question_options(id)
    ON DELETE RESTRICT
) STRICT;
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('6f34b774-642c-4eeb-a63a-4095d2b1dfbc','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000007',NULL,NULL,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('3880aac0-2dac-4d32-aa14-0abe0276da14','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000003',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('3885d42e-bf36-467b-bc94-dc832df322d8','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000004',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('13523159-c5e5-42a8-ba51-8d6858aa9b48','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000002',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('9fd75902-ddd6-49a2-baeb-caff3189ea77','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000005',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('6260facd-e1d8-48e7-8078-b3f3617ef811','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000006',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('0c03da24-567b-4842-8edd-69ed62edb188','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000007',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('34e180be-798d-41a1-bf61-5e1fa843aa4f','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000008',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('b6b129c0-4f5b-4390-9b8e-a19d8f441d76','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000009',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('94686681-570b-4215-9821-34d2e80d04b6','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000010',NULL,NULL,NULL,'oookok','2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('834754b1-0bab-48cd-a9f6-bff979d56cab','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000011',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('a431a5bd-66f1-40e7-a534-fdd33e72192a','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000012',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('a05e0c6a-39f8-4ccb-af40-24661db8f272','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000013',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('db80de91-20c5-44c8-9e43-9d9d28e56ed4','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000014',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('d74dd4c0-9098-4958-882f-f7e3f2480869','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000015',NULL,NULL,NULL,'okok','2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('9c965333-2633-4938-b041-19ecba51536b','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000016',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('716676cd-d269-49c4-ba35-2ba0c88bb228','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000017',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('6f89dbf2-9be2-4b3b-ad56-1f275a914fb5','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000018',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('6a171bc7-cf17-46d5-bf3c-da3e2127c40b','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000019',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('fec2981d-1b32-4829-a0ad-874f9601c791','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000020',NULL,NULL,4,NULL,'2026-10-07 18:14:21','2026-10-07 18:14:21');
INSERT INTO "survey_answers" ("id","survey_response_id","survey_question_id","option_id","other_text","numeric_value","text_value","created_at","updated_at") VALUES('081210ce-1b7e-4935-bd39-25680eff6833','5d6916ea-1d8e-4901-92f7-715227eae233','a2000000-0000-4000-8000-000000000021',NULL,NULL,NULL,'okok','2026-10-07 18:14:21','2026-10-07 18:14:21');
CREATE TABLE global_certificate_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  certificate_prefix TEXT NOT NULL DEFAULT '',
  signer_name TEXT NOT NULL DEFAULT '',
  signer_title TEXT NOT NULL DEFAULT '',
  signer_nip TEXT NOT NULL DEFAULT '',
  issue_place TEXT NOT NULL DEFAULT '',
  issue_date TEXT NOT NULL DEFAULT '',
  offset_x_mm REAL NOT NULL DEFAULT 0,
  offset_y_mm REAL NOT NULL DEFAULT 0,
  signature_key TEXT,
  stamp_key TEXT,
  front_template_key TEXT,
  back_template_key TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
INSERT INTO "global_certificate_settings" ("id","certificate_prefix","signer_name","signer_title","signer_nip","issue_place","issue_date","offset_x_mm","offset_y_mm","signature_key","stamp_key","front_template_key","back_template_key","updated_at") VALUES(1,'','Mr X','Kepala Balai Diklat Industri','123','Balai Diklat Industri','2026-10-12',0,0,'certificates/assets/global/signature-3d077af7-f5f7-4e27-babd-ef7818e7170b.jpg',NULL,NULL,NULL,'2026-10-07 17:47:48');
CREATE TABLE completion_letters (
  id TEXT PRIMARY KEY,
  participant_profile_id TEXT NOT NULL UNIQUE,
  training_id TEXT NOT NULL,
  cohort_id TEXT NOT NULL,
  completion_letter_number TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (participant_profile_id) REFERENCES participant_profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE RESTRICT,
  FOREIGN KEY (cohort_id) REFERENCES training_cohorts(id) ON DELETE RESTRICT
) STRICT;
INSERT INTO "completion_letters" ("id","participant_profile_id","training_id","cohort_id","completion_letter_number","issued_at","created_at","updated_at") VALUES('1004a367-3bc0-4253-93c8-2db6a0189675','ae5eb574-2162-45f7-938a-402f3744641c','912a3c82-030a-498a-94e7-1a1844b346bd','88f8bf15-7c9f-48d3-87af-075da9fedbed','B/1/BDI-Medan/DL/X/2026','2026-10-18','2026-10-07 17:47:51','2026-10-08 06:05:50');
CREATE TABLE survey_campaign_cohorts (
  survey_campaign_id TEXT NOT NULL,
  cohort_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (survey_campaign_id, cohort_id),
  UNIQUE (cohort_id),
  FOREIGN KEY (survey_campaign_id) REFERENCES survey_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (cohort_id) REFERENCES training_cohorts(id) ON DELETE RESTRICT
) STRICT;
INSERT INTO "survey_campaign_cohorts" ("survey_campaign_id","cohort_id","created_at") VALUES('0a265218-648f-4e7b-b621-bbd7513bbfe9','88f8bf15-7c9f-48d3-87af-075da9fedbed','2026-10-07 17:51:44');
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',20);
CREATE INDEX idx_admin_sessions_admin_expiry
  ON admin_sessions(admin_id, expires_at);
CREATE INDEX idx_questions_bank_active_usage
  ON questions(bank_id, is_active, times_assigned);
CREATE INDEX idx_training_sessions_bank_status
  ON training_sessions(bank_id, status);
CREATE INDEX idx_training_sessions_dates
  ON training_sessions(training_start_date, training_end_date);
CREATE INDEX idx_batches_training_session
  ON batches(training_session_id);
CREATE INDEX idx_batch_questions_question
  ON batch_questions(question_id);
CREATE INDEX idx_attempt_answers_attempt
  ON attempt_answers(attempt_id);
CREATE INDEX idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id, created_at);
CREATE INDEX idx_audit_logs_admin
  ON audit_logs(admin_id, created_at);
CREATE INDEX idx_admins_role_active ON admins(role, is_active);
CREATE UNIQUE INDEX one_active_bank_per_material
  ON question_banks(material_id) WHERE is_active = 1 AND material_id IS NOT NULL;
CREATE INDEX participant_profiles_lookup
  ON participant_profiles(cohort_id, normalized_name, nik, is_active);
CREATE INDEX attempts_participant_stage ON attempts(participant_id, stage, status);
CREATE INDEX idx_participants_normalized_name
  ON participants(normalized_name);
CREATE INDEX idx_participants_profile_batch
  ON participants(profile_id, batch_id);
CREATE INDEX idx_trainings_visible
  ON trainings(is_deleted, is_active, name);
CREATE INDEX idx_training_cohorts_training
ON training_cohorts(training_id);
CREATE INDEX idx_survey_sections_template
  ON survey_sections(survey_template_id, sort_order);
CREATE INDEX idx_survey_questions_section
  ON survey_questions(survey_section_id, sort_order);
CREATE INDEX idx_survey_question_options_question
  ON survey_question_options(
    survey_question_id,
    sort_order
  );
CREATE INDEX idx_survey_campaigns_template
  ON survey_campaigns(survey_template_id);
CREATE INDEX idx_survey_campaigns_opens
  ON survey_campaigns(opens_at);
CREATE INDEX idx_survey_responses_campaign
  ON survey_responses(
    survey_campaign_id,
    submitted_at
  );
CREATE INDEX idx_survey_responses_participant
  ON survey_responses(participant_profile_id);
CREATE INDEX idx_survey_answers_response
  ON survey_answers(survey_response_id);
CREATE INDEX idx_survey_answers_question
  ON survey_answers(
    survey_question_id,
    numeric_value
  );
CREATE INDEX idx_survey_templates_status
ON survey_templates(status, is_active);
CREATE INDEX idx_survey_templates_source
ON survey_templates(source_template_id);
CREATE INDEX completion_letters_training_cohort
  ON completion_letters(training_id, cohort_id);
CREATE UNIQUE INDEX uq_training_cohorts_name_year
ON training_cohorts (
  training_id,
  name,
  substr(start_date, 1, 4)
);
CREATE INDEX idx_training_cohorts_year
ON training_cohorts (
  substr(start_date, 1, 4)
);
CREATE UNIQUE INDEX uq_survey_campaigns_slug
  ON survey_campaigns(slug);
CREATE INDEX idx_survey_campaign_cohorts_campaign
  ON survey_campaign_cohorts(survey_campaign_id);
CREATE INDEX idx_survey_campaign_cohorts_cohort
  ON survey_campaign_cohorts(cohort_id);
CREATE INDEX idx_survey_campaign_schedule
  ON survey_campaigns(mode, manual_open, opens_at, closes_at);