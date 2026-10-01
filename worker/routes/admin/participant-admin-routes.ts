import { Hono, type Context } from "hono";
import { z } from "zod";
import * as XLSX from "xlsx";
import { zipSync } from "fflate";
import { PDFDocument, clip, endPath, popGraphicsState, pushGraphicsState, rectangle, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import bookmanRegularDataUri from "../../assets/fonts/URWBookman-Light.otf?inline";
import bookmanBoldDataUri from "../../assets/fonts/URWBookman-Demi.otf?inline";
import { requireAdmin, requireCsrf, requireSameOrigin } from "../../middleware/admin-auth";
import { HttpError } from "../../http/errors";
import { cleanParticipantName, normalizeParticipantName } from "../../domain/participants/normalize-name";
import { maskNik, normalizeNik } from "../../domain/participants/normalize-nik";
import { parseImportedNik } from "../../domain/participants/import-validation";
import { createXlsx } from "../../export/xlsx";
import { formatDateForDisplay } from "../../domain/dates/date-format";
import { A4_LANDSCAPE, certificateLayout, mm } from "../../domain/certificates/print-layout";
import type { AppEnvironment } from "../../types";

export const participantAdminRoutes = new Hono<AppEnvironment>();
participantAdminRoutes.use("*", requireAdmin);

const trainingInput = z.object({ name: z.string().trim().min(3).max(200), description: z.string().trim().max(1000).nullable().optional(), isActive: z.boolean().default(true) });
const materialInput = z.object({ trainingId: z.string().min(1), name: z.string().trim().min(2).max(200), jp: z.number().int().positive().max(999), sortOrder: z.number().int().positive().max(999) });
const cohortInput = z.object({ trainingId: z.string().min(1), name: z.string().trim().min(1).max(100), startDate: z.string().date(), endDate: z.string().date(), status: z.enum(["ACTIVE", "INACTIVE", "COMPLETED"]) }).refine((v) => v.endDate >= v.startDate, "Tanggal selesai harus setelah tanggal mulai.");
const bulkCohortInput = z.object({
  trainingId: z.string().min(1),
  cohorts: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    startDate: z.string().date(),
    endDate: z.string().date(),
    status: z.enum(["ACTIVE", "INACTIVE", "COMPLETED"]),
  }).refine((value) => value.endDate >= value.startDate, "Tanggal selesai harus setelah tanggal mulai.")).min(1).max(100),
});
const participantInput = z.object({ trainingId: z.string().min(1), cohortId: z.string().min(1), name: z.string().trim().min(2).max(150), nik: z.string().trim().min(3).max(40), birthPlace: z.string().trim().min(2).max(120), birthDate: z.string().date(), isActive: z.boolean().default(true) });
const allowedParticipantImages = new Map([["image/jpeg", "jpg"], ["image/png", "png"]]);

function validationError(parsed: { success: false; error: z.ZodError }) {
  return new HttpError(422, "DATA_INVALID", parsed.error.issues[0]?.message ?? "Data tidak valid.");
}

async function requireMatchingCohort(database: D1Database, trainingId: string, cohortId: string) {
  const cohort = await database.prepare(
    `SELECT id FROM training_cohorts WHERE id = ? AND training_id = ?`,
  ).bind(cohortId, trainingId).first();
  if (!cohort) throw new HttpError(422, "COHORT_INVALID", "Angkatan tidak sesuai pelatihan.");
}

participantAdminRoutes.get("/catalog", async (c) => {
  const [trainings, materials, cohorts] = await Promise.all([
    c.env.DB.prepare(`SELECT trainings.*, (SELECT COUNT(*) FROM training_materials WHERE training_id=trainings.id) material_count, (SELECT COALESCE(SUM(jp),0) FROM training_materials WHERE training_id=trainings.id) total_jp FROM trainings WHERE trainings.is_deleted=0 ORDER BY name COLLATE NOCASE`).all(),
    c.env.DB.prepare(`SELECT materials.*, trainings.name training_name, banks.id bank_id, banks.name bank_name FROM training_materials materials JOIN trainings ON trainings.id=materials.training_id LEFT JOIN question_banks banks ON banks.material_id=materials.id AND banks.is_active=1 WHERE trainings.is_deleted=0 ORDER BY trainings.name, materials.sort_order`).all(),
    c.env.DB.prepare(`SELECT cohorts.*, trainings.name training_name, (SELECT COUNT(*) FROM participant_profiles WHERE cohort_id=cohorts.id) participant_count FROM training_cohorts cohorts JOIN trainings ON trainings.id=cohorts.training_id WHERE trainings.is_deleted=0 ORDER BY cohorts.start_date DESC, cohorts.name`).all(),
  ]);
  return c.json({ trainings: trainings.results, materials: materials.results, cohorts: cohorts.results });
});

participantAdminRoutes.post("/trainings", requireSameOrigin, requireCsrf, async (c) => {
  const parsed = trainingInput.safeParse(await c.req.json().catch(() => null)); if (!parsed.success) throw validationError(parsed);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO trainings(id,name,description,is_active) VALUES(?,?,?,?)`).bind(id, parsed.data.name, parsed.data.description ?? null, parsed.data.isActive ? 1 : 0).run();
  return c.json({ id }, 201);
});
participantAdminRoutes.put("/trainings/:id", requireSameOrigin, requireCsrf, async (c) => {
  const parsed = trainingInput.safeParse(await c.req.json().catch(() => null)); if (!parsed.success) throw validationError(parsed);
  await c.env.DB.prepare(`UPDATE trainings SET name=?,description=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(parsed.data.name, parsed.data.description ?? null, parsed.data.isActive ? 1 : 0, c.req.param("id")).run();
  return c.json({ success: true });
});
participantAdminRoutes.delete("/trainings/:id", requireSameOrigin, requireCsrf, async (c) => {
  const training=await c.env.DB.prepare(`SELECT id FROM trainings WHERE id=? AND is_deleted=0`).bind(c.req.param("id")).first();
  if(!training)throw new HttpError(404,"TRAINING_NOT_FOUND","Pelatihan tidak ditemukan atau sudah dihapus.");
  await c.env.DB.prepare(`UPDATE trainings SET is_deleted=1,is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(c.req.param("id")).run();
  return c.json({success:true,preservedHistory:true});
});
participantAdminRoutes.post("/materials", requireSameOrigin, requireCsrf, async (c) => {
  const parsed = materialInput.safeParse(await c.req.json().catch(() => null)); if (!parsed.success) throw validationError(parsed);
  const id=crypto.randomUUID();
  try { await c.env.DB.prepare(`INSERT INTO training_materials(id,training_id,name,jp,sort_order) VALUES(?,?,?,?,?)`).bind(id,parsed.data.trainingId,parsed.data.name,parsed.data.jp,parsed.data.sortOrder).run(); }
  catch(e){ if(String(e).includes("UNIQUE")) throw new HttpError(409,"MATERIAL_DUPLICATE","Nama atau urutan materi sudah digunakan pada pelatihan ini."); throw e; }
  return c.json({ id },201);
});
participantAdminRoutes.put("/materials/:id", requireSameOrigin, requireCsrf, async (c) => {
  const parsed=materialInput.safeParse(await c.req.json().catch(()=>null)); if(!parsed.success) throw validationError(parsed);
  const id=c.req.param("id");const current=await c.env.DB.prepare(`SELECT training_id,sort_order,EXISTS(SELECT 1 FROM question_banks WHERE material_id=training_materials.id) has_bank FROM training_materials WHERE id=?`).bind(id).first<{training_id:string;sort_order:number;has_bank:number}>();if(!current)throw new HttpError(404,"MATERIAL_NOT_FOUND","Materi tidak ditemukan.");if(current.has_bank&&current.training_id!==parsed.data.trainingId)throw new HttpError(409,"MATERIAL_IN_USE","Materi yang sudah memiliki Bank Soal tidak dapat dipindah ke pelatihan lain.");
  const conflict=await c.env.DB.prepare(`SELECT id,sort_order FROM training_materials WHERE training_id=? AND sort_order=? AND id<>?`).bind(parsed.data.trainingId,parsed.data.sortOrder,id).first<{id:string;sort_order:number}>();
  try{if(conflict&&current.training_id===parsed.data.trainingId){const maximum=await c.env.DB.prepare(`SELECT COALESCE(MAX(sort_order),0)+1000 temporary_order FROM training_materials WHERE training_id=?`).bind(parsed.data.trainingId).first<{temporary_order:number}>();await c.env.DB.batch([c.env.DB.prepare(`UPDATE training_materials SET sort_order=? WHERE id=?`).bind(maximum?.temporary_order??1000000,conflict.id),c.env.DB.prepare(`UPDATE training_materials SET name=?,jp=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(parsed.data.name,parsed.data.jp,parsed.data.sortOrder,id),c.env.DB.prepare(`UPDATE training_materials SET sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(current.sort_order,conflict.id)]);}else{await c.env.DB.prepare(`UPDATE training_materials SET training_id=?,name=?,jp=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(parsed.data.trainingId,parsed.data.name,parsed.data.jp,parsed.data.sortOrder,id).run();}}
  catch(e){if(String(e).includes("UNIQUE"))throw new HttpError(409,"MATERIAL_DUPLICATE","Nama atau urutan materi sudah digunakan pada pelatihan ini.");throw e;}return c.json({success:true});
});
participantAdminRoutes.delete("/materials/:id", requireSameOrigin, requireCsrf, async(c)=>{
  const deps=await c.env.DB.prepare(`SELECT EXISTS(SELECT 1 FROM question_banks WHERE material_id=?) used`).bind(c.req.param("id")).first<{used:number}>();
  if(deps?.used) throw new HttpError(409,"MATERIAL_IN_USE","Materi sudah memiliki Bank Soal dan tidak dapat dihapus.");
  await c.env.DB.prepare(`DELETE FROM training_materials WHERE id=?`).bind(c.req.param("id")).run(); return c.json({success:true});
});
participantAdminRoutes.post("/cohorts", requireSameOrigin, requireCsrf, async(c)=>{
  const parsed=cohortInput.safeParse(await c.req.json().catch(()=>null)); if(!parsed.success) throw validationError(parsed); const id=crypto.randomUUID();
  try{await c.env.DB.prepare(`INSERT INTO training_cohorts(id,training_id,name,start_date,end_date,status) VALUES(?,?,?,?,?,?)`).bind(id,parsed.data.trainingId,parsed.data.name,parsed.data.startDate,parsed.data.endDate,parsed.data.status).run();}catch(e){if(String(e).includes("UNIQUE"))throw new HttpError(409,"COHORT_DUPLICATE","Nama angkatan sudah digunakan pada pelatihan ini.");throw e;}return c.json({id},201);
});
participantAdminRoutes.post("/cohorts/bulk", requireSameOrigin, requireCsrf, async(c)=>{
  const parsed=bulkCohortInput.safeParse(await c.req.json().catch(()=>null));if(!parsed.success)throw validationError(parsed);
  const normalizedNames=parsed.data.cohorts.map((cohort)=>cohort.name.trim().toLocaleLowerCase("id"));
  const duplicateInRequest=normalizedNames.find((name,index)=>normalizedNames.indexOf(name)!==index);
  if(duplicateInRequest){const duplicate=parsed.data.cohorts[normalizedNames.indexOf(duplicateInRequest)];throw new HttpError(409,"COHORT_DUPLICATE",`Nama angkatan “${duplicate?.name??duplicateInRequest}” muncul lebih dari sekali pada preview.`);}
  const training=await c.env.DB.prepare(`SELECT id FROM trainings WHERE id=? AND is_deleted=0`).bind(parsed.data.trainingId).first();
  if(!training)throw new HttpError(404,"TRAINING_NOT_FOUND","Pelatihan tidak ditemukan.");
  const existing=await c.env.DB.prepare(`SELECT name FROM training_cohorts WHERE training_id=? AND lower(name) IN (SELECT lower(value) FROM json_each(?)) ORDER BY name`).bind(parsed.data.trainingId,JSON.stringify(parsed.data.cohorts.map((cohort)=>cohort.name.trim()))).all<{name:string}>();
  if(existing.results.length)throw new HttpError(409,"COHORT_DUPLICATE",`Angkatan berikut sudah terdaftar pada pelatihan ini: ${existing.results.map((cohort)=>cohort.name).join(", ")}.`);
  const statements=parsed.data.cohorts.map((cohort)=>c.env.DB.prepare(`INSERT INTO training_cohorts(id,training_id,name,start_date,end_date,status) VALUES(?,?,?,?,?,?)`).bind(crypto.randomUUID(),parsed.data.trainingId,cohort.name.trim(),cohort.startDate,cohort.endDate,cohort.status));
  try{await c.env.DB.batch(statements);}catch(e){if(String(e).includes("UNIQUE"))throw new HttpError(409,"COHORT_DUPLICATE","Salah satu nama angkatan sudah digunakan pada pelatihan ini.");throw e;}
  return c.json({created:statements.length},201);
});
participantAdminRoutes.put("/cohorts/:id", requireSameOrigin, requireCsrf, async(c)=>{
  const parsed=cohortInput.safeParse(await c.req.json().catch(()=>null)); if(!parsed.success) throw validationError(parsed);
  const id=c.req.param("id");const current=await c.env.DB.prepare(`SELECT training_id,(EXISTS(SELECT 1 FROM participant_profiles WHERE cohort_id=training_cohorts.id) OR EXISTS(SELECT 1 FROM batches WHERE cohort_id=training_cohorts.id)) AS in_use FROM training_cohorts WHERE id=?`).bind(id).first<{training_id:string;in_use:number}>();if(!current)throw new HttpError(404,"COHORT_NOT_FOUND","Angkatan tidak ditemukan.");if(current.in_use&&current.training_id!==parsed.data.trainingId)throw new HttpError(409,"COHORT_IN_USE","Angkatan yang sudah digunakan tidak dapat dipindah ke pelatihan lain.");
  try{await c.env.DB.prepare(`UPDATE training_cohorts SET training_id=?,name=?,start_date=?,end_date=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(parsed.data.trainingId,parsed.data.name,parsed.data.startDate,parsed.data.endDate,parsed.data.status,id).run();}catch(e){if(String(e).includes("UNIQUE"))throw new HttpError(409,"COHORT_DUPLICATE","Nama angkatan sudah digunakan pada pelatihan ini.");throw e;}return c.json({success:true});
});

participantAdminRoutes.get("/participants", async(c)=>{
  const conditions:string[]=[]; const bindings:string[]=[];
  if(c.req.query("trainingId")){conditions.push("profiles.training_id=?");bindings.push(c.req.query("trainingId")!);} if(c.req.query("cohortId")){conditions.push("profiles.cohort_id=?");bindings.push(c.req.query("cohortId")!);} if(c.req.query("search")){conditions.push("profiles.normalized_name LIKE ?");bindings.push(`%${normalizeParticipantName(c.req.query("search")!)}%`);}
  const where=conditions.length?`WHERE ${conditions.join(" AND ")}`:"";
  const result=await c.env.DB.prepare(`SELECT profiles.*, trainings.name training_name, cohorts.name cohort_name FROM participant_profiles profiles JOIN trainings ON trainings.id=profiles.training_id JOIN training_cohorts cohorts ON cohorts.id=profiles.cohort_id ${where} ORDER BY profiles.name COLLATE NOCASE`).bind(...bindings).all<Record<string,unknown>>();
  return c.json({participants:result.results.map(r=>({...r,nik_masked:maskNik(String(r.nik)),nik:undefined}))});
});
participantAdminRoutes.delete("/participants/bulk", requireSameOrigin, requireCsrf, async(c)=>{
  const parsed=z.object({participantIds:z.array(z.string().uuid()).min(1).max(5000)}).safeParse(await c.req.json().catch(()=>null));
  if(!parsed.success)throw validationError(parsed);
  const participantIds=[...new Set(parsed.data.participantIds)];
  const idsJson=JSON.stringify(participantIds);
  const profiles=await c.env.DB.prepare(`SELECT id,photo_key FROM participant_profiles WHERE id IN (SELECT value FROM json_each(?))`).bind(idsJson).all<{id:string;photo_key:string|null}>();
  if(!profiles.results.length)throw new HttpError(404,"PARTICIPANT_NOT_FOUND","Tidak ada peserta yang cocok untuk dihapus.");
  const existingIdsJson=JSON.stringify(profiles.results.map((profile)=>profile.id));
  const certificates=await c.env.DB.prepare(`SELECT pdf_key FROM certificates WHERE participant_profile_id IN (SELECT value FROM json_each(?)) AND pdf_key IS NOT NULL`).bind(existingIdsJson).all<{pdf_key:string}>();
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM certificates WHERE participant_profile_id IN (SELECT value FROM json_each(?))`).bind(existingIdsJson),
    c.env.DB.prepare(`DELETE FROM participants WHERE profile_id IN (SELECT value FROM json_each(?))`).bind(existingIdsJson),
    c.env.DB.prepare(`DELETE FROM participant_profiles WHERE id IN (SELECT value FROM json_each(?))`).bind(existingIdsJson),
  ]);
  const objectKeys=[...profiles.results.map((profile)=>profile.photo_key),...certificates.results.map((certificate)=>certificate.pdf_key)].filter((key):key is string=>Boolean(key));
  await Promise.all(objectKeys.map((key)=>c.env.QUESTION_IMAGES.delete(key)));
  return c.json({deleted:profiles.results.length});
});
participantAdminRoutes.get("/participants/:id", async(c)=>{
  const row=await c.env.DB.prepare(`SELECT profiles.*,trainings.name training_name,cohorts.name cohort_name FROM participant_profiles profiles JOIN trainings ON trainings.id=profiles.training_id JOIN training_cohorts cohorts ON cohorts.id=profiles.cohort_id WHERE profiles.id=?`).bind(c.req.param("id")).first(); if(!row) throw new HttpError(404,"PARTICIPANT_NOT_FOUND","Peserta tidak ditemukan."); return c.json({participant:row});
});
participantAdminRoutes.post("/participants", requireSameOrigin, requireCsrf, async(c)=>{
  const parsed=participantInput.safeParse(await c.req.json().catch(()=>null)); if(!parsed.success) throw validationError(parsed); const d=parsed.data; await requireMatchingCohort(c.env.DB,d.trainingId,d.cohortId);
  const id=crypto.randomUUID(); try{await c.env.DB.prepare(`INSERT INTO participant_profiles(id,training_id,cohort_id,name,normalized_name,nik,birth_place,birth_date,is_active) VALUES(?,?,?,?,?,?,?,?,?)`).bind(id,d.trainingId,d.cohortId,cleanParticipantName(d.name),normalizeParticipantName(d.name),normalizeNik(d.nik),d.birthPlace,d.birthDate,d.isActive?1:0).run();}catch(e){if(String(e).includes("UNIQUE"))throw new HttpError(409,"PARTICIPANT_DUPLICATE","NIK sudah terdaftar pada angkatan ini.");throw e;} return c.json({id},201);
});
participantAdminRoutes.put("/participants/:id", requireSameOrigin, requireCsrf, async(c)=>{
  const parsed=participantInput.safeParse(await c.req.json().catch(()=>null)); if(!parsed.success) throw validationError(parsed); const d=parsed.data;
  await requireMatchingCohort(c.env.DB,d.trainingId,d.cohortId);
  const profileId=c.req.param("id");const existing=await c.env.DB.prepare(`SELECT training_id,cohort_id,EXISTS(SELECT 1 FROM participants WHERE profile_id=participant_profiles.id) has_exam FROM participant_profiles WHERE id=?`).bind(profileId).first<{training_id:string;cohort_id:string;has_exam:number}>();if(!existing)throw new HttpError(404,"PARTICIPANT_NOT_FOUND","Peserta tidak ditemukan.");if(existing.has_exam&&(existing.training_id!==d.trainingId||existing.cohort_id!==d.cohortId))throw new HttpError(409,"PARTICIPANT_HAS_ATTEMPTS","Pelatihan atau angkatan tidak dapat dipindah setelah peserta mulai ujian.");const cleanName=cleanParticipantName(d.name);const normalizedName=normalizeParticipantName(d.name);
  try { await c.env.DB.batch([c.env.DB.prepare(`UPDATE participant_profiles SET training_id=?,cohort_id=?,name=?,normalized_name=?,nik=?,birth_place=?,birth_date=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(d.trainingId,d.cohortId,cleanName,normalizedName,normalizeNik(d.nik),d.birthPlace,d.birthDate,d.isActive?1:0,profileId),c.env.DB.prepare(`UPDATE participants SET name=?,normalized_name=?,updated_at=CURRENT_TIMESTAMP WHERE profile_id=?`).bind(cleanName,normalizedName,profileId)]); }
  catch(e){if(String(e).includes("UNIQUE"))throw new HttpError(409,"PARTICIPANT_DUPLICATE","NIK sudah terdaftar pada angkatan ini.");throw e;} return c.json({success:true});
});
participantAdminRoutes.post("/participants/:id/photo", requireSameOrigin, requireCsrf, async(c)=>{
  const form=await c.req.formData(); const file=form.get("photo"); const ext=file instanceof File?allowedParticipantImages.get(file.type):undefined; if(!(file instanceof File)||!ext||file.size>5_000_000) throw new HttpError(422,"PHOTO_INVALID","Foto harus berupa JPG atau PNG maksimal 5 MB."); const old=await c.env.DB.prepare(`SELECT photo_key FROM participant_profiles WHERE id=?`).bind(c.req.param("id")).first<{photo_key:string|null}>(); if(!old)throw new HttpError(404,"PARTICIPANT_NOT_FOUND","Peserta tidak ditemukan."); const key=`participants/${c.req.param("id")}/${crypto.randomUUID()}.${ext}`; await c.env.QUESTION_IMAGES.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}}); await c.env.DB.prepare(`UPDATE participant_profiles SET photo_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(key,c.req.param("id")).run(); if(old.photo_key)await c.env.QUESTION_IMAGES.delete(old.photo_key); return c.json({success:true});
});
participantAdminRoutes.get("/participants/:id/photo", async(c)=>{const row=await c.env.DB.prepare(`SELECT photo_key FROM participant_profiles WHERE id=?`).bind(c.req.param("id")).first<{photo_key:string|null}>(); if(!row?.photo_key)throw new HttpError(404,"PHOTO_NOT_FOUND","Foto tidak ditemukan."); const object=await c.env.QUESTION_IMAGES.get(row.photo_key); if(!object)throw new HttpError(404,"PHOTO_NOT_FOUND","Foto tidak ditemukan."); return new Response(object.body,{headers:{"Content-Type":object.httpMetadata?.contentType??"image/jpeg","Cache-Control":"private, max-age=300"}});});

participantAdminRoutes.get("/participants-template", async()=>{
  const bytes=createXlsx([
    {
      name:"Data Peserta",
      rows:[
        ["No","Nama Lengkap","NIK","Tempat Lahir","Tanggal Lahir"],
        [1,"Ade Febriyanti","1271054102860002","Medan","1986-02-01"],
        [2,"Budi Santoso","1271051206880001","Medan","1988-06-12"],
        [3,"Citra Lestari","1271055501950003","Binjai","1995-01-15"],
        [4,"Dedi Irawan","1271051205800004","Deli Serdang","1980-05-12"],
        [5,"Eka Putri","1271054001970005","Medan","1997-01-01"],
      ],
      textColumns:[2],
      dateColumns:[4],
      columnWidths:[8,28,22,22,18],
    },
    {
      name:"Petunjuk",
      rows:[
        ["Petunjuk Import Peserta","Keterangan"],
        ["Nama Lengkap","Wajib. Isi sesuai identitas peserta."],
        ["NIK","Wajib. Tepat 16 digit angka dan disimpan sebagai Teks. Tidak perlu menambahkan tanda apostrof."],
        ["Tempat Lahir","Wajib."],
        ["Tanggal Lahir","Wajib. Gunakan format DD/MM/YYYY."],
        ["Pelatihan & Angkatan","Tidak perlu ditulis di Excel. Pilih di aplikasi sebelum preview."],
        ["Foto","Tidak dimasukkan ke Excel. Unggah foto terpisah setelah peserta berhasil diimport."],
      ],
      columnWidths:[28,92],
      autoFilter:false,
    },
  ]);
  return new Response(bytes.slice().buffer as ArrayBuffer,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":'attachment; filename="Template-Import-Peserta-BDI.xlsx"',"Cache-Control":"no-store"}});
});

function validCalendarDate(year:number,month:number,day:number){const date=new Date(Date.UTC(year,month-1,day));return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;}
function formatCalendarDate(year:number,month:number,day:number){return validCalendarDate(year,month,day)?`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`:"";}
function excelDate(value:unknown){
  if(value instanceof Date)return formatCalendarDate(value.getFullYear(),value.getMonth()+1,value.getDate());
  if(typeof value==="number"){const date=XLSX.SSF.parse_date_code(value);return date?formatCalendarDate(date.y,date.m,date.d):"";}
  const text=String(value??"").trim();
  const iso=text.match(/^(\d{4})[-/]([01]?\d)[-/]([0-3]?\d)$/);
  if(iso)return formatCalendarDate(Number(iso[1]),Number(iso[2]),Number(iso[3]));
  const local=text.match(/^([0-3]?\d)[-/]([01]?\d)[-/](\d{4})$/);
  return local?formatCalendarDate(Number(local[3]),Number(local[2]),Number(local[1])):"";
}

participantAdminRoutes.post("/participants/import-preview", requireSameOrigin, requireCsrf, async(c)=>{
  const form=await c.req.formData();const file=form.get("file");
  if(!(file instanceof File)||file.size>8_000_000||!(/\.(xlsx|xls)$/iu.test(file.name)))throw new HttpError(422,"FILE_INVALID","Pilih file Excel .xlsx atau .xls maksimal 8 MB.");
  const trainingId=String(form.get("trainingId")??"");const cohortId=String(form.get("cohortId")??"");await requireMatchingCohort(c.env.DB,trainingId,cohortId);
  const existingRows=(await c.env.DB.prepare(`SELECT nik FROM participant_profiles WHERE cohort_id=?`).bind(cohortId).all<{nik:string}>()).results;
  const existing=new Set(existingRows.map((row)=>normalizeNik(row.nik)));const fileNiks=new Set<string>();
  let workbook:XLSX.WorkBook;try{workbook=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:false});}catch{throw new HttpError(422,"FILE_INVALID","File Excel tidak dapat dibaca.");}
  const sheet=workbook.Sheets[workbook.SheetNames[0]!];if(!sheet)throw new HttpError(422,"FILE_INVALID","Sheet data peserta tidak ditemukan.");
  const raw=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:"",raw:true});
  const rows=raw.map((record,index)=>{
    const name=String(record["Nama Lengkap"]??"").trim();const parsedNik=parseImportedNik(record.NIK);const nik=parsedNik.nik;
    const birthPlace=String(record["Tempat Lahir"]??"").trim();const birthDate=excelDate(record["Tanggal Lahir"]);const errors:string[]=[];
    if(!name)errors.push("Nama kosong");
    if(!nik)errors.push("NIK wajib");else if(parsedNik.error)errors.push(parsedNik.error);else if(!/^\d{16}$/u.test(nik))errors.push("NIK harus 16 digit angka");
    if(!birthPlace)errors.push("Tempat lahir kosong");if(!birthDate)errors.push("Tanggal lahir tidak valid");
    if(nik&&existing.has(nik))errors.push("Peserta sudah terdaftar");else if(nik&&fileNiks.has(nik))errors.push("NIK duplikat dalam file");
    if(nik)fileNiks.add(nik);
    return{row:index+2,name,nik,birthPlace,birthDate,errors};
  });
  return c.json({rows});
});

participantAdminRoutes.post("/participants/import", requireSameOrigin, requireCsrf, async(c)=>{
  const parsed=z.object({trainingId:z.string().min(1),cohortId:z.string().min(1),rows:z.array(z.object({name:z.string().trim().min(1),nik:z.string().regex(/^\d{16}$/u,"NIK harus 16 digit angka"),birthPlace:z.string().trim().min(1),birthDate:z.string().date()})).min(1).max(1000)}).safeParse(await c.req.json().catch(()=>null));
  if(!parsed.success)throw validationError(parsed);const data=parsed.data;await requireMatchingCohort(c.env.DB,data.trainingId,data.cohortId);
  const existing=await c.env.DB.prepare(`SELECT nik FROM participant_profiles WHERE cohort_id=?`).bind(data.cohortId).all<{nik:string}>();const seen=new Set(existing.results.map((row)=>normalizeNik(row.nik)));const statements:D1PreparedStatement[]=[];
  for(const row of data.rows){const nik=normalizeNik(row.nik);if(seen.has(nik))throw new HttpError(409,"PARTICIPANT_DUPLICATE",`NIK ${maskNik(nik)} sudah terdaftar atau duplikat di dalam file.`);seen.add(nik);statements.push(c.env.DB.prepare(`INSERT INTO participant_profiles(id,training_id,cohort_id,name,normalized_name,nik,birth_place,birth_date) VALUES(?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),data.trainingId,data.cohortId,cleanParticipantName(row.name),normalizeParticipantName(row.name),nik,row.birthPlace,row.birthDate));}
  await c.env.DB.batch(statements);return c.json({imported:statements.length});
});

participantAdminRoutes.get("/certificates", async(c)=>{const result=await c.env.DB.prepare(`WITH scores AS (SELECT p.profile_id,MAX(CASE WHEN a.stage<>'PRE' AND a.status='SUBMITTED' THEN a.score END) final_score,MAX(s.passing_score) passing_score FROM participants p JOIN attempts a ON a.participant_id=p.id JOIN training_sessions s ON s.id=a.training_session_id WHERE p.profile_id IS NOT NULL GROUP BY p.profile_id) SELECT profiles.id participant_id,profiles.name,profiles.nik,profiles.training_id,profiles.cohort_id,trainings.name training_name,cohorts.name cohort_name,scores.final_score,scores.passing_score,CASE WHEN scores.final_score>=scores.passing_score THEN 'LULUS' ELSE 'BELUM_LULUS' END graduation_status,certificates.id certificate_id,certificates.certificate_number,certificates.status certificate_status FROM participant_profiles profiles JOIN trainings ON trainings.id=profiles.training_id JOIN training_cohorts cohorts ON cohorts.id=profiles.cohort_id LEFT JOIN scores ON scores.profile_id=profiles.id LEFT JOIN certificates ON certificates.participant_profile_id=profiles.id ORDER BY profiles.name`).all<Record<string,unknown>>();return c.json({certificates:result.results.map(r=>({...r,nik_masked:maskNik(String(r.nik)),nik:undefined}))});});
participantAdminRoutes.get("/certificate-settings/:trainingId",async(c)=>{const row=await c.env.DB.prepare(`SELECT * FROM certificate_settings WHERE training_id=?`).bind(c.req.param("trainingId")).first();return c.json({settings:row??{training_id:c.req.param("trainingId"),certificate_prefix:"",signer_name:"",signer_title:"",signer_nip:"",issue_place:"",issue_date:"",offset_x_mm:0,offset_y_mm:0}});});
participantAdminRoutes.put("/certificate-settings/:trainingId",requireSameOrigin,requireCsrf,async(c)=>{const parsed=z.object({signerName:z.string().max(150),signerTitle:z.string().max(150),signerNip:z.string().max(80),issuePlace:z.string().max(120),issueDate:z.string().date(),offsetXmm:z.number().min(-20).max(20),offsetYmm:z.number().min(-20).max(20)}).safeParse(await c.req.json().catch(()=>null));if(!parsed.success)throw validationError(parsed);const d=parsed.data;await c.env.DB.prepare(`INSERT INTO certificate_settings(training_id,certificate_prefix,signer_name,signer_title,signer_nip,issue_place,issue_date,offset_x_mm,offset_y_mm) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(training_id) DO UPDATE SET signer_name=excluded.signer_name,signer_title=excluded.signer_title,signer_nip=excluded.signer_nip,issue_place=excluded.issue_place,issue_date=excluded.issue_date,offset_x_mm=excluded.offset_x_mm,offset_y_mm=excluded.offset_y_mm,updated_at=CURRENT_TIMESTAMP`).bind(c.req.param("trainingId"),"",d.signerName,d.signerTitle,d.signerNip,d.issuePlace,d.issueDate,d.offsetXmm,d.offsetYmm).run();return c.json({success:true});});
participantAdminRoutes.post("/certificate-settings/:trainingId/assets",requireSameOrigin,requireCsrf,async(c)=>{const form=await c.req.formData();const trainingId=c.req.param("trainingId");const updates:Array<{column:"signature_key"|"stamp_key"|"front_template_key"|"back_template_key";key:string}>=[];for(const [field,column] of [["signature","signature_key"],["stamp","stamp_key"],["frontTemplate","front_template_key"],["backTemplate","back_template_key"]] as const){const file=form.get(field);if(file instanceof File&&file.size){if(!file.type.startsWith("image/")||file.size>8_000_000)throw new HttpError(422,"IMAGE_INVALID","Tanda tangan, stempel, atau template harus berupa gambar maksimal 8 MB.");const ext=file.type.includes("png")?"png":"jpg";const key=`certificates/assets/${trainingId}/${field}-${crypto.randomUUID()}.${ext}`;await c.env.QUESTION_IMAGES.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});updates.push({column,key});}}await c.env.DB.prepare(`INSERT OR IGNORE INTO certificate_settings(training_id,certificate_prefix) VALUES(?,?)`).bind(trainingId,"").run();for(const item of updates)await c.env.DB.prepare(`UPDATE certificate_settings SET ${item.column}=?,updated_at=CURRENT_TIMESTAMP WHERE training_id=?`).bind(item.key,trainingId).run();return c.json({success:true});});

type CertificateSide="FRONT"|"BACK";
function safeText(value:unknown){return String(value??"").replace(/[^\x20-\x7E]/g,"-");}
function fontBytes(dataUri:string){const encoded=dataUri.slice(dataUri.indexOf(",")+1);const binary=atob(encoded);return Uint8Array.from(binary,(character)=>character.charCodeAt(0));}
function cohortLabel(value:unknown){const name=String(value??"").trim();return /^angkatan\b/i.test(name)?name:`Angkatan ${name}`;}
function trainingLabel(value:unknown){const name=String(value??"").trim();return /^pelatihan\b/i.test(name)?name:`Pelatihan ${name}`;}
function formatLongDate(value:string){const date=new Date(`${value}T00:00:00Z`);const months=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];return Number.isNaN(date.getTime())?value:`${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;}
async function certificateData(db:D1Database,profileId:string){return db.prepare(`WITH score AS (SELECT MAX(CASE WHEN a.stage<>'PRE' AND a.status='SUBMITTED' THEN a.score END) final_score,MAX(s.passing_score) passing_score FROM participants p JOIN attempts a ON a.participant_id=p.id JOIN training_sessions s ON s.id=a.training_session_id WHERE p.profile_id=?) SELECT p.*,t.name training_name,c.name cohort_name,c.start_date,c.end_date,(SELECT COALESCE(SUM(jp),0) FROM training_materials WHERE training_id=t.id) total_jp,score.final_score,score.passing_score,settings.signer_name,settings.signer_title,settings.signer_nip,settings.issue_place,settings.issue_date,settings.offset_x_mm,settings.offset_y_mm,settings.signature_key,settings.stamp_key,settings.front_template_key,settings.back_template_key FROM participant_profiles p JOIN trainings t ON t.id=p.training_id JOIN training_cohorts c ON c.id=p.cohort_id CROSS JOIN score LEFT JOIN certificate_settings settings ON settings.training_id=t.id WHERE p.id=?`).bind(profileId,profileId).first<Record<string,unknown>>();}
function point(page:any,x:number,y:number,d:Record<string,unknown>){return{x:mm(x+Number(d.offset_x_mm??0)),y:page.getHeight()-mm(y+Number(d.offset_y_mm??0))};}
function drawCentered(page:any,font:any,text:string,x:number,y:number,size:number,d:Record<string,unknown>){const p=point(page,x,y,d);page.drawText(safeText(text),{x:p.x-font.widthOfTextAtSize(safeText(text),size)/2,y:p.y,size,font,color:rgb(0,0,0)});}
function drawTextAt(page:any,font:any,text:string|undefined,x:number,y:number,size:number,d:Record<string,unknown>){const p=point(page,x,y,d);page.drawText(safeText(text),{x:p.x,y:p.y,size,font,color:rgb(0,0,0)});}
function drawWrapped(page:any,font:any,text:string,x:number,y:number,width:number,lineHeight:number,size:number,d:Record<string,unknown>){const words=safeText(text).split(/\s+/);let line="";let row=0;for(const word of words){const next=line?`${line} ${word}`:word;if(font.widthOfTextAtSize(next,size)<=mm(width)){line=next;continue;}const p=point(page,x,y+row*lineHeight,d);page.drawText(line,{x:p.x,y:p.y,font,size,color:rgb(0,0,0)});line=word;row++;}if(line){const p=point(page,x,y+row*lineHeight,d);page.drawText(line,{x:p.x,y:p.y,font,size,color:rgb(0,0,0)});}}
async function embedImage(c:Context<AppEnvironment>,pdf:PDFDocument,key:unknown){if(!key)return null;const obj=await c.env.QUESTION_IMAGES.get(String(key));if(!obj)return null;const bytes=await obj.arrayBuffer();try{return String(key).endsWith(".png")?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);}catch{return null;}}
function box(page:any,x:number,y:number,width:number,height:number,d:Record<string,unknown>){const p=point(page,x,y,d);return{x:p.x,y:p.y-mm(height),width:mm(width),height:mm(height)};}
function drawImageCover(page:any,image:any,layout:{x:number;y:number;width:number;height:number},d:Record<string,unknown>){const target=box(page,layout.x,layout.y,layout.width,layout.height,d);const scale=Math.max(target.width/image.width,target.height/image.height);const width=image.width*scale,height=image.height*scale;page.pushOperators(pushGraphicsState(),rectangle(target.x,target.y,target.width,target.height),clip(),endPath());page.drawImage(image,{x:target.x+(target.width-width)/2,y:target.y+(target.height-height)/2,width,height});page.pushOperators(popGraphicsState());page.drawRectangle({x:target.x,y:target.y,width:target.width,height:target.height,borderColor:rgb(.03,.03,.03),borderWidth:.7});}
function drawImageContained(page:any,image:any,layout:{x:number;y:number;width:number;height:number},d:Record<string,unknown>){const target=box(page,layout.x,layout.y,layout.width,layout.height,d);const scale=Math.min(target.width/image.width,target.height/image.height);const width=image.width*scale,height=image.height*scale;page.drawImage(image,{x:target.x+(target.width-width)/2,y:target.y+(target.height-height)/2,width,height});}
function drawRule(page:any,x1:number,y1:number,x2:number,y2:number,d:Record<string,unknown>){page.drawLine({start:point(page,x1,y1,d),end:point(page,x2,y2,d),thickness:.75,color:rgb(.03,.03,.03)});}
async function renderCertificate(c:Context<AppEnvironment>,profileId:string,side:CertificateSide,preview=false){const d=await certificateData(c.env.DB,profileId);if(!d)throw new HttpError(404,"PARTICIPANT_NOT_FOUND","Peserta tidak ditemukan.");if(Number(d.final_score??-1)<Number(d.passing_score??101))throw new HttpError(409,"NOT_ELIGIBLE","Sertifikat hanya dapat dibuat untuk peserta yang lulus.");if(!preview&&!d.issue_date)throw new HttpError(409,"ISSUE_DATE_REQUIRED","Atur tanggal penerbitan sertifikat terlebih dahulu.");const cert=await c.env.DB.prepare(`SELECT * FROM certificates WHERE participant_profile_id=?`).bind(profileId).first<Record<string,unknown>>();if(!preview&&!cert?.certificate_number)throw new HttpError(409,"CERTIFICATE_NUMBER_REQUIRED","Simpan nomor sertifikat resmi terlebih dahulu.");const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const regular=await pdf.embedFont(fontBytes(bookmanRegularDataUri));const bold=await pdf.embedFont(fontBytes(bookmanBoldDataUri));const page=pdf.addPage([mm(A4_LANDSCAPE.width),mm(A4_LANDSCAPE.height)]);if(preview){const template=await embedImage(c,pdf,side==="FRONT"?d.front_template_key:d.back_template_key);if(template)page.drawImage(template,{x:0,y:0,width:page.getWidth(),height:page.getHeight()});}
  if(side==="FRONT"){const l=certificateLayout.front;const number=String(cert?.certificate_number??"Nomor sertifikat belum diisi");drawCentered(page,bold,`NOMOR : ${number}`,l.number.x,l.number.y,12,d);drawTextAt(page,regular,"Dengan ini menyatakan bahwa:",l.declaration.x,l.declaration.y,12,d);const rows=[["Nama",String(d.name)],["NIK",String(d.nik)],["Tempat, tanggal lahir",`${d.birth_place}, ${formatLongDate(String(d.birth_date))}`]];rows.forEach(([label,value],index)=>{const y=l.label.y+index*l.label.lineHeight;drawTextAt(page,regular,label,l.label.x,y,12,d);drawTextAt(page,bold,`:  ${value}`,l.value.x,y,12,d);});const narrative=`telah menyelesaikan ${trainingLabel(d.training_name)} ${cohortLabel(d.cohort_name)} yang dilaksanakan pada tanggal ${formatLongDate(String(d.start_date))} s.d. ${formatLongDate(String(d.end_date))} selama ${d.total_jp} jam pelatihan dan dinyatakan LULUS.`;drawWrapped(page,regular,narrative,l.narrative.x,l.narrative.y,l.narrative.width,l.narrative.lineHeight,12,d);const photo=await embedImage(c,pdf,d.photo_key);if(photo)drawImageCover(page,photo,l.photo,d);drawCentered(page,regular,`${d.issue_place||"Medan"}, ${d.issue_date?formatLongDate(String(d.issue_date)):"Tanggal penerbitan belum diisi"}`,l.issue.x,l.issue.y,12,d);drawCentered(page,regular,String(d.signer_title||""),l.signerTitle.x,l.signerTitle.y,12,d);const stamp=await embedImage(c,pdf,d.stamp_key);if(stamp)drawImageContained(page,stamp,l.stamp,d);const signature=await embedImage(c,pdf,d.signature_key);if(signature)drawImageContained(page,signature,l.signature,d);drawCentered(page,bold,String(d.signer_name||""),l.signerName.x,l.signerName.y,12,d);drawCentered(page,bold,d.signer_nip?`NIP. ${d.signer_nip}`:"",l.signerNip.x,l.signerNip.y,12,d);
  }else{const l=certificateLayout.back;drawCentered(page,bold,"DAFTAR UNIT KOMPETENSI",l.heading.x,l.heading.y,15,d);const materials=await c.env.DB.prepare(`SELECT name,jp FROM training_materials WHERE training_id=? ORDER BY sort_order`).bind(d.training_id).all<{name:string;jp:number}>();const rowHeight=8;const rows=Math.max(materials.results.length,1);const headerBottom=l.table.top+l.table.headerHeight;const tableBottom=headerBottom+rows*rowHeight;const verticals=[l.table.number.left,l.table.number.right,l.table.material.right,l.table.jp.right,l.table.result.right];drawRule(page,l.table.x,l.table.top,l.table.x+l.table.width,l.table.top,d);drawRule(page,l.table.x,tableBottom,l.table.x+l.table.width,tableBottom,d);drawRule(page,l.table.x,headerBottom,l.table.x+l.table.width,headerBottom,d);for(const x of verticals)drawRule(page,x,l.table.top,x,tableBottom,d);for(let index=1;index<rows;index++)drawRule(page,l.table.x,headerBottom+index*rowHeight,l.table.x+l.table.width,headerBottom+index*rowHeight,d);const headerY=l.table.top+8;for(const [text,left,right] of [["No",l.table.number.left,l.table.number.right],["Unit Kompetensi",l.table.material.left,l.table.material.right],["Jam Pelajaran\n(JP)",l.table.jp.left,l.table.jp.right],["Hasil",l.table.result.left,l.table.result.right]] as const){const lines=text.split("\n");const yOffset=text.startsWith("Jam Pelajaran")?-2:0;lines.forEach((line,index)=>drawCentered(page,bold,line,(left+right)/2,headerY+yOffset+index*4.2,10,d));}materials.results.forEach((material,index)=>{const y=headerBottom+(index+.67)*rowHeight;drawCentered(page,regular,String(index+1),(l.table.number.left+l.table.number.right)/2,y,9.5,d);drawTextAt(page,regular,material.name,l.table.material.left+1.5,y,9.5,d);drawCentered(page,regular,String(material.jp),(l.table.jp.left+l.table.jp.right)/2,y,9.5,d);drawCentered(page,regular,"LULUS",(l.table.result.left+l.table.result.right)/2,y,9.5,d);});}
  return{bytes:await pdf.save(),certificateId:String(cert?.id??""),number:String(cert?.certificate_number??"")};}
participantAdminRoutes.put("/certificates/:participantId/number",requireSameOrigin,requireCsrf,async(c)=>{const parsed=z.object({certificateNumber:z.string().trim().min(1).max(120)}).safeParse(await c.req.json().catch(()=>null));if(!parsed.success)throw validationError(parsed);const d=await certificateData(c.env.DB,c.req.param("participantId"));if(!d||Number(d.final_score??-1)<Number(d.passing_score??101))throw new HttpError(409,"NOT_ELIGIBLE","Nomor hanya dapat disimpan untuk peserta yang lulus.");if(!d.issue_date)throw new HttpError(409,"ISSUE_DATE_REQUIRED","Atur tanggal penerbitan sertifikat terlebih dahulu.");const existing=await c.env.DB.prepare(`SELECT id FROM certificates WHERE participant_profile_id=?`).bind(c.req.param("participantId")).first<{id:string}>();if(existing)await c.env.DB.prepare(`UPDATE certificates SET certificate_number=?,issued_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(parsed.data.certificateNumber,d.issue_date,existing.id).run();else await c.env.DB.prepare(`INSERT INTO certificates(id,participant_profile_id,training_id,cohort_id,certificate_number,issued_at) VALUES(?,?,?,?,?,?)`).bind(crypto.randomUUID(),c.req.param("participantId"),d.training_id,d.cohort_id,parsed.data.certificateNumber,d.issue_date).run();return c.json({success:true});});
participantAdminRoutes.post("/certificates/:participantId/generate",requireSameOrigin,requireCsrf,async(c)=>{const parsed=z.object({side:z.enum(["FRONT","BACK","BOTH"]).default("BOTH")}).safeParse(await c.req.json().catch(()=>({})));if(!parsed.success)throw validationError(parsed);let last:{certificateId:string}|null=null;const sides:CertificateSide[]=parsed.data.side==="BOTH"?["FRONT","BACK"]:[parsed.data.side];for(const side of sides){const result=await renderCertificate(c,c.req.param("participantId"),side);const key=`certificates/${c.req.param("participantId")}/${side.toLowerCase()}.pdf`;await c.env.QUESTION_IMAGES.put(key,result.bytes,{httpMetadata:{contentType:"application/pdf"}});await c.env.DB.prepare(`UPDATE certificates SET ${side==="FRONT"?"pdf_key":"back_pdf_key"}=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(key,result.certificateId).run();last=result;}return c.json({success:true,certificateId:last?.certificateId});});
participantAdminRoutes.post("/certificates/generate-all",requireSameOrigin,requireCsrf,async(c)=>{const parsed=z.object({trainingId:z.string(),cohortId:z.string(),side:z.enum(["FRONT","BACK","BOTH"]).default("BOTH")}).safeParse(await c.req.json().catch(()=>null));if(!parsed.success)throw validationError(parsed);const rows=await c.env.DB.prepare(`SELECT id FROM participant_profiles WHERE training_id=? AND cohort_id=? AND is_active=1`).bind(parsed.data.trainingId,parsed.data.cohortId).all<{id:string}>();let generated=0;for(const row of rows.results){try{const sides:CertificateSide[]=parsed.data.side==="BOTH"?["FRONT","BACK"]:[parsed.data.side];for(const side of sides){const result=await renderCertificate(c,row.id,side);const key=`certificates/${row.id}/${side.toLowerCase()}.pdf`;await c.env.QUESTION_IMAGES.put(key,result.bytes,{httpMetadata:{contentType:"application/pdf"}});await c.env.DB.prepare(`UPDATE certificates SET ${side==="FRONT"?"pdf_key":"back_pdf_key"}=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(key,result.certificateId).run();}generated++;}catch(e){if(!(e instanceof HttpError&&(e.code==="NOT_ELIGIBLE"||e.code==="CERTIFICATE_NUMBER_REQUIRED")))throw e;}}return c.json({generated});});
participantAdminRoutes.post("/certificates/download-all",requireSameOrigin,requireCsrf,async(c)=>{const parsed=z.object({trainingId:z.string(),cohortId:z.string()}).safeParse(await c.req.json().catch(()=>null));if(!parsed.success)throw validationError(parsed);const rows=await c.env.DB.prepare(`SELECT id,name FROM participant_profiles WHERE training_id=? AND cohort_id=? AND is_active=1 ORDER BY name`).bind(parsed.data.trainingId,parsed.data.cohortId).all<{id:string;name:string}>();const files:Record<string,Uint8Array>={};for(const row of rows.results){try{const [front,back]=await Promise.all([renderCertificate(c,row.id,"FRONT"),renderCertificate(c,row.id,"BACK")]);const safeName=row.name.replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-|-$/g,"")||row.id;files[`${safeName}/Sertifikat-Depan.pdf`]=front.bytes;files[`${safeName}/Sertifikat-Belakang.pdf`]=back.bytes;for(const [side,result] of [["FRONT",front],["BACK",back]] as const){const key=`certificates/${row.id}/${side.toLowerCase()}.pdf`;await c.env.QUESTION_IMAGES.put(key,result.bytes,{httpMetadata:{contentType:"application/pdf"}});await c.env.DB.prepare(`UPDATE certificates SET ${side==="FRONT"?"pdf_key":"back_pdf_key"}=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(key,result.certificateId).run();}}catch(error){if(!(error instanceof HttpError&&(error.code==="NOT_ELIGIBLE"||error.code==="CERTIFICATE_NUMBER_REQUIRED")))throw error;}}if(!Object.keys(files).length)throw new HttpError(409,"CERTIFICATE_NUMBER_REQUIRED","Belum ada peserta lulus dengan nomor sertifikat resmi pada angkatan ini.");const archive=zipSync(files,{level:6});return new Response(archive,{headers:{"Content-Type":"application/zip","Content-Disposition":`attachment; filename="sertifikat-${parsed.data.cohortId}.zip"`}});});
participantAdminRoutes.get("/certificates/:certificateId/preview",async(c)=>{const side=c.req.query("side")==="BACK"?"BACK":"FRONT" as CertificateSide;const cert=await c.env.DB.prepare(`SELECT participant_profile_id,certificate_number FROM certificates WHERE id=?`).bind(c.req.param("certificateId")).first<{participant_profile_id:string;certificate_number:string}>();if(!cert)throw new HttpError(404,"PDF_NOT_FOUND","Sertifikat tidak ditemukan.");const result=await renderCertificate(c,cert.participant_profile_id,side,true);return new Response(result.bytes.slice().buffer,{headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename="preview-${cert.certificate_number}.pdf"`}});});
participantAdminRoutes.get("/certificates/preview-participant/:participantId",async(c)=>{const side=c.req.query("side")==="BACK"?"BACK":"FRONT" as CertificateSide;const result=await renderCertificate(c,c.req.param("participantId"),side,true);return new Response(result.bytes.slice().buffer,{headers:{"Content-Type":"application/pdf","Content-Disposition":"inline; filename=preview-sertifikat.pdf"}});});
participantAdminRoutes.get("/certificates/:certificateId/pdf",async(c)=>{const side=c.req.query("side")==="BACK"?"BACK":"FRONT";const row=await c.env.DB.prepare(`SELECT pdf_key,back_pdf_key,certificate_number FROM certificates WHERE id=?`).bind(c.req.param("certificateId")).first<{pdf_key:string|null;back_pdf_key:string|null;certificate_number:string}>();const key=side==="BACK"?row?.back_pdf_key:row?.pdf_key;if(!key)throw new HttpError(404,"PDF_NOT_FOUND","PDF sertifikat belum dibuat.");const obj=await c.env.QUESTION_IMAGES.get(key);if(!obj)throw new HttpError(404,"PDF_NOT_FOUND","PDF sertifikat tidak ditemukan.");return new Response(obj.body,{headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename="sertifikat-${side.toLowerCase()}-${row!.certificate_number.replace(/[^a-zA-Z0-9-]/g,"-")}.pdf"`}});});
participantAdminRoutes.get("/certificates/:certificateId/download",async(c)=>{const cert=await c.env.DB.prepare(`SELECT participant_profile_id,certificate_number FROM certificates WHERE id=?`).bind(c.req.param("certificateId")).first<{participant_profile_id:string;certificate_number:string}>();if(!cert)throw new HttpError(404,"PDF_NOT_FOUND","Sertifikat tidak ditemukan.");const [front,back]=await Promise.all([renderCertificate(c,cert.participant_profile_id,"FRONT"),renderCertificate(c,cert.participant_profile_id,"BACK")]);const combined=await PDFDocument.create();for(const source of [front.bytes,back.bytes]){const document=await PDFDocument.load(source);const [page]=await combined.copyPages(document,[0]);combined.addPage(page);}const safeNumber=cert.certificate_number.replace(/[^a-zA-Z0-9-]/g,"-");const bytes=await combined.save();return new Response(bytes.slice().buffer,{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="sertifikat-${safeNumber}.pdf"`}});});
