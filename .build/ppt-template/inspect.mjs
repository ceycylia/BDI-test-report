import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "D:/Belajar/BDI/BDI-test-report";
const sourcePath = path.join(workspaceDir, "input/Sistem-Tes-Pelatihan-BDI-Medan.pptx");
const outDir = path.join(workspaceDir, ".build/ppt-template/inspection");
await fs.mkdir(outDir, { recursive: true });

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const snapshot = await presentation.inspect({
  kind: "deck,slide,textbox,shape,image,table,chart,notes,layout",
  include: "id,slide,name,title,text,textPreview,textChars,textLines,bbox,bboxUnit,rows,cols,preview,chartType,alt,prompt,isPlaceholder,placeholders",
  maxChars: 120000,
});
await fs.writeFile(path.join(outDir, "snapshot.ndjson"), snapshot.ndjson);

const montage = await presentation.export({ format: "png", montage: true, scale: 1 });
await fs.writeFile(path.join(outDir, "montage.png"), new Uint8Array(await montage.arrayBuffer()));

for (let i = 0; i < presentation.slides.items.length; i += 1) {
  const slide = presentation.slides.getItem(i);
  const preview = await slide.export({ format: "png", scale: 1.5 });
  await fs.writeFile(path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`), new Uint8Array(await preview.arrayBuffer()));
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.layout.json`), await layout.text());
}

const metadata = {
  slideCount: presentation.slides.items.length,
  slideSize: presentation.slideSize,
  masters: presentation.masters.items.map((m) => ({ id: m.id, name: m.name })),
  layouts: presentation.layouts.items.map((l) => ({ id: l.id, name: l.name, placeholders: l.placeholders.summary() })),
};
await fs.writeFile(path.join(outDir, "metadata.json"), JSON.stringify(metadata, null, 2));
console.log(JSON.stringify(metadata, null, 2));
