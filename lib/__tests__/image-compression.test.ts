import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock del compresor: devuelve un File "webp" de tamaño reducido.
vi.mock("browser-image-compression", () => ({
  default: vi.fn(
    async (file: File) => new File([new Uint8Array([1, 2, 3])], file.name, { type: "image/webp" })
  ),
}));

// Mock de pdf-lib: re-guardado devuelve un buffer pequeño (PDF "optimizado").
vi.mock("pdf-lib", () => ({
  PDFDocument: {
    load: vi.fn(async () => ({
      save: vi.fn(async () => new Uint8Array(8)),
    })),
  },
}));

import imageCompression from "browser-image-compression";
import { compressImage, compressImages, compressPdf, optimizeUpload } from "../image-compression";

describe("compressImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("convierte una imagen a WebP y renombra la extensión a .webp", async () => {
    const input = new File([new Uint8Array([0])], "Foto Vehículo.PNG", {
      type: "image/png",
    });
    const out = await compressImage(input);
    expect(out.type).toBe("image/webp");
    expect(out.name).toBe("Foto Vehículo.webp");
    expect(imageCompression).toHaveBeenCalledTimes(1);
  });

  it("deja pasar archivos que no son imagen (PDF) sin tocarlos", async () => {
    const pdf = new File([new Uint8Array([0])], "factura.pdf", {
      type: "application/pdf",
    });
    const out = await compressImage(pdf);
    expect(out).toBe(pdf);
    expect(out.name).toBe("factura.pdf");
    expect(imageCompression).not.toHaveBeenCalled();
  });

  it("no convierte SVG (vectorial)", async () => {
    const svg = new File([new Uint8Array([0])], "icono.svg", {
      type: "image/svg+xml",
    });
    const out = await compressImage(svg);
    expect(out).toBe(svg);
    expect(imageCompression).not.toHaveBeenCalled();
  });

  it("devuelve el archivo original si la compresión falla", async () => {
    (imageCompression as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("boom")
    );
    const input = new File([new Uint8Array([0])], "x.jpg", { type: "image/jpeg" });
    const out = await compressImage(input);
    expect(out).toBe(input);
  });

  it("compressImages procesa varios archivos (imagen→webp, pdf intacto)", async () => {
    const img = new File([new Uint8Array([0])], "a.jpeg", { type: "image/jpeg" });
    const pdf = new File([new Uint8Array([0])], "b.pdf", { type: "application/pdf" });
    const [outImg, outPdf] = await compressImages([img, pdf]);
    expect(outImg.type).toBe("image/webp");
    expect(outImg.name).toBe("a.webp");
    expect(outPdf).toBe(pdf);
  });
});

// jsdom no implementa File.arrayBuffer(); en el navegador sí existe.
function makePdf(name: string, bytes: number): File {
  const pdf = new File([new Uint8Array(bytes)], name, { type: "application/pdf" });
  Object.defineProperty(pdf, "arrayBuffer", {
    value: async () => new ArrayBuffer(bytes),
  });
  Object.defineProperty(pdf, "size", { value: bytes });
  return pdf;
}

describe("compressPdf", () => {
  it("reemplaza el PDF cuando el re-guardado es más pequeño", async () => {
    const pdf = makePdf("factura.pdf", 1000);
    const out = await compressPdf(pdf);
    expect(out.type).toBe("application/pdf");
    expect(out.name).toBe("factura.pdf");
    expect(out.size).toBeLessThan(1000);
  });

  it("deja pasar archivos que no son PDF", async () => {
    const img = new File([new Uint8Array(10)], "x.png", { type: "image/png" });
    const out = await compressPdf(img);
    expect(out).toBe(img);
  });
});

describe("optimizeUpload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("convierte imágenes a WebP", async () => {
    const img = new File([new Uint8Array([0])], "foto.png", { type: "image/png" });
    const out = await optimizeUpload(img);
    expect(out.type).toBe("image/webp");
  });

  it("optimiza PDFs (sin invocar el compresor de imágenes)", async () => {
    const pdf = makePdf("doc.pdf", 1000);
    const out = await optimizeUpload(pdf);
    expect(out.type).toBe("application/pdf");
    expect(out.size).toBeLessThan(1000);
    expect(imageCompression).not.toHaveBeenCalled();
  });

  it("deja intactos otros tipos de archivo", async () => {
    const csv = new File([new Uint8Array(10)], "data.csv", { type: "text/csv" });
    const out = await optimizeUpload(csv);
    expect(out).toBe(csv);
  });
});
