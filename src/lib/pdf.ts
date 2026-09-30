import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
const MUTED: [number, number, number] = [120, 112, 122];
const FAINT: [number, number, number] = [168, 160, 172];
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
  chartElement?: HTMLElement | null;
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

  // Outer card — vit med tunn kant, rundade hörn
  doc.setDrawColor(...GRID);
  doc.setLineWidth(0.2);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...PLUM);
  doc.text(title, x + 4, y + 6);

  // Legend (top right)
  const legendY = y + 6;
  let legendX = x + w - 4;
  const legendItems: { label: string; color: [number, number, number] }[] = [
    { label: refLabel, color: FAINT },
    { label: atmoceLabel, color: CORAL },
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  legendItems.forEach((it) => {
    const tw = doc.getTextWidth(it.label);
    doc.setTextColor(...MUTED);
    doc.text(it.label, legendX - tw, legendY);
    doc.setFillColor(...it.color);
    doc.rect(legendX - tw - 4, legendY - 2, 3, 1.6, "F");
    legendX -= tw + 10;
  });

  // Plot area
  const padL = 15;
  const padR = 5;
  const padT = 10;
  const padB = 9;
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

  // Y ticks (5) — ljusa hjälplinjer
  const yTicks = 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...FAINT);
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

  // X ticks every 5 years
  doc.setDrawColor(...GRID);
  doc.setLineWidth(0.12);
  doc.setTextColor(...FAINT);
  const step = years >= 20 ? 5 : years >= 10 ? 2 : 1;
  for (let yr = 0; yr <= years; yr += step) {
    const { px } = toPx(yr, yMin);
    const py = plotY + plotH;
    doc.line(px, py, px, py + 1);
    doc.text(String(yr), px, py + 3.4, { align: "center" });
  }

  // Axellinjer — tunna och diskreta
  doc.setDrawColor(...GRID);
  doc.setLineWidth(0.25);
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
        doc.circle(p.px, p.py, 0.35, "F");
      }
    }
  };

  drawSeries(refSeries, FAINT, 0.45, false);
  drawSeries(atmoceSeries, CORAL, 0.85, true);

  // Takeaway-raden längst ner i kortet
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(takeaway, x + 4, y + h - 2.5);
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
  valueSize = 10.5,
) {
  doc.setFillColor(...TINT);
  doc.roundedRect(x, y, w, h, 1.2, 1.2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.3);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), x + 3.5, y + 4.2, { charSpace: 0.25 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(valueSize);
  doc.setTextColor(...PLUM);
  doc.text(value, x + 3.5, y + 9.2);
  if (sub) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.3);
    doc.setTextColor(...MUTED);
    doc.text(sub, x + 3.5, y + h - 1.8);
  }
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

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  const today = new Date().toLocaleDateString("sv-SE");

  // ---- Sidhuvud: ljus, ATMOCE-ordmärke, tunn coral-linje ----
  doc.setTextColor(...PLUM);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("ATMOCE", margin, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("INVESTERINGSKALKYL — SOLENERGI", margin, 19.5, { charSpace: 0.5 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const right = `${snow.location.name}  ·  ${today}`;
  doc.text(right, pageW - margin, 12.5, { align: "right" });

  doc.setDrawColor(...CORAL);
  doc.setLineWidth(0.8);
  doc.line(margin, 23, pageW - margin, 23);

  let cursorY = 28.5;

  // ---- Tre nyckelvärdes-boxar ----
  {
    const gap = 4;
    const boxW = (pageW - 2 * margin - 2 * gap) / 3;
    const boxH = 13.5;
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
      8.5,
    );
    cursorY += boxH + 4.5;
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

  const rows: Cmp[] = [
    {
      label: "Investering",
      a: fmtSek(atmoceResult.investment),
      b: fmtSek(refResult.investment),
      winner: cmpLower(atmoceResult.investment, refResult.investment),
      delta: fmtSek(Math.abs(atmoceResult.investment - refResult.investment)),
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
      a: fmtSek(atmoceResult.npv),
      b: fmtSek(refResult.npv),
      winner: cmpHigher(atmoceResult.npv, refResult.npv),
      delta: fmtSek(Math.abs(atmoceResult.npv - refResult.npv)),
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
      a: fmtSek(atmoceResult.totalSavings),
      b: fmtSek(refResult.totalSavings),
      winner: cmpHigher(atmoceResult.totalSavings, refResult.totalSavings),
      delta: fmtSek(Math.abs(atmoceResult.totalSavings - refResult.totalSavings)),
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
    theme: "plain",
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [150, 142, 152],
      fontStyle: "bold",
      fontSize: 7,
      cellPadding: { top: 1.5, bottom: 1.5, left: 0.5, right: 1.5 },
    },
    bodyStyles: {
      fontSize: 8,
      textColor: PLUM,
      cellPadding: { top: 1.3, bottom: 1.3, left: 0.5, right: 1.5 },
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 48 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right", textColor: MUTED, fontSize: 7, cellWidth: 34 },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index === 1) {
        data.cell.styles.textColor = CORAL;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 7.5;
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
  cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 4.5;

  // ---- Resultat-kort: mörkt plum, rundade hörn ----
  {
    const stripH = 15;
    doc.setFillColor(...PLUM);
    doc.roundedRect(margin, cursorY, pageW - 2 * margin, stripH, 1.5, 1.5, "F");
    doc.setFillColor(...CORAL);
    doc.roundedRect(margin, cursorY, 2.2, stripH, 1, 1, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.3);
    doc.text("RESULTAT", margin + 5, cursorY + 4.6, { charSpace: 0.35 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(`${atmoce.name} ${atmoceWins} – ${refWins} ${reference.name}`, margin + 5, cursorY + 10.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(210, 200, 212);
    doc.text(`(oavgjort ${ties})`, margin + 5 + doc.getTextWidth(`${atmoce.name} ${atmoceWins} – ${refWins} ${reference.name}`) + 1.6, cursorY + 10.2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.3);
    doc.setTextColor(220, 212, 222);
    const snowLine1 = `Snösmältning ${snow.location.name} (${MODE_LABEL[snowMode]}): +${fmtNum(snow.totalRecoveredKwh)} kWh/år`;
    const snowLine2 = `Nettovinst ${fmtSek(snow.totalNetBenefit)}/år`;
    doc.text(snowLine1, pageW - margin - 4, cursorY + 6.2, { align: "right" });
    doc.text(snowLine2, pageW - margin - 4, cursorY + 10.4, { align: "right" });
    cursorY += stripH + 4.5;
  }

  // ---- NPV-graf: kompakt kort ----
  {
    const availW = pageW - 2 * margin;
    // USP-rutnät: 3 rader × 13 mm + 2 gap × 2.5 mm + rubrik + sidfot
    const uspBlockH = 3 * 13 + 2 * 2.5 + 4;
    const footerSpace = 9;
    const chartH = Math.min(62, Math.max(44, pageH - cursorY - uspBlockH - footerSpace - 6));
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
        ? `Du är ${fmtSek(npvDiff)} bättre med ${atmoce.name} efter ${years} år`
        : `Nuvärdet är ${fmtSek(Math.abs(npvDiff))} lägre med ${atmoce.name} efter ${years} år`;
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
    cursorY += chartH + 5;
  }

  // ---- USP: 2×3-rutnät av ljusa kort ----
  {
    const usps: { title: string; body: string }[] = [
      {
        title: "25 års produktgaranti",
        body: "Noll växelriktarbyten under kalkyltiden.",
      },
      {
        title: "+8 % årsproduktion",
        body: "Panelnivå-MPPT eliminerar skuggförluster.",
      },
      {
        title: "Panelnivå-övervakning",
        body: "Fel upptäcks samma dag, inte efter månader.",
      },
      {
        title: "Säkrare på taket",
        body: "Lågspänd AC per panel — ingen högspänd DC.",
      },
      {
        title: "Snösmältning",
        body: "Valbart vintertid — håller panelerna snöfria.",
      },
      {
        title: "Skalbart & enkelt",
        body: "Lägg till paneler utan att byta central inverter.",
      },
    ];

    const cardH = 13;
    const colGap = 3;
    const rowGap = 2.5;
    const colW = (pageW - 2 * margin - colGap) / 2;

    usps.forEach((u, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = margin + col * (colW + colGap);
      const y = cursorY + row * (cardH + rowGap);

      doc.setFillColor(...TINT);
      doc.roundedRect(x, y, colW, cardH, 1.2, 1.2, "F");

      const num = `0${i + 1}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...CORAL);
      doc.text(num, x + 3.5, y + 4.4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...PLUM);
      doc.text(u.title, x + 10.5, y + 4.4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(...MUTED);
      const wrapped = doc.splitTextToSize(u.body, colW - 14);
      doc.text(wrapped, x + 10.5, y + 8.6);
    });
    cursorY += 3 * cardH + 2 * rowGap + 5;
  }

  // ---- Sidfot ----
  {
    doc.setDrawColor(...GRID);
    doc.setLineWidth(0.2);
    doc.line(margin, pageH - 8, pageW - margin, pageH - 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...FAINT);
    doc.text(
      "Beräkningarna är indikativa och baseras på prislista 2026 inkl. 15 % grönt teknikavdrag.",
      margin,
      pageH - 4.5,
    );
    const gen = "Genererad av Atmoce-kalkylatorn";
    doc.text(gen, pageW - margin - doc.getTextWidth(gen), pageH - 4.5);
  }

  doc.save(`atmoce-kalkyl-${snow.location.name.toLowerCase()}-${today}.pdf`);
}
