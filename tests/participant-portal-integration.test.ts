import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { app } from "../worker/index";

function localDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE trainings(id TEXT PRIMARY KEY,name TEXT,is_deleted INTEGER DEFAULT 0);
    CREATE TABLE training_cohorts(id TEXT PRIMARY KEY,training_id TEXT,name TEXT,funding_source TEXT,start_date TEXT);
    CREATE TABLE participant_registration_links(id TEXT PRIMARY KEY,cohort_id TEXT,token TEXT UNIQUE,revoked_at TEXT);
    CREATE TABLE participant_profiles(id TEXT PRIMARY KEY,training_id TEXT,cohort_id TEXT,name TEXT,normalized_name TEXT,nik TEXT,birth_place TEXT,birth_date TEXT,address TEXT,photo_key TEXT,is_active INTEGER DEFAULT 1,updated_at TEXT,UNIQUE(cohort_id,nik));
    CREATE TABLE training_materials(id TEXT PRIMARY KEY,name TEXT,sort_order INTEGER);
    CREATE TABLE training_sessions(id TEXT PRIMARY KEY,slug TEXT,name TEXT,material_id TEXT,training_id TEXT,question_count INTEGER,duration_minutes INTEGER,passing_score INTEGER,status TEXT,pre_mode TEXT,pre_start_at TEXT,pre_end_at TEXT,pre_manual_open INTEGER,post_mode TEXT,post_start_at TEXT,post_end_at TEXT,post_manual_open INTEGER);
    CREATE TABLE batches(id TEXT PRIMARY KEY,training_session_id TEXT,cohort_id TEXT);
    CREATE TABLE participants(id TEXT PRIMARY KEY,batch_id TEXT,name TEXT,normalized_name TEXT,profile_id TEXT,UNIQUE(profile_id,batch_id));
    CREATE TABLE attempts(id TEXT PRIMARY KEY,participant_id TEXT,stage TEXT,status TEXT,score REAL,deadline_at TEXT,created_at TEXT);
    INSERT INTO trainings VALUES('t','Plate Welding',0);
    INSERT INTO training_cohorts VALUES('c1','t','Angkatan 1','RUPIAH_MURNI','2026-01-01');
    INSERT INTO training_cohorts VALUES('c2','t','Angkatan 1','PNBP','2026-01-01');
    INSERT INTO participant_registration_links VALUES('l1','c1','token-one',NULL);
    INSERT INTO participant_registration_links VALUES('l2','c2','token-two',NULL);
    INSERT INTO training_materials VALUES('m','Pengelasan Dasar',1);
    INSERT INTO training_sessions VALUES('s1','plate-welding','Tes','m','t',10,30,70,'ACTIVE','MANUAL',NULL,NULL,1,'MANUAL',NULL,NULL,0);
    INSERT INTO batches VALUES('b1','s1','c1');
    INSERT INTO batches VALUES('b2','s1','c2');
  `);
  const DB = {
    prepare(sql: string) {
      let args: unknown[] = [];
      return {
        bind(...values: unknown[]) { args = values; return this; },
        async first<T>() { return (sqlite.prepare(sql).get(...args as []) ?? null) as T | null; },
        async all<T>() { return { results: sqlite.prepare(sql).all(...args as []) as T[] }; },
        async run() { return { meta: { changes: sqlite.prepare(sql).run(...args as []).changes } }; },
      };
    },
  } as unknown as D1Database;
  const env = { DB, QUESTION_IMAGES: { async put() {}, async delete() {} } };
  return { sqlite, env };
}

function registrationBody(name: string, nik: string, extra: Record<string, string> = {}) {
  const body = new FormData();
  body.set("name", name); body.set("nik", nik);
  for (const [key, value] of Object.entries(extra)) body.set(key, value);
  return body;
}

describe("pendaftaran peserta dengan D1 lokal", () => {
  it("membuat satu profil pada angkatan yang tepat, mengulang tanpa duplikat, dan menampilkan nama resmi", async () => {
    const { sqlite, env } = localDb();
    const headers = { Origin: "http://localhost" };
    const first = await app.request("http://localhost/api/public/participants/registration/token-one", { method: "POST", headers, body: registrationBody("Cici", "2171128", { birthPlace: "Medan" }) }, env);
    expect(first.status).toBe(200);
    const repeated = await app.request("http://localhost/api/public/participants/registration/token-one", { method: "POST", headers, body: registrationBody("Nama Salah", "2171128", { birthPlace: "Batam", address: "Alamat baru" }) }, env);
    expect(repeated.status).toBe(200);
    expect((await repeated.json() as { participant: { name: string } }).participant.name).toBe("Cici");
    expect(sqlite.prepare("SELECT COUNT(*) n FROM participant_profiles WHERE cohort_id='c1'").get()).toMatchObject({ n: 1 });
    expect(sqlite.prepare("SELECT birth_place,address FROM participant_profiles WHERE cohort_id='c1'").get()).toMatchObject({ birth_place: "Medan", address: "Alamat baru" });
    const dashboard = await app.request("http://localhost/api/public/participants/dashboard", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ trainingId: "t", cohortId: "c1", name: "Nama Salah", nik: "2171128" }) }, env);
    expect(dashboard.status).toBe(422); // Invalid non-UUID IDs are rejected before lookup.
    sqlite.close();
  });

  it("menolak link yang dicabut tanpa menghapus profil lama", async () => {
    const { sqlite, env } = localDb();
    const headers = { Origin: "http://localhost" };
    const registered = await app.request("http://localhost/api/public/participants/registration/token-one", { method: "POST", headers, body: registrationBody("Cici", "2171128") }, env);
    expect(registered.status).toBe(200);
    sqlite.exec("UPDATE participant_registration_links SET revoked_at='2026-11-04' WHERE token='token-one'");
    const rejected = await app.request("http://localhost/api/public/participants/registration/token-one", { method: "POST", headers, body: registrationBody("Ani", "2171129") }, env);
    expect(rejected.status).toBe(404);
    expect(sqlite.prepare("SELECT COUNT(*) n FROM participant_profiles WHERE cohort_id='c1'").get()).toMatchObject({ n: 1 });
    sqlite.close();
  });

  it("menjaga NIK yang sama di dua Angkatan tetap terpisah", async () => {
    const { sqlite, env } = localDb();
    const headers = { Origin: "http://localhost" };
    await app.request("http://localhost/api/public/participants/registration/token-one", { method: "POST", headers, body: registrationBody("Cici RM", "2171128") }, env);
    await app.request("http://localhost/api/public/participants/registration/token-two", { method: "POST", headers, body: registrationBody("Cici PNBP", "2171128") }, env);
    expect(sqlite.prepare("SELECT cohort_id,name FROM participant_profiles ORDER BY cohort_id").all()).toMatchObject([{ cohort_id: "c1", name: "Cici RM" }, { cohort_id: "c2", name: "Cici PNBP" }]);
    sqlite.close();
  });

  it("dashboard menemukan peserta menurut NIK dan Angkatan serta membaca attempt yang nyata", async () => {
    const { sqlite, env } = localDb();
    const trainingId = "11111111-1111-4111-8111-111111111111";
    const cohortId = "22222222-2222-4222-8222-222222222222";
    sqlite.prepare("INSERT INTO trainings VALUES(?,?,0)").run(trainingId, "Las");
    sqlite.prepare("INSERT INTO training_cohorts VALUES(?,?,?,?,?)").run(cohortId, trainingId, "Angkatan 1", "RUPIAH_MURNI", "2026-01-01");
    sqlite.prepare("INSERT INTO participant_profiles(id,training_id,cohort_id,name,normalized_name,nik,birth_place,birth_date,address,is_active) VALUES(?,?,?,?,?,?,?,?,?,1)")
      .run("p1", trainingId, cohortId, "Nama Resmi", "nama resmi", "2171128", "", "", "");
    sqlite.prepare("INSERT INTO training_sessions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run("s2", "las-test", "Tes Las", "m", trainingId, 10, 30, 70, "ACTIVE", "MANUAL", null, null, 1, "MANUAL", null, null, 0);
    sqlite.prepare("INSERT INTO batches VALUES(?,?,?)").run("b3", "s2", cohortId);
    const headers = { Origin: "http://localhost", "Content-Type": "application/json" };
    const body = JSON.stringify({ trainingId, cohortId, name: "Nama Salah", nik: "2171128" });
    const first = await app.request("http://localhost/api/public/participants/dashboard", { method: "POST", headers, body }, env);
    expect(first.status).toBe(200);
    const firstPayload = await first.json() as { participant: { name: string }; tests: Array<{ participantId: string; attempts: unknown[]; preOpen: boolean; postOpen: boolean }> };
    expect(firstPayload.participant.name).toBe("Nama Resmi");
    expect(firstPayload.tests).toHaveLength(1);
    expect(firstPayload.tests[0]).toMatchObject({ preOpen: true, postOpen: false, attempts: [] });
    sqlite.prepare("INSERT INTO attempts VALUES(?,?,?,?,?,?,?)").run("a1", firstPayload.tests[0]!.participantId, "PRE", "SUBMITTED", 80, null, "2026-11-04");
    const second = await app.request("http://localhost/api/public/participants/dashboard", { method: "POST", headers, body }, env);
    const secondPayload = await second.json() as { tests: Array<{ attempts: Array<{ stage: string; status: string }> }> };
    expect(secondPayload.tests[0]?.attempts).toMatchObject([{ stage: "PRE", status: "SUBMITTED" }]);
    expect(sqlite.prepare("SELECT COUNT(*) n FROM participants WHERE profile_id='p1' AND batch_id='b3'").get()).toMatchObject({ n: 1 });
    sqlite.close();
  });
});
