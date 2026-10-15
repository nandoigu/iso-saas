import { describe, it, expect } from "vitest";
import { contentDisposition } from "@/app/lib/contentDisposition";

describe("contentDisposition", () => {
  it("da un filename ASCII y el nombre real en filename*", () => {
    expect(contentDisposition("PLANTILLA-Acta Aprobación Información (1).docx")).toBe(
      "attachment; filename=\"PLANTILLA-Acta Aprobacion Informacion (1).docx\"; " +
        "filename*=UTF-8''PLANTILLA-Acta%20Aprobaci%C3%B3n%20Informaci%C3%B3n%20%281%29.docx"
    );
  });

  it("neutraliza comillas, barras y saltos de linea", () => {
    const valor = contentDisposition('a"b\\c\r\nd.docx');
    expect(valor.startsWith('attachment; filename="a_b_c__d.docx"; ')).toBe(true);
    expect(valor).not.toMatch(/[\r\n]/);
  });
});
