PRAGMA foreign_keys = ON;

DELETE FROM survey_answers;
DELETE FROM survey_responses;
DELETE FROM survey_campaign_cohorts;
DELETE FROM survey_campaigns;
DELETE FROM survey_question_options;
DELETE FROM survey_questions;
DELETE FROM survey_sections;
DELETE FROM survey_templates;

DELETE FROM attempt_answers;
DELETE FROM attempt_question_snapshots;
DELETE FROM attempts;

DELETE FROM batch_layouts;
DELETE FROM batch_questions;
DELETE FROM participants;
DELETE FROM batches;

DELETE FROM certificates;
DELETE FROM completion_letters;
DELETE FROM participant_profiles;

DELETE FROM training_sessions;
DELETE FROM questions;
DELETE FROM question_banks;

DELETE FROM certificate_settings;
DELETE FROM training_cohorts;
DELETE FROM training_materials;
DELETE FROM trainings;

DELETE FROM audit_logs;
