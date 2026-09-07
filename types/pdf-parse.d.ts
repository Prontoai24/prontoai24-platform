declare module 'pdf-parse' {
  type PdfResult = { text: string; numpages: number }
  function pdfParse(data: Buffer): Promise<PdfResult>
  export = pdfParse
}
