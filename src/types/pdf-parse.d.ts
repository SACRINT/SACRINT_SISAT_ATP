// pdf-parse 1.1.1 loads a test PDF file when you import from the main entry.
// Importing from the internal lib path avoids that issue in Next.js / Vercel.
declare module "pdf-parse/lib/pdf-parse.js" {
  import type { Options, Result } from "pdf-parse";
  function pdfParse(dataBuffer: Buffer, options?: Options): Promise<Result>;
  export default pdfParse;
}
