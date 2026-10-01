/** Physical print coordinates, measured in millimetres from the top-left edge
 * of the pre-printed A4 landscape sheet. Calibration offsets are added once to
 * every point at render time. */
export const MM_TO_PT = 72 / 25.4;
export const A4_LANDSCAPE = { width: 297, height: 210 } as const;

export const certificateLayout = {
  front: {
    number: { x: 148.5, y: 66 },
    declaration: { x: 35, y: 80 },
    label: { x: 47, y: 88, lineHeight: 7 },
    value: { x: 93, y: 88, lineHeight: 7 },
    narrative: { x: 35, y: 109, width: 220, lineHeight: 6 },
    photo: { x: 136, y: 154, width: 33, height: 50 },
    issue: { x: 212, y: 138 },
    signerTitle: { x: 212, y: 147 },
    signature: { x: 190.5, y: 149, width: 43, height: 16 },
    stamp: { x: 187, y: 151, width: 39, height: 39 },
    signerName: { x: 212, y: 169 },
    signerNip: { x: 212, y: 175 },
  },
  back: {
    heading: { x: 148.5, y: 37 },
    table: {
      x: 37, top: 47, bottom: 181, width: 230,
      number: { left: 37, right: 49 },
      material: { left: 49, right: 173 },
      jp: { left: 173, right: 212 },
      result: { left: 212, right: 267 },
      headerHeight: 12.5,
    },
  },
} as const;

export function mm(value: number) { return value * MM_TO_PT; }
