import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { paginationItems } from "../src/features/pagination/pagination";
import { paginationMeta, parsePagination } from "../worker/http/pagination";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("pagination admin", () => {
  it("membatasi daftar ke 20 data secara default", () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it("tidak mengizinkan limit lebih dari 20", () => {
    expect(parsePagination({ limit: "500" }).limit).toBe(20);
  });

  it("menghitung offset halaman kedua", () => {
    expect(parsePagination({ page: "2", limit: "20" }).offset).toBe(20);
  });

  it("mengembalikan total item dan total halaman", () => {
    expect(paginationMeta({ page: 2, limit: 20 }, 45)).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3 });
  });

  it("menjaga minimal satu halaman untuk empty state", () => {
    expect(paginationMeta({ page: 1, limit: 20 }, 0).totalPages).toBe(1);
  });

  it("menampilkan nomor halaman ringkas", () => {
    expect(paginationItems(1, 3)).toEqual([1, 2, 3]);
    expect(paginationItems(5, 12)).toEqual([1, "ellipsis-4", 4, 5, 6, "ellipsis-12", 12]);
  });

  it("menerapkan search dan filter bank soal sebelum LIMIT", () => {
    const source = read("worker/repositories/question-bank-repository.ts");
    expect(source).toContain("materials.training_id = ?");
    expect(source).toContain("materials.name LIKE ?");
    expect(source).toContain("LIMIT ? OFFSET ?");
  });

  it("menerapkan filter pelatihan dan materi sebelum pagination", () => {
    const source = read("worker/routes/admin/participant-admin-routes.ts");
    expect(source).toContain('participantAdminRoutes.get("/catalog/trainings"');
    expect(source).toContain('participantAdminRoutes.get("/catalog/materials"');
  });

  it("mereset halaman ketika filter halaman berubah", () => {
    for (const path of ["src/pages/admin/QuestionBankListPage.tsx", "src/pages/admin/TrainingListPage.tsx", "src/pages/admin/EvaluationPage.tsx"]) {
      expect(read(path)).toMatch(/setPage\(1\)/u);
    }
  });

  it("mempertahankan urutan deterministic newest-first", () => {
    expect(read("worker/repositories/question-bank-repository.ts")).toContain("ORDER BY banks.created_at DESC, banks.rowid DESC");
    expect(read("worker/repositories/training-repository.ts")).toContain("ORDER BY sessions.created_at DESC, sessions.rowid DESC");
  });

  it("export hasil tidak membawa page dan limit", () => {
    const source = read("src/pages/admin/ResultsPage.tsx");
    const exportBlock = source.slice(source.indexOf("const exportUrl"), source.indexOf("return <>"));
    expect(exportBlock).not.toContain('params.set("page"');
    expect(exportBlock).not.toContain('params.set("limit"');
    expect(exportBlock).toContain('params.set("year"');
  });

  it("daftar soal tersimpan dipaginasi setelah import", () => {
    const source = read("src/pages/admin/QuestionBankDetailPage.tsx");
    expect(source).toContain("<Pagination pagination={pagination}");
    expect(source).toContain("await loadDetail(1)");
  });

  it("preview import tetap berupa preview sementara tanpa pagination server", () => {
    const source = read("src/pages/admin/QuestionImportPage.tsx");
    expect(source).toContain("preview");
    expect(source).not.toContain("<Pagination");
  });

  it("kembali ke halaman valid setelah item terakhir halaman dihapus", () => {
    for (const path of ["src/pages/admin/QuestionBankDetailPage.tsx", "src/pages/admin/SurveyTemplateListPage.tsx", "src/pages/admin/TrainingCatalogPage.tsx"]) {
      expect(read(path)).toContain("pagination.totalPages");
    }
  });

  it("pagination lama Hasil memakai komponen reusable yang sama", () => {
    const source = read("src/pages/admin/ResultsPage.tsx");
    expect(source).toContain('from "../../components/ui/Pagination"');
    expect(source).toContain("<Pagination pagination={pagination}");
  });
});
