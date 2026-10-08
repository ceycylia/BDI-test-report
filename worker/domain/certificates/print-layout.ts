/** Physical print coordinates, measured in millimetres from the top-left edge
 * of the pre-printed A4 landscape sheet. Calibration offsets are added once to
 * every point at render time. */
export const MM_TO_PT = 72 / 25.4;
export const A4_LANDSCAPE = { width: 297, height: 210 } as const;

export const certificateLayout = {
  front: {
    number: { x: 148.5, y: 58 },
    declaration: { x: 35, y: 72 },
    label: { x: 47, y: 80, lineHeight: 7 },
    value: { x: 93, y: 80, lineHeight: 7 },
    narrative: { x: 35, y: 101, width: 220, lineHeight: 6 },
    photo: { x: 138, y: 142, width: 33, height: 40 },
    issue: { x: 212, y: 132 },
    signerTitle: { x: 212, y: 141 },
    signature: { x: 190.5, y: 143, width: 43, height: 16 },
    stamp: { x: 187, y: 145, width: 39, height: 30 },
    signerName: { x: 212, y: 163 },
    signerNip: { x: 212, y: 169 },
  },
  back: {
    heading: { x: 148.5, y: 37 },
    table: {
      x: 37, top: 47, bottom: 181, width: 230,
      number: { left: 37, right: 49 },
      material: { left: 49, right: 155 },
      unitCode: { left: 155, right: 212 },
      result: { left: 212, right: 267 },
      headerHeight: 12.5,
    },
  },
} as const;

export function mm(value: number) { return value * MM_TO_PT; }
