import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "D:/Belajar/BDI/BDI-test-report";
const finalPath = path.join(workspaceDir, "output/Template-Canva-Alur-Sistem-BDI-Medan-v2.pptx");
const outDir = path.join(workspaceDir, ".build/ppt-template/final-review-v2");
await fs.mkdir(outDir, { recursive: true });
const presentation = await PresentationFile.importPptx(await FileBlob.load(finalPath));
const snapshot = await presentation.inspect({
  kind: "deck,slide,textbox,shape,image,table,notes,layout",
  maxChars: 120000,
});
await fs.writeFile(path.join(outDir, "snapshot.ndjson"), snapshot.ndjson);
const montage = await presentation.export({ format: "png", montage: true, scale: 1 });
await fs.writeFile(path.join(outDir, "montage.png"), new Uint8Array(await montage.arrayBuffer()));
for (let i = 0; i < presentation.slides.items.length; i += 1) {
  const slide = presentation.slides.getItem(i);
  const png = await slide.export({ format: "png", scale: 1.5 });
  await fs.writeFile(path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`), new Uint8Array(await png.arrayBuffer()));
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.layout.json`), await layout.text());
}
console.log(`Rendered ${presentation.slides.items.length} slides.`);
