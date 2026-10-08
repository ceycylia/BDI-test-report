-- Supporting indexes for paginated admin lists and participant test lookups.
CREATE INDEX IF NOT EXISTS idx_participant_profiles_training_cohort
  ON participant_profiles(training_id, cohort_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_participant_profiles_normalized_name
  ON participant_profiles(normalized_name);
CREATE INDEX IF NOT EXISTS idx_training_materials_training_sort
  ON training_materials(training_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_training_sessions_training_material
  ON training_sessions(training_id, material_id, status);
CREATE INDEX IF NOT EXISTS idx_batches_session_cohort
  ON batches(training_session_id, cohort_id);
CREATE INDEX IF NOT EXISTS idx_participants_profile_batch
  ON participants(profile_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_attempts_participant_stage_status
  ON attempts(participant_id, stage, status, created_at);
CREATE INDEX IF NOT EXISTS idx_attempt_snapshots_attempt_position
  ON attempt_question_snapshots(attempt_id, display_position);
CREATE INDEX IF NOT EXISTS idx_certificates_profile
  ON certificates(participant_profile_id, updated_at);
