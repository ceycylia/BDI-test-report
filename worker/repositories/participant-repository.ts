export type PublicTrainingRecord = {
  id: string; name: string; slug: string; question_count: number; duration_minutes: number; passing_score: number;
  training_start_date: string; training_end_date: string; status: "DRAFT" | "ACTIVE" | "COMPLETED";
  pre_mode: "MANUAL" | "SCHEDULED"; pre_start_at: string | null; pre_end_at: string | null; pre_manual_open: number;
  post_mode: "MANUAL" | "SCHEDULED"; post_start_at: string | null; post_end_at: string | null; post_manual_open: number;
  training_id: string | null; material_id: string | null; material_name: string | null; training_name: string | null;
};
export type PublicBatchRecord = { id: string; batch_number: number; batch_name: string; cohort_id: string | null };
export type ParticipantRecord = { id: string; batch_id: string; name: string; normalized_name: string };

export async function findPublicTraining(database: D1Database, slug: string) {
  return database.prepare(
    `SELECT sessions.id, sessions.name, sessions.slug, sessions.question_count, sessions.duration_minutes,
            sessions.passing_score, sessions.training_start_date, sessions.training_end_date, sessions.status,
            sessions.pre_mode, sessions.pre_start_at, sessions.pre_end_at, sessions.pre_manual_open,
            sessions.post_mode, sessions.post_start_at, sessions.post_end_at, sessions.post_manual_open,
            sessions.training_id, sessions.material_id, materials.name AS material_name,
            trainings.name AS training_name
       FROM training_sessions AS sessions
       LEFT JOIN training_materials AS materials ON materials.id = sessions.material_id
       LEFT JOIN trainings ON trainings.id = sessions.training_id
      WHERE sessions.slug = ? COLLATE NOCASE LIMIT 1`,
  ).bind(slug).first<PublicTrainingRecord>();
}

export async function listPublicBatches(database: D1Database, sessionId: string) {
  const result = await database.prepare(
    `SELECT id, batch_number, batch_name, cohort_id FROM batches WHERE training_session_id = ? ORDER BY batch_number`,
  ).bind(sessionId).all<PublicBatchRecord>();
  return result.results;
}

export async function findParticipant(database: D1Database, batchId: string, normalizedName: string) {
  return database.prepare(
    `SELECT id, batch_id, name, normalized_name FROM participants
      WHERE batch_id = ? AND normalized_name = ? LIMIT 1`,
  ).bind(batchId, normalizedName).first<ParticipantRecord>();
}

export async function createParticipant(
  database: D1Database,
  input: { id: string; batchId: string; name: string; normalizedName: string },
) {
  await database.prepare(
    `INSERT INTO participants (id, batch_id, name, normalized_name) VALUES (?, ?, ?, ?)`,
  ).bind(input.id, input.batchId, input.name, input.normalizedName).run();
  return { id: input.id, batch_id: input.batchId, name: input.name, normalized_name: input.normalizedName };
}

export async function findRegisteredProfile(database:D1Database,input:{trainingId:string;cohortId:string;normalizedName:string;nik:string}){
  return database.prepare(`SELECT id,name,normalized_name FROM participant_profiles WHERE training_id=? AND cohort_id=? AND normalized_name=? AND nik=? AND is_active=1 LIMIT 1`).bind(input.trainingId,input.cohortId,input.normalizedName,input.nik).first<{id:string;name:string;normalized_name:string}>();
}

export async function findOrCreateExamParticipant(database:D1Database,input:{profileId:string;batchId:string;name:string;normalizedName:string}){
  const found=await database.prepare(`SELECT id,batch_id,name,normalized_name,profile_id FROM participants WHERE profile_id=? AND batch_id=? LIMIT 1`).bind(input.profileId,input.batchId).first<ParticipantRecord & {profile_id:string|null}>();
  if(found)return found;
  const id=crypto.randomUUID();
  try {
    await database.prepare(`INSERT INTO participants(id,batch_id,name,normalized_name,profile_id) VALUES(?,?,?,?,?)`).bind(id,input.batchId,input.name,input.normalizedName,input.profileId).run();
  } catch (error) {
    // A second identify request may win the insert race. Return that row rather
    // than exposing a duplicate-constraint error to the participant.
    if (!String(error).includes("UNIQUE")) throw error;
    const concurrent=await database.prepare(`SELECT id,batch_id,name,normalized_name,profile_id FROM participants WHERE profile_id=? AND batch_id=? LIMIT 1`).bind(input.profileId,input.batchId).first<ParticipantRecord & {profile_id:string|null}>();
    if (concurrent) return concurrent;
    throw error;
  }
  return{id,batch_id:input.batchId,name:input.name,normalized_name:input.normalizedName,profile_id:input.profileId};
}

export async function listParticipantAttempts(database: D1Database, participantId: string) {
  const result = await database.prepare(
    `SELECT id, stage, status, score, deadline_at FROM attempts
      WHERE participant_id = ? AND status <> 'RESET' ORDER BY created_at`,
  ).bind(participantId).all<{ id: string; stage: string; status: string; score: number | null; deadline_at: string }>();
  return result.results;
}
