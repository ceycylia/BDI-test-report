export function totalTrainingJp(materials: Array<{ jp: number }>): number {
  return materials.reduce((total, material) => total + material.jp, 0);
}

export function isCertificateEligible(finalScore: number | null, passingScore: number): boolean {
  return finalScore !== null && finalScore >= passingScore;
}
