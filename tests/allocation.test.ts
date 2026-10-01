import { describe, expect, it } from "vitest";
import { allocateQuestionPackages } from "../worker/domain/allocation/generate-packages";
import { generateBatchLayouts } from "../worker/domain/allocation/generate-layouts";
import { personalizeQuestionOrder } from "../worker/domain/attempts/personalize-questions";

const fixedRandom = () => 0;

describe("alokasi paket soal", () => {
  it("memprioritaskan soal yang paling jarang dipakai", () => {
    const [result] = allocateQuestionPackages([
      { id: "jarang-1", timesAssigned: 0 }, { id: "jarang-2", timesAssigned: 0 },
      { id: "sering", timesAssigned: 9 },
    ], ["a"], 2, fixedRandom);
    expect(new Set(result?.questionIds)).toEqual(new Set(["jarang-1", "jarang-2"]));
  });

  it("membuat paket berbeda ketika jumlah soal mencukupi", () => {
    const result = allocateQuestionPackages(
      Array.from({ length: 6 }, (_, index) => ({ id: `q${index}`, timesAssigned: 0 })),
      ["a", "b"], 3, fixedRandom,
    );
    expect(new Set(result[0]?.questionIds)).not.toEqual(new Set(result[1]?.questionIds));
  });

  it("menggunakan ulang soal setelah kandidat yang paling jarang habis", () => {
    const result = allocateQuestionPackages(
      Array.from({ length: 4 }, (_, index) => ({ id: `q${index}`, timesAssigned: 0 })),
      ["a", "b"], 3, fixedRandom,
    );
    const shared = result[0]?.questionIds.filter((id) => result[1]?.questionIds.includes(id));
    expect(shared).toHaveLength(2);
  });
});

describe("layout tahap ujian", () => {
  const layouts = generateBatchLayouts(["q1", "q2", "q3"], fixedRandom);

  it("memakai ID soal yang sama untuk Pre-Test dan Post-Test", () => {
    expect(new Set(layouts[0]?.questionOrder)).toEqual(new Set(layouts[1]?.questionOrder));
  });

  it("mengubah urutan soal Post-Test", () => {
    expect(layouts[1]?.questionOrder).not.toEqual(layouts[0]?.questionOrder);
  });

  it("mempertahankan urutan pilihan A-D", () => {
    for (const layout of layouts) for (const order of Object.values(layout.optionOrders)) {
      expect(order).toEqual(["A", "B", "C", "D"]);
    }
  });
});

describe("urutan soal per peserta", () => {
  it("mengacak posisi soal dan mempertahankan pilihan A-D", () => {
    const questions = ["q1", "q2", "q3"].map((id, index) => ({
      id,
      position: index + 1,
      optionOrder: ["D", "C", "B", "A"] as Array<"A" | "B" | "C" | "D">,
    }));
    const personalized = personalizeQuestionOrder(questions, fixedRandom);
    expect(personalized.map((item) => item.id)).not.toEqual(questions.map((item) => item.id));
    expect(personalized.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(personalized.every((item) => item.optionOrder.join("") === "ABCD")).toBe(true);
  });
});
