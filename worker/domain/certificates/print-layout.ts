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
    // Standard pasfoto Indonesia: 3 × 4 cm. The renderer crops to this frame.
    photo: { x: 139.5, y: 142, width: 30, height: 40 },
    issue: { x: 212, y: 132 },
    signerTitle: { x: 212, y: 138 },
    signature: { x: 190.5, y: 142, width: 43, height: 17 },
    stamp: { x: 187, y: 145, width: 39, height: 30 },
    signerName: { x: 212, y: 164 },
    signerNip: { x: 212, y: 170 },
  },
  back: {
    heading: { x: 148.5, y: 37 },
    table: {
      x: 37, top: 47, bottom: 181, width: 230,
      number: { left: 37, right: 49 },
      // Material and unit-code bounds are refined from the actual code widths
      // when the certificate is rendered. These values keep the print grid
      // sensible for an empty list as well.
      material: { left: 49, right: 218 },
      unitCode: { left: 218, right: 245 },
      result: { left: 245, right: 267 },
      headerHeight: 12.5,
    },
  },
} as const;

export function mm(value: number) { return value * MM_TO_PT; }
