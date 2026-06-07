import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { fmtNum, fmtPct, fmtSek, type CalcResult } from "@/lib/calc";
import type { SystemSpec } from "@/data/systems";
import type { SnowMeltResult, SnowMeltMode } from "@/lib/snowmelt";

const MODE_LABEL: Record<SnowMeltMode, string> = {
  none: "Ingen snösmältning",
  optimized: "Optimerad snösmältning",
  full: "Full snösmältning",
};

// Atmoce coral i sRGB ~ #ED6A4A
const CORAL: [number, number, number] = [237, 106, 74];
const PLUM: [number, number, number] = [48, 30, 50];
const MUTED: [number, number, number] = [110, 100, 110];

export interface PdfInput {
  atmoce: SystemSpec;
  reference: SystemSpec;
  atmoceResult: CalcResult;
  refResult: CalcResult;
  snow: SnowMeltResult;
  snowMode: SnowMeltMode;
  years: number;
  panels: number;
  wpPerPanel: number;
  chartElement: HTMLElement | null;
}

export async function generateSummaryPdf(input: PdfInput) {
  const {
    atmoce,
    reference,
    atmoceResult,
    refResult,
    snow,
    snowMode,
    years,
    panels,
    wpPerPanel,
    chartElement,
  } = input;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Header band
  doc.setFillColor(...PLUM);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ATMOCE", margin, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Investeringskalkyl — Solenergi", margin, 16);

  doc.setFontSize(9);
  const today = new Date().toLocaleDateString("sv-SE");
  const right = `${snow.location.name}  ·  ${today}`;
  const rightW = doc.getTextWidth(right);
  doc.text(right, pageW - margin - rightW, 16);

  // Coral accent line
  doc.setFillColor(...CORAL);
  doc.rect(0, 22, pageW, 1.2, "F");

  let cursorY = 28;

  // Subtitle: anläggning
  doc.setTextColor(...PLUM);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `${panels} paneler × ${wpPerPanel} W  =  ${fmtNum((panels * wpPerPanel) / 1000, 2)} kWp  ·  Kalkyltid ${years} år`,
    margin,
    cursorY,
  );
  cursorY += 5;

  // Key metrics table
  autoTable(doc, {
    startY: cursorY,
    head: [["Nyckeltal", atmoce.name, reference.name]],
    body: [
      ["Investering", fmtSek(atmoceResult.investment), fmtSek(refResult.investment)],
      [
        "Payback",
        atmoceResult.payback === null ? "> kalkyltid" : `${fmtNum(atmoceResult.payback, 1)} år`,
        refResult.payback === null ? "> kalkyltid" : `${fmtNum(refResult.payback, 1)} år`,
      ],
      [
        "IRR",
        atmoceResult.irr === null ? "—" : fmtPct(atmoceResult.irr),
        refResult.irr === null ? "—" : fmtPct(refResult.irr),
      ],
      [`NPV (${years} år)`, fmtSek(atmoceResult.npv), fmtSek(refResult.npv)],
      ["LCOE", `${fmtNum(atmoceResult.lcoe, 2)} kr/kWh`, `${fmtNum(refResult.lcoe, 2)} kr/kWh`],
      [
        "Växelriktarbyten",
        "0 byten (25 års garanti)",
        `${refResult.replacementYears.length} byten (${fmtSek(refResult.totalReplacementCost)})`,
      ],
      [
        "Total produktion",
        `${fmtNum(atmoceResult.totalProduction)} kWh`,
        `${fmtNum(refResult.totalProduction)} kWh`,
      ],
      [
        "Total besparing",
        fmtSek(atmoceResult.totalSavings),
        fmtSek(refResult.totalSavings),
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: PLUM,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9, textColor: PLUM },
    alternateRowStyles: { fillColor: [250, 245, 243] },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "right" },
      2: { halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  // @ts-expect-error - autoTable adds lastAutoTable to doc
  cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 4;

  // Snowmelt summary
  doc.setFillColor(250, 240, 235);
  doc.rect(margin, cursorY, pageW - 2 * margin, 14, "F");
  doc.setTextColor(...PLUM);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Snösmältning", margin + 2, cursorY + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `Ort: ${snow.location.name}  ·  Läge: ${MODE_LABEL[snowMode]}`,
    margin + 2,
    cursorY + 9.5,
  );
  doc.text(
    `Återvunnen produktion: ${fmtNum(snow.totalRecoveredKwh)} kWh/år  ·  Smältåtgång: ${fmtNum(snow.totalMeltKwh)} kWh (${fmtSek(snow.totalMeltCost)})  ·  Nettovinst: ${fmtSek(snow.totalNetBenefit)}/år`,
    margin + 2,
    cursorY + 13,
  );
  cursorY += 18;

  // NPV chart screenshot
  if (chartElement) {
    try {
      const canvas = await html2canvas(chartElement, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const availW = pageW - 2 * margin;
      const ratio = canvas.height / canvas.width;
      const imgH = Math.min(availW * ratio, 70);
      const imgW = imgH / ratio;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...PLUM);
      doc.text(`Ackumulerat nuvärde över ${years} år`, margin, cursorY);
      doc.addImage(
        imgData,
        "PNG",
        margin + (availW - imgW) / 2,
        cursorY + 2,
        imgW,
        imgH,
      );
      cursorY += imgH + 6;
    } catch (err) {
      console.warn("Chart capture failed", err);
    }
  }

  // Atmoce advantages
  const advY = Math.min(cursorY, pageH - 38);
  doc.setFillColor(...PLUM);
  doc.rect(margin, advY, pageW - 2 * margin, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Varför Atmoce?", margin + 3, advY + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const advantages = [
    "25 års produktgaranti på mikroväxelriktarna — inga växelriktarbyten under kalkyltiden.",
    "+8 % årsproduktion via panelnivå-MPPT som eliminerar skugg- och mismatch-förluster.",
    "Panelnivå-monitorering — fel upptäcks samma dag istället för efter månader.",
    "Valbar snösmältning vintertid håller panelerna snöfria när det lönar sig.",
  ];
  const colW = (pageW - 2 * margin - 6) / 2;
  advantages.forEach((line, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + 3 + col * (colW + 3);
    const y = advY + 11 + row * 7;
    doc.setFillColor(...CORAL);
    doc.circle(x + 1.2, y - 1.4, 0.9, "F");
    doc.setTextColor(255, 255, 255);
    const wrapped = doc.splitTextToSize(line, colW - 5);
    doc.text(wrapped, x + 4, y);
  });

  // Footer
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.text(
    "Beräkningarna är indikativa och baseras på prislista 2026 inkl. 15 % grönt teknikavdrag.",
    margin,
    pageH - 5,
  );
  const gen = "Genererad av Atmoce-kalkylatorn";
  doc.text(gen, pageW - margin - doc.getTextWidth(gen), pageH - 5);

  doc.save(`atmoce-kalkyl-${snow.location.name.toLowerCase()}-${today}.pdf`);
}