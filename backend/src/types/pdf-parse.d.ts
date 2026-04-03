declare module "pdf-parse" {
  function pdfParse(
    buffer: Buffer,
    options?: any
  ): Promise<{
    text: string;
    numpages: number;
    info: any;
    metadata: any;
    version: string;
  }>;

  export = pdfParse;
}
