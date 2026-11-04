declare module "*.sql?raw" {
  const source: string;
  export default source;
}

declare module "*.ts?raw" {
  const source: string;
  export default source;
}
