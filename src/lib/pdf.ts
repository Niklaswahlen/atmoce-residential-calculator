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

  const today = new Date().toLocaleDateString("sv-SE");

  const drawHeader = () => {
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
    const right = `${snow.location.name}  ·  ${today}`;
    doc.text(right, pageW - margin - doc.getTextWidth(right), 16);
    doc.setFillColor(...CORAL);
    doc.rect(0, 22, pageW, 1.2, "F");
  };

  const drawFooter = () => {
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.text(
      "Beräkningarna är indikativa och baseras på prislista 2026 inkl. 15 % grönt teknikavdrag.",
      margin,
      pageH - 5,
    );
    const gen = "Genererad av Atmoce-kalkylatorn";
    doc.text(gen, pageW - margin - doc.getTextWidth(gen), pageH - 5);
  };

  drawHeader();
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
      const imgH = Math.min(availW * ratio, 95);
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

  drawFooter();

  // ===== Page 2: Där Atmoce vinner + USP-kort =====
  doc.addPage();
  drawHeader();
  cursorY = 28;

  doc.setTextColor(...PLUM);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Där ${atmoce.name} vinner över ${reference.name}`, margin, cursorY);
  cursorY += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    "Direkt jämförelse av nyckeltal. Grön markering visar vilket system som vinner respektive rad.",
    margin,
    cursorY + 3,
  );
  cursorY += 7;

  type Cmp = {
    label: string;
    a: string;
    b: string;
    winner: "a" | "b" | "tie";
    delta?: string;
  };

  const cmpHigher = (a: number, b: number): "a" | "b" | "tie" =>
    a > b ? "a" : a < b ? "b" : "tie";
  const cmpLower = (a: number, b: number): "a" | "b" | "tie" =>
    a < b ? "a" : a > b ? "b" : "tie";

  const paybackA = atmoceResult.payback;
  const paybackB = refResult.payback;
  const paybackWinner: "a" | "b" | "tie" =
    paybackA === null && paybackB === null
      ? "tie"
      : paybackA === null
        ? "b"
        : paybackB === null
          ? "a"
          : cmpLower(paybackA, paybackB);

  const rows: Cmp[] = [
    {
      label: "Investering",
      a: fmtSek(atmoceResult.investment),
      b: fmtSek(refResult.investment),
      winner: cmpLower(atmoceResult.investment, refResult.investment),
      delta: `Δ ${fmtSek(Math.abs(atmoceResult.investment - refResult.investment))}`,
    },
    {
      label: "Payback",
      a: paybackA === null ? "> kalkyltid" : `${fmtNum(paybackA, 1)} år`,
      b: paybackB === null ? "> kalkyltid" : `${fmtNum(paybackB, 1)} år`,
      winner: paybackWinner,
      delta:
        paybackA !== null && paybackB !== null
          ? `Δ ${fmtNum(Math.abs(paybackB - paybackA), 1)} år`
          : undefined,
    },
    {
      label: "IRR",
      a: atmoceResult.irr === null ? "—" : fmtPct(atmoceResult.irr),
      b: refResult.irr === null ? "—" : fmtPct(refResult.irr),
      winner:
        atmoceResult.irr === null || refResult.irr === null
          ? "tie"
          : cmpHigher(atmoceResult.irr, refResult.irr),
    },
    {
      label: `NPV (${years} år)`,
      a: fmtSek(atmoceResult.npv),
      b: fmtSek(refResult.npv),
      winner: cmpHigher(atmoceResult.npv, refResult.npv),
      delta: `Δ ${fmtSek(Math.abs(atmoceResult.npv - refResult.npv))}`,
    },
    {
      label: "LCOE",
      a: `${fmtNum(atmoceResult.lcoe, 2)} kr/kWh`,
      b: `${fmtNum(refResult.lcoe, 2)} kr/kWh`,
      winner: cmpLower(atmoceResult.lcoe, refResult.lcoe),
    },
    {
      label: "Total produktion",
      a: `${fmtNum(atmoceResult.totalProduction)} kWh`,
      b: `${fmtNum(refResult.totalProduction)} kWh`,
      winner: cmpHigher(atmoceResult.totalProduction, refResult.totalProduction),
      delta: `Δ ${fmtNum(Math.abs(atmoceResult.totalProduction - refResult.totalProduction))} kWh`,
    },
    {
      label: "Total besparing",
      a: fmtSek(atmoceResult.totalSavings),
      b: fmtSek(refResult.totalSavings),
      winner: cmpHigher(atmoceResult.totalSavings, refResult.totalSavings),
      delta: `Δ ${fmtSek(Math.abs(atmoceResult.totalSavings - refResult.totalSavings))}`,
    },
    {
      label: "Växelriktarbyten",
      a: "0 byten",
      b: `${refResult.replacementYears.length} byten (${fmtSek(refResult.totalReplacementCost)})`,
      winner: refResult.replacementYears.length === 0 ? "tie" : "a",
    },
    {
      label: "Garanti växelriktare",
      a: `${atmoce.inverterWarrantyYears} år`,
      b: `${reference.inverterWarrantyYears} år`,
      winner: cmpHigher(atmoce.inverterWarrantyYears, reference.inverterWarrantyYears),
    },
    {
      label: "Round-trip-effektivitet",
      a: fmtPct(atmoce.batteryRoundTrip, 0),
      b: fmtPct(reference.batteryRoundTrip, 0),
      winner: cmpHigher(atmoce.batteryRoundTrip, reference.batteryRoundTrip),
    },
    {
      label: "Panelnivå-övervakning",
      a: atmoce.panelLevelMonitoring ? "Ja" : "Nej",
      b: reference.panelLevelMonitoring ? "Ja" : "Nej",
      winner:
        atmoce.panelLevelMonitoring === reference.panelLevelMonitoring
          ? "tie"
          : atmoce.panelLevelMonitoring
            ? "a"
            : "b",
    },
  ];

  const atmoceWins = rows.filter((r) => r.winner === "a").length;
  const refWins = rows.filter((r) => r.winner === "b").length;
  const ties = rows.filter((r) => r.winner === "tie").length;

  autoTable(doc, {
    startY: cursorY,
    head: [["Nyckeltal", atmoce.name, reference.name, "Skillnad"]],
    body: rows.map((r) => [r.label, r.a, r.b, r.delta ?? ""]),
    theme: "grid",
    headStyles: {
      fillColor: PLUM,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9, textColor: PLUM },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right", textColor: MUTED, fontSize: 8 },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const row = rows[data.row.index];
      if (data.column.index === 1 && row.winner === "a") {
        data.cell.styles.fillColor = [220, 240, 220];
        data.cell.styles.fontStyle = "bold";
      }
      if (data.column.index === 2 && row.winner === "b") {
        data.cell.styles.fillColor = [220, 240, 220];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  // @ts-expect-error - autoTable adds lastAutoTable
  cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 5;

  // Sammanställning
  doc.setFillColor(245, 248, 245);
  doc.rect(margin, cursorY, pageW - 2 * margin, 11, "F");
  doc.setTextColor(...PLUM);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Sammanställning", margin + 2, cursorY + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `${atmoce.name} vinner ${atmoceWins} av ${rows.length} kategorier  ·  ${reference.name}: ${refWins}  ·  Oavgjort: ${ties}`,
    margin + 2,
    cursorY + 9,
  );
  cursorY += 15;

  // USP-kort
  const uspY = cursorY;
  const uspH = 60;
  doc.setFillColor(...PLUM);
  doc.rect(margin, uspY, pageW - 2 * margin, uspH, "F");
  doc.setFillColor(...CORAL);
  doc.rect(margin, uspY, 3, uspH, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Varför Atmoce?", margin + 6, uspY + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(230, 220, 230);
  doc.text(
    "Sex skäl att välja mikroväxelriktarsystemet med 25 års produktgaranti.",
    margin + 6,
    uspY + 12,
  );

  const usps: { title: string; body: string }[] = [
    {
      title: "25 års produktgaranti",
      body: "På varje mikroväxelriktare — noll växelriktarbyten under kalkyltiden.",
    },
    {
      title: "+8 % årsproduktion",
      body: "Panelnivå-MPPT eliminerar skugg- och mismatch-förluster.",
    },
    {
      title: "Panelnivå-övervakning",
      body: "Fel upptäcks samma dag istället för efter månader av tappad intäkt.",
    },
    {
      title: "Säkrare på taket",
      body: "Lågspänd AC per panel — ingen högspänd DC i taksystemet.",
    },
    {
      title: "Snösmältning",
      body: "Valbart vintertid — håller panelerna snöfria när det lönar sig.",
    },
    {
      title: "Skalbart & enkelt",
      body: "Lägg till paneler senare utan att byta ut central inverter.",
    },
  ];

  const innerW = pageW - 2 * margin - 12;
  const colW = innerW / 3;
  const rowH = 18;
  usps.forEach((u, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = margin + 6 + col * colW;
    const y = uspY + 20 + row * rowH;
    doc.setFillColor(...CORAL);
    doc.circle(x + 1.3, y + 0.8, 1.1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(u.title, x + 4.5, y + 1.8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(220, 215, 220);
    const wrapped = doc.splitTextToSize(u.body, colW - 7);
    doc.text(wrapped, x + 4.5, y + 6.5);
  });

  drawFooter();

  doc.save(`atmoce-kalkyl-${snow.location.name.toLowerCase()}-${today}.pdf`);
}