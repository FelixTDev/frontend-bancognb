import { describe, expect, it } from "vitest";
import {
  isExcludedFaq,
  getSafeFaqContent,
  isExcludedFaqQuestion,
} from "./faq-content";

const safeAnswer =
  "No tengo información verificada para responder esta consulta financiera.";

describe("safe FAQ content", () => {
  it("excludes the mobile banking affiliation question with normalized punctuation", () => {
    expect(isExcludedFaqQuestion("Como me afilio a banca movil")).toBe(true);
    expect(isExcludedFaqQuestion("¿CÓMO me afilio a Banca Móvil? ")).toBe(true);
    expect(isExcludedFaqQuestion("¿Cómo consulto el saldo de mi cuenta?")).toBe(
      false,
    );
    expect(isExcludedFaqQuestion("Banca digital")).toBe(false);
    expect(
      isExcludedFaq({
        title: "¿Cómo me afilio a Banca Móvil?",
        question: "¿Cómo uso el acceso móvil?",
      }),
    ).toBe(true);
  });

  it("generalizes a legacy question that names an institution", () => {
    expect(
      getSafeFaqContent({
        question: "¿Qué tipos de cuentas ofrece Banco GNB?",
        answer: "Banco GNB ofrece productos con condiciones específicas.",
      }),
    ).toEqual({
      question: "¿Qué tipos de cuentas ofrece una entidad financiera?",
      answer: safeAnswer,
      isGenericFallback: true,
    });
  });

  it("removes legacy details when a curated FAQ still has its old source metadata", () => {
    expect(
      getSafeFaqContent({
        question: "¿Cómo consulto el saldo de mi cuenta?",
        answer: "Consulta el saldo en los canales digitales de Banco GNB.",
        source_url: "https://www.bancognb.com.pe/cuentas",
        source_verified_at: "2026-11-01T00:00:00Z",
      }),
    ).toEqual({
      question: "¿Cómo consulto el saldo de mi cuenta?",
      answer: safeAnswer,
      isGenericFallback: true,
    });
  });

  it("normalizes the legacy card requirements alias without dropping the FAQ", () => {
    expect(
      getSafeFaqContent({
        question: "¿Qué requisitos necesito para una tarjeta?",
        answer: "Respuesta anterior con requisitos específicos.",
      }),
    ).toEqual({
      question: "¿Qué requisitos necesito para solicitar una tarjeta?",
      answer: safeAnswer,
      isGenericFallback: true,
    });
  });

  it("keeps clean, general API content unchanged", () => {
    expect(
      getSafeFaqContent({
        question: "¿Cómo puedo contactar a un asesor?",
        answer: "No tengo información verificada para responder esta consulta financiera.",
        source_url: null,
        source_verified_at: null,
      }),
    ).toEqual({
      question: "¿Cómo puedo contactar a un asesor?",
      answer: safeAnswer,
      isGenericFallback: false,
    });
  });
});
