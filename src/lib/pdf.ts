import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtNum, fmtPct, fmtSek, type CalcResult } from "@/lib/calc";

/** fmtSek men med minus (U+2212) ersatt — helvetica saknar det tecknet i PDF:en. */
const sek = (n: number): string => fmtSek(n).replace(/\u2212/g, "-");
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
const MUTED: [number, number, number] = [120, 112, 122];
const FAINT: [number, number, number] = [168, 160, 172];
const INK: [number, number, number] = [40, 36, 44];
const GRID: [number, number, number] = [228, 224, 230];
const TINT: [number, number, number] = [246, 243, 246];
const GREEN_FILL: [number, number, number] = [230, 247, 237];
const GREEN_TEXT: [number, number, number] = [22, 120, 72];

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
  /** Atmoce batterigaranti för vald modell (år/cykler) — dynamiskt från kalkylatorn. */
  atmoceBatteryWarrantyYears?: number | null;
  atmoceBatteryWarrantyCycles?: number | null;
  chartElement?: HTMLElement | null;
  /** Garanterad genomströmning totalt (MWh) — bara när data finns för båda systemen. */
  throughputAtmoceMwh?: number | null;
  throughputRefMwh?: number | null;
  /** Batterisidans pris (ESS, efter GTA) — används för kr/MWh. */
  throughputEssPriceA?: number | null;
  throughputEssPriceB?: number | null;
}

function formatK(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) {
    const k = Math.round(v / 1000);
    return `${k}k`;
  }
  return `${Math.round(v)}`;
}

function drawNpvChart(
  doc: jsPDF,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    years: number;
    atmoceSeries: number[]; // length years+1, index 0 = year 0
    refSeries: number[];
    atmoceLabel: string;
    refLabel: string;
    title: string;
    takeaway: string;
  },
) {
  const { x, y, w, h, years, atmoceSeries, refSeries, atmoceLabel, refLabel, title, takeaway } =
    opts;

  // Outer card — vit med svart kant, rundade hörn
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PLUM);
  doc.text(title, x + 5, y + 7.5);

  // Legend (top right)
  const legendY = y + 7.5;
  let legendX = x + w - 5;
  const legendItems: { label: string; color: [number, number, number] }[] = [
    { label: refLabel, color: INK },
    { label: atmoceLabel, color: CORAL },
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  legendItems.forEach((it) => {
    const tw = doc.getTextWidth(it.label);
    doc.setTextColor(...INK);
    doc.text(it.label, legendX - tw, legendY);
    doc.setFillColor(...it.color);
    doc.rect(legendX - tw - 4.5, legendY - 2.2, 3.5, 1.8, "F");
    legendX -= tw + 11;
  });

  // Plot area
  const padL = 16;
  const padR = 6;
  const padT = 13;
  const padB = 11;
  const plotX = x + padL;
  const plotY = y + padT;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  // Y range
  const allVals = [...atmoceSeries, ...refSeries];
  let yMin = Math.min(...allVals, 0);
  let yMax = Math.max(...allVals, 0);
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  // Pad 5%
  const range = yMax - yMin;
  yMin -= range * 0.05;
  yMax += range * 0.05;

  const toPx = (yr: number, val: number) => ({
    px: plotX + (yr / years) * plotW,
    py: plotY + plotH - ((val - yMin) / (yMax - yMin)) * plotH,
  });

  // Y ticks — hjälplinjer, svart text
  const yTicks = 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...INK);
  doc.setDrawColor(...GRID);
  doc.setLineWidth(0.12);
  for (let i = 0; i <= yTicks; i++) {
    const val = yMin + ((yMax - yMin) * i) / yTicks;
    const py = plotY + plotH - (i / yTicks) * plotH;
    doc.line(plotX, py, plotX + plotW, py);
    const label = formatK(val);
    doc.text(label, plotX - 1.8, py + 1, { align: "right" });
  }

  // Zero line (if within range)
  if (yMin < 0 && yMax > 0) {
    const zeroY = plotY + plotH - ((0 - yMin) / (yMax - yMin)) * plotH;
    doc.setDrawColor(180, 172, 182);
    doc.setLineWidth(0.25);
    doc.setLineDashPattern([0.8, 0.8], 0);
    doc.line(plotX, zeroY, plotX + plotW, zeroY);
    doc.setLineDashPattern([], 0);
  }

  // X ticks — svart text
  doc.setDrawColor(...GRID);
  doc.setLineWidth(0.12);
  doc.setTextColor(...INK);
  const step = years >= 20 ? 5 : years >= 10 ? 2 : 1;
  for (let yr = 0; yr <= years; yr += step) {
    const { px } = toPx(yr, yMin);
    const py = plotY + plotH;
    doc.line(px, py, px, py + 1);
    doc.text(String(yr), px, py + 3.6, { align: "center" });
  }

  // Axellinjer — svarta
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.3);
  doc.line(plotX, plotY, plotX, plotY + plotH);
  doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);

  // Draw a series
  const drawSeries = (
    series: number[],
    color: [number, number, number],
    width: number,
    withDots: boolean,
  ) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    let prev: { px: number; py: number } | null = null;
    series.forEach((val, yr) => {
      const p = toPx(yr, val);
      if (prev) doc.line(prev.px, prev.py, p.px, p.py);
      prev = p;
    });
    if (withDots) {
      doc.setFillColor(...color);
      const dotStep = years >= 20 ? 5 : years >= 10 ? 2 : 1;
      for (let yr = 0; yr <= years; yr += dotStep) {
        const p = toPx(yr, series[yr]);
        doc.circle(p.px, p.py, 0.4, "F");
      }
    }
  };

  drawSeries(refSeries, INK, 0.7, false);
  drawSeries(atmoceSeries, CORAL, 0.9, true);

  // Takeaway-raden längst ner i kortet
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(takeaway, x + 5, y + h - 3);
}

function drawStatBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  sub: string | undefined,
  valueSize = 11.5,
) {
  doc.setFillColor(...TINT);
  doc.roundedRect(x, y, w, h, 1.4, 1.4, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), x + 4, y + 5, { charSpace: 0.3 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(valueSize);
  doc.setTextColor(...PLUM);
  doc.text(value, x + 4, y + 11);
  if (sub) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...MUTED);
    doc.text(sub, x + 4, y + h - 2.2);
  }
}

function drawFooter(doc: jsPDF, pageW: number, pageH: number, margin: number) {
  doc.setDrawColor(...GRID);
  doc.setLineWidth(0.2);
  doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...FAINT);
  doc.text(
    "Beräkningarna är indikativa och baseras på prislista 2026 inkl. 15 % grönt teknikavdrag.",
    margin,
    pageH - 5.5,
  );
  const gen = "Genererad av Atmoce-kalkylatorn";
  doc.text(gen, pageW - margin - doc.getTextWidth(gen), pageH - 5.5);
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
  } = input;

  const atmoceBattWarrantyYears =
    input.atmoceBatteryWarrantyYears ?? atmoce.batteryWarrantyYears ?? null;
  const atmoceBattWarrantyCycles =
    input.atmoceBatteryWarrantyCycles ?? atmoce.batteryWarrantyCycles ?? null;
  const refBattWarrantyYears = reference.batteryWarrantyYears ?? null;
  const refBattWarrantyCycles = reference.batteryWarrantyCycles ?? null;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  const today = new Date().toLocaleDateString("sv-SE");

  // ================= SIDA 1 =================

  // ---- Sidhuvud: ljus, ATMOCE-ordmärke, tunn coral-linje ----
  doc.setTextColor(...PLUM);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("ATMOCE", margin, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("INVESTERINGSKALKYL — SOLENERGI", margin, 23, { charSpace: 0.5 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const right = `${snow.location.name}  ·  ${today}`;
  doc.text(right, pageW - margin, 15, { align: "right" });

  doc.setDrawColor(...CORAL);
  doc.setLineWidth(0.8);
  doc.line(margin, 27, pageW - margin, 27);

  let cursorY = 34;

  // ---- Tre nyckelvärdes-boxar ----
  {
    const gap = 5;
    const boxW = (pageW - 2 * margin - 2 * gap) / 3;
    const boxH = 16.5;
    const kWp = fmtNum((panels * wpPerPanel) / 1000, 2);
    drawStatBox(doc, margin, cursorY, boxW, boxH, "Installerad effekt", `${kWp} kWp`, `${panels} paneler × ${wpPerPanel} W`);
    drawStatBox(doc, margin + boxW + gap, cursorY, boxW, boxH, "Kalkyltid", `${years} år`, undefined);
    drawStatBox(
      doc,
      margin + 2 * (boxW + gap),
      cursorY,
      boxW,
      boxH,
      "Jämförelse",
      `${atmoce.name} vs ${reference.name}`,
      undefined,
      9,
    );
    cursorY += boxH + 12;
  }

  // ---- Jämförelsetabell: tunna hjälplinjer, ingen yttre grid ----
  type Cmp = {
    label: string;
    a: string;
    b: string;
    winner: "a" | "b" | "tie";
    delta?: string;
    key?: boolean;
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

  const fmtWarranty = (yrs: number | null, cycles: number | null): string => {
    if (yrs === null && cycles === null) return "—";
    const yrsPart = yrs !== null ? `${yrs} år` : "";
    const cycPart = cycles !== null ? `${fmtNum(cycles)} cykler` : "";
    return [yrsPart, cycPart].filter(Boolean).join(" / ");
  };

  const pricePerKwhA = atmoce.batteryKwh > 0 ? atmoce.essPrice / atmoce.batteryKwh : 0;
  const pricePerKwhB = reference.batteryKwh > 0 ? reference.essPrice / reference.batteryKwh : 0;

  const rows: Cmp[] = [
    {
      label: "Investering",
      a: sek(atmoceResult.investment),
      b: sek(refResult.investment),
      winner: cmpLower(atmoceResult.investment, refResult.investment),
      delta: sek(Math.abs(atmoceResult.investment - refResult.investment)),
    },
    {
      label: "Payback",
      a: paybackA === null ? "> kalkyltid" : `${fmtNum(paybackA, 1)} år`,
      b: paybackB === null ? "> kalkyltid" : `${fmtNum(paybackB, 1)} år`,
      winner: paybackWinner,
      delta:
        paybackA !== null && paybackB !== null
          ? `${fmtNum(Math.abs(paybackB - paybackA), 1)} år`
          : undefined,
      key: true,
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
      a: sek(atmoceResult.npv),
      b: sek(refResult.npv),
      winner: cmpHigher(atmoceResult.npv, refResult.npv),
      delta: sek(Math.abs(atmoceResult.npv - refResult.npv)),
      key: true,
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
      delta: `${fmtNum(Math.abs(atmoceResult.totalProduction - refResult.totalProduction))} kWh`,
    },
    {
      label: "Total besparing",
      a: sek(atmoceResult.totalSavings),
      b: sek(refResult.totalSavings),
      winner: cmpHigher(atmoceResult.totalSavings, refResult.totalSavings),
      delta: sek(Math.abs(atmoceResult.totalSavings - refResult.totalSavings)),
    },
    {
      label: "Batteristorlek",
      a: `${fmtNum(atmoce.batteryKwh, 1)} kWh`,
      b: `${fmtNum(reference.batteryKwh, 1)} kWh`,
      winner: cmpHigher(atmoce.batteryKwh, reference.batteryKwh),
      delta: `${fmtNum(Math.abs(atmoce.batteryKwh - reference.batteryKwh), 1)} kWh`,
    },
    {
      label: "Batterigaranti",
      a: fmtWarranty(atmoceBattWarrantyYears, atmoceBattWarrantyCycles),
      b: fmtWarranty(refBattWarrantyYears, refBattWarrantyCycles),
      winner: cmpHigher(atmoceBattWarrantyYears ?? 0, refBattWarrantyYears ?? 0),
    },
    ...(input.throughputAtmoceMwh != null && input.throughputRefMwh != null
      ? [
          {
            label: "Garanterad genomströmning",
            a: `${fmtNum(input.throughputAtmoceMwh, 1)} MWh`,
            b: `${fmtNum(input.throughputRefMwh, 1)} MWh`,
            winner: cmpHigher(input.throughputAtmoceMwh, input.throughputRefMwh),
          } as Cmp,
        ]
      : []),
    {
      label: "Pris per kWh batteri",
      a: `${fmtNum(pricePerKwhA)} kr/kWh`,
      b: `${fmtNum(pricePerKwhB)} kr/kWh`,
      winner: cmpLower(pricePerKwhA, pricePerKwhB),
      delta: `${fmtNum(Math.abs(pricePerKwhA - pricePerKwhB))} kr/kWh`,
    },
    {
      label: "Växelriktarbyten",
      a: "0 byten",
      b: `${refResult.replacementYears.length} byten (${sek(refResult.totalReplacementCost)})`,
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
    head: [["Nyckeltal", atmoce.name, reference.name]],
    body: rows.map((r) => [r.label, r.a, r.b]),
    theme: "plain",
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [150, 142, 152],
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: { top: 2, bottom: 2, left: 0.5, right: 1.5 },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: PLUM,
      cellPadding: { top: 3.6, bottom: 3.6, left: 0.5, right: 1.5 },
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
      1: { halign: "right" },
      2: { halign: "right" },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index === 1) {
        data.cell.styles.textColor = CORAL;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 8;
      }
      if (data.section !== "body") return;
      const row = rows[data.row.index];
      if (row.key) {
        data.cell.styles.fontStyle = "bold";
      }
      if (data.column.index === 1 && row.winner === "a") {
        data.cell.styles.fillColor = GREEN_FILL;
        data.cell.styles.textColor = GREEN_TEXT;
        data.cell.styles.fontStyle = "bold";
      }
      if (data.column.index === 2 && row.winner === "b") {
        data.cell.styles.fillColor = GREEN_FILL;
        data.cell.styles.textColor = GREEN_TEXT;
        data.cell.styles.fontStyle = "bold";
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      // Tunn hjälplinje under varje rad
      doc.setDrawColor(...GRID);
      doc.setLineWidth(0.12);
      doc.line(
        data.cell.x,
        data.cell.y + data.cell.height,
        data.cell.x + data.cell.width,
        data.cell.y + data.cell.height,
      );
    },
  });
  // @ts-expect-error - autoTable adds lastAutoTable
  cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 12;

  // ---- Resultat-kort: sammanfattning av jämförelsetabellen ----
  {
    const stripH = 36;
    const cardW = pageW - 2 * margin;
    doc.setFillColor(...PLUM);
    doc.roundedRect(margin, cursorY, cardW, stripH, 1.8, 1.8, "F");
    doc.setFillColor(...CORAL);
    doc.roundedRect(margin, cursorY, 2.4, stripH, 1.1, 1.1, "F");

    const total = rows.length;
    const leftX = margin + 6;
    doc.setTextColor(237, 170, 150);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("RESULTAT AV JÄMFÖRELSEN", leftX, cursorY + 6, { charSpace: 0.35 });

    const winnerIsAtmoce = atmoceWins >= refWins;
    const headline = winnerIsAtmoce
      ? `${atmoce.name} vinner ${atmoceWins} av ${total} nyckeltal`
      : `${reference.name} vinner ${refWins} av ${total} nyckeltal`;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text(headline, leftX, cursorY + 12.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(210, 200, 212);
    const sub = winnerIsAtmoce
      ? `${reference.name}: ${refWins}  ·  Oavgjort: ${ties}`
      : `${atmoce.name}: ${atmoceWins}  ·  Oavgjort: ${ties}`;
    doc.text(sub, margin + cardW - 5, cursorY + 12.5, { align: "right" });

    // Tre nyckeltal till höger
    const npvD = atmoceResult.npv - refResult.npv;
    const pbD =
      paybackA !== null && paybackB !== null ? paybackB - paybackA : null;
    const stats: { label: string; value: string }[] = [
      { label: "Nuvärde-fördel", value: `${npvD >= 0 ? "+" : ""}${sek(npvD)}` },
      {
        label: "Återbetalning",
        value:
          pbD === null
            ? paybackA === null ? "> kalkyltid" : `${fmtNum(paybackA, 1)} år`
            : `${pbD >= 0 ? "" : "+"}${fmtNum(Math.abs(pbD), 1)} år ${pbD >= 0 ? "snabbare" : "långsammare"}`,
      },
      {
        label: `Snösmältning (${snow.location.name})`,
        value: `+${fmtNum(snow.totalRecoveredKwh)} kWh · ${sek(snow.totalNetBenefit)}/år`,
      },
    ];
    const statW = (cardW - 10) / stats.length;
    let sx = leftX - 1;
    const sy = cursorY + 14;
    doc.setDrawColor(90, 70, 92);
    doc.setLineWidth(0.2);
    doc.line(leftX, cursorY + 22.5, margin + cardW - 5, cursorY + 22.5);
    stats.forEach((s, i) => {
      if (i > 0) {
        doc.setDrawColor(90, 70, 92);
        doc.setLineWidth(0.2);
        doc.line(sx - 2, sy + 11, sx - 2, sy + 19);
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.3);
      doc.setTextColor(200, 190, 202);
      doc.text(s.label.toUpperCase(), sx + 1, sy + 13.5, { charSpace: 0.25 });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(s.value, sx + 1, sy + 18.5);
      sx += statW;
    });
  }

  drawFooter(doc, pageW, pageH, margin);

  // ================= SIDA 2 =================
  doc.addPage();

  // ---- Litet sidhuvud ----
  doc.setTextColor(...PLUM);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("ATMOCE", margin, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("Nuvärde & argument", margin + 24, 15);
  doc.setDrawColor(...CORAL);
  doc.setLineWidth(0.8);
  doc.line(margin, 19, pageW - margin, 19);

  cursorY = 27;

  const tpA = input.throughputAtmoceMwh ?? null;
  const tpB = input.throughputRefMwh ?? null;
  const hasTp = tpA !== null && tpB !== null && tpA > 0 && tpB > 0;

  // ---- NPV-graf: större kort ----
  {
    const availW = pageW - 2 * margin;
    const chartH = hasTp ? 76 : 108;
    const atmoceSeries = [
      -atmoceResult.investment,
      ...atmoceResult.rows.map((r) => r.cumulativeNpv),
    ];
    const refSeries = [
      -refResult.investment,
      ...refResult.rows.map((r) => r.cumulativeNpv),
    ];
    const npvDiff = atmoceResult.npv - refResult.npv;
    const takeaway =
      npvDiff >= 0
        ? `Du är ${sek(npvDiff)} bättre med ${atmoce.name} efter ${years} år`
        : `Nuvärdet är ${sek(Math.abs(npvDiff))} lägre med ${atmoce.name} efter ${years} år`;
    drawNpvChart(doc, {
      x: margin,
      y: cursorY,
      w: availW,
      h: chartH,
      years,
      atmoceSeries,
      refSeries,
      atmoceLabel: atmoce.name,
      refLabel: reference.name,
      title: `Ackumulerat nuvärde över ${years} år (kr)`,
      takeaway,
    });
    cursorY += chartH + (hasTp ? 6 : 14);
  }

  // ---- Garanterad genomströmning: stapelgraf ----
  if (hasTp) {
    const a = tpA as number;
    const b = tpB as number;
    const w = pageW - 2 * margin;
    const h = 40;
    const x = margin;
    const y = cursorY;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.3);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PLUM);
    doc.text("Garanterad genomströmning (livstidsenergi, MWh)", x + 5, y + 7.5);

    const diff = a - b;
    const pct = b > 0 ? diff / b : 0;
    doc.setFontSize(8);
    doc.setTextColor(...(diff >= 0 ? GREEN_TEXT : INK));
    doc.text(
      `${diff >= 0 ? "+" : "-"}${fmtNum(Math.abs(diff), 1)} MWh (${diff >= 0 ? "+" : "-"}${fmtPct(Math.abs(pct), 0)})`,
      x + w - 5,
      y + 7.5,
      { align: "right" },
    );

    const labelW = 42;
    const valW = 22;
    const barX = x + 5 + labelW;
    const barMaxW = w - 10 - labelW - valW;
    const max = Math.max(a, b);
    const bars: { label: string; v: number; color: [number, number, number] }[] = [
      { label: atmoce.name, v: a, color: CORAL },
      { label: "Dyness Stack100", v: b, color: INK },
    ];
    bars.forEach((bar, i) => {
      const by = y + 13 + i * 8.5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...INK);
      const lbl = doc.splitTextToSize(bar.label, labelW - 2)[0];
      doc.text(lbl, x + 5, by + 3.6);
      doc.setFillColor(...GRID);
      doc.roundedRect(barX, by, barMaxW, 5, 1, 1, "F");
      doc.setFillColor(...bar.color);
      doc.roundedRect(barX, by, Math.max(2, (bar.v / max) * barMaxW), 5, 1, 1, "F");
      doc.setTextColor(...INK);
      doc.text(`${fmtNum(bar.v, 1)} MWh`, x + w - 5, by + 3.6, { align: "right" });
    });
    const essA = input.throughputEssPriceA ?? atmoce.essPrice;
    const essB = input.throughputEssPriceB ?? reference.essPrice;
    const kA = essA / a;
    const kB = essB / b;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...INK);
    doc.text(
      `Kostnad per MWh (batteri + installation efter GTA): ${atmoce.name} ${fmtNum(kA)} kr/MWh  ·  ${reference.name} ${fmtNum(kB)} kr/MWh`,
      x + 5,
      y + 35,
    );
    cursorY += h + 8;
  }

  // ---- USP: 2×3-rutnät av ljusa kort ----
  {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PLUM);
    doc.text("Varför Atmoce?", margin, cursorY + 3);
    cursorY += 8;

    const prodDiff = atmoceResult.totalProduction - refResult.totalProduction;
    const prodPct =
      refResult.totalProduction > 0 ? prodDiff / refResult.totalProduction : 0;
    const savingsDiff = atmoceResult.totalSavings - refResult.totalSavings;
    const npvGain = atmoceResult.npv - refResult.npv;
    const activeSnowMonths = snow.rows.filter((m) => m.applied).length;

    const usps: { title: string; body: string; proof: string }[] = [
      {
        title: `${atmoce.inverterWarrantyYears} års produktgaranti`,
        body: `Mot ${reference.inverterWarrantyYears} år för ${reference.name}.`,
        proof:
          refResult.replacementYears.length > 0
            ? `Sparar ${sek(refResult.totalReplacementCost)} i ${refResult.replacementYears.length} växelriktarbyten (år ${refResult.replacementYears.join(", ")}).`
            : `Noll växelriktarbyten under ${years} år.`,
      },
      {
        title:
          prodDiff > 0
            ? `+${fmtPct(prodPct, 1)} mer producerad el`
            : "Panelnivå-MPPT",
        body: "Panelnivå-MPPT eliminerar skuggförluster.",
        proof:
          prodDiff > 0
            ? `+${fmtNum(prodDiff)} kWh över ${years} år jämfört med ${reference.name}.`
            : `${fmtNum(atmoceResult.totalProduction)} kWh över ${years} år.`,
      },
      {
        title: "Panelnivå-övervakning",
        body: "Fel upptäcks samma dag, inte efter månader.",
        proof: `Varje panel mäts separat — ${panels} mätpunkter i denna anläggning.`,
      },
      {
        title: "Säkrare på taket",
        body: "Lågspänd AC per panel — ingen högspänd DC.",
        proof: `Ingen DC-sträng på ${fmtNum((panels * wpPerPanel) / 1000, 2)} kWp över taket.`,
      },
      {
        title: "Snösmältning",
        body: `${MODE_LABEL[snowMode]} i ${snow.location.name}.`,
        proof:
          snow.totalRecoveredKwh > 0
            ? `+${fmtNum(snow.totalRecoveredKwh)} kWh/år (${sek(snow.totalNetBenefit)}/år netto) under ${activeSnowMonths} månader.`
            : "Valbart vintertid — håller panelerna snöfria.",
      },
      {
        title: "Bättre totalekonomi",
        body: `Högre nuvärde än ${reference.name}.`,
        proof: `${npvGain >= 0 ? "+" : ""}${sek(npvGain)} i nuvärde och ${savingsDiff >= 0 ? "+" : ""}${sek(savingsDiff)} i besparing över ${years} år.`,
      },
    ];

    const cardH = 22;
    const colGap = 4;
    const rowGap = 5;
    const colW = (pageW - 2 * margin - colGap) / 2;

    usps.forEach((u, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = margin + col * (colW + colGap);
      const y = cursorY + row * (cardH + rowGap);

      doc.setFillColor(...TINT);
      doc.roundedRect(x, y, colW, cardH, 1.4, 1.4, "F");

      const num = `0${i + 1}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...CORAL);
      doc.text(num, x + 4, y + 5.4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...PLUM);
      doc.text(u.title, x + 12, y + 5.4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(...MUTED);
      const wrapped = doc.splitTextToSize(u.body, colW - 16);
      doc.text(wrapped, x + 12, y + 10.4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...PLUM);
      const proofWrapped = doc.splitTextToSize(u.proof, colW - 16).slice(0, 2);
      doc.text(proofWrapped, x + 12, y + 15.6);
    });

  }

  drawFooter(doc, pageW, pageH, margin);

  doc.save(`atmoce-kalkyl-${snow.location.name.toLowerCase()}-${today}.pdf`);
}
