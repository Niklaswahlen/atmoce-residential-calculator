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
const MUTED: [number, number, number] = [110, 100, 110];
const GRID: [number, number, number] = [220, 215, 220];

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
  },
) {
  const { x, y, w, h, years, atmoceSeries, refSeries, atmoceLabel, refLabel, title } = opts;

  // Outer card
  doc.setDrawColor(...GRID);
  doc.setLineWidth(0.2);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, w, h, "FD");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PLUM);
  doc.text(title, x + 3, y + 5);

  // Legend (top right)
  const legendY = y + 4;
  let legendX = x + w - 3;
  const legendItems: { label: string; color: [number, number, number] }[] = [
    { label: refLabel, color: PLUM },
    { label: atmoceLabel, color: CORAL },
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  legendItems.forEach((it) => {
    const tw = doc.getTextWidth(it.label);
    legendX -= tw;
    doc.setTextColor(...PLUM);
    doc.text(it.label, legendX, legendY);
    legendX -= 2;
    doc.setFillColor(...it.color);
    doc.rect(legendX - 3, legendY - 2, 3, 1.6, "F");
    legendX -= 5;
  });

  // Plot area
  const padL = 14;
  const padR = 4;
  const padT = 8;
  const padB = 8;
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

  // Y ticks (5)
  const yTicks = 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.setDrawColor(...GRID);
  doc.setLineWidth(0.15);
  for (let i = 0; i <= yTicks; i++) {
    const val = yMin + ((yMax - yMin) * i) / yTicks;
    const py = plotY + plotH - (i / yTicks) * plotH;
    doc.line(plotX, py, plotX + plotW, py);
    const label = formatK(val);
    doc.text(label, plotX - 1.5, py + 1, { align: "right" });
  }

  // Zero line (if within range)
  if (yMin < 0 && yMax > 0) {
    const zeroY = plotY + plotH - ((0 - yMin) / (yMax - yMin)) * plotH;
    doc.setDrawColor(140, 130, 140);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([0.8, 0.8], 0);
    doc.line(plotX, zeroY, plotX + plotW, zeroY);
    doc.setLineDashPattern([], 0);
  }

  // X ticks every 5 years
  doc.setDrawColor(...GRID);
  doc.setLineWidth(0.15);
  doc.setTextColor(...MUTED);
  const step = years >= 20 ? 5 : years >= 10 ? 2 : 1;
  for (let yr = 0; yr <= years; yr += step) {
    const { px } = toPx(yr, yMin);
    const py = plotY + plotH;
    doc.line(px, py, px, py + 1.2);
    doc.text(String(yr), px, py + 4, { align: "center" });
  }

  // Axes
  doc.setDrawColor(...PLUM);
  doc.setLineWidth(0.3);
  doc.line(plotX, plotY, plotX, plotY + plotH);
  doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);

  // Draw a series
  const drawSeries = (series: number[], color: [number, number, number]) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.7);
    let prev: { px: number; py: number } | null = null;
    series.forEach((val, yr) => {
      const p = toPx(yr, val);
      if (prev) doc.line(prev.px, prev.py, p.px, p.py);
      prev = p;
    });
    // Dots
    doc.setFillColor(...color);
    series.forEach((val, yr) => {
      const p = toPx(yr, val);
      doc.circle(p.px, p.py, 0.4, "F");
    });
  };

  drawSeries(refSeries, PLUM);
  drawSeries(atmoceSeries, CORAL);
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
  const margin = 10;

  const today = new Date().toLocaleDateString("sv-SE");

  const drawHeader = () => {
    doc.setFillColor(...PLUM);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("ATMOCE", margin, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Investeringskalkyl — Solenergi", margin, 14);
    doc.setFontSize(8);
    const right = `${snow.location.name}  ·  ${today}`;
    doc.text(right, pageW - margin - doc.getTextWidth(right), 14);
    doc.setFillColor(...CORAL);
    doc.rect(0, 18, pageW, 1, "F");
  };

  const drawFooter = () => {
    doc.setTextColor(...MUTED);
    doc.setFontSize(6.5);
    doc.text(
      "Beräkningarna är indikativa och baseras på prislista 2026 inkl. 15 % grönt teknikavdrag.",
      margin,
      pageH - 4,
    );
    const gen = "Genererad av Atmoce-kalkylatorn";
    doc.text(gen, pageW - margin - doc.getTextWidth(gen), pageH - 4);
  };

  drawHeader();
  let cursorY = 22;

  // Subtitle
  doc.setTextColor(...PLUM);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    `${panels} paneler × ${wpPerPanel} W = ${fmtNum((panels * wpPerPanel) / 1000, 2)} kWp  ·  Kalkyltid ${years} år  ·  Jämförelse: ${atmoce.name} vs ${reference.name}`,
    margin,
    cursorY,
  );
  cursorY += 4;

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
      fontSize: 8,
      cellPadding: 1.2,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: PLUM,
      cellPadding: 1.2,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 42 },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right", textColor: MUTED, fontSize: 7, cellWidth: 35 },
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
  cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 3;

  // Sammanställning + snösmältning som en kompakt rad
  const stripH = 9;
  doc.setFillColor(245, 248, 245);
  doc.rect(margin, cursorY, pageW - 2 * margin, stripH, "F");
  doc.setTextColor(...PLUM);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(
    `Resultat: ${atmoce.name} ${atmoceWins} – ${refWins} ${reference.name}  (oavgjort ${ties})`,
    margin + 2,
    cursorY + 5.8,
  );
  doc.setFont("helvetica", "normal");
  const snowText = `Snösmältning ${snow.location.name} (${MODE_LABEL[snowMode]}): +${fmtNum(snow.totalRecoveredKwh)} kWh/år, nettovinst ${fmtSek(snow.totalNetBenefit)}/år`;
  doc.text(snowText, pageW - margin - 2 - doc.getTextWidth(snowText), cursorY + 5.8);
  cursorY += stripH + 3;

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
      // Reservera plats för USP-kortet (ca 42 mm) + footer
      const maxChartH = pageH - cursorY - 42 - 8 - 6;
      const imgH = Math.min(availW * ratio, Math.max(40, maxChartH));
      const imgW = imgH / ratio;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...PLUM);
      doc.text(`Ackumulerat nuvärde över ${years} år`, margin, cursorY);
      cursorY += 2;
      doc.addImage(
        imgData,
        "PNG",
        margin + (availW - imgW) / 2,
        cursorY,
        imgW,
        imgH,
      );
      cursorY += imgH + 3;
    } catch (err) {
      console.warn("Chart capture failed", err);
    }
  }

  // USP-kort längst ner
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

  const uspH = 38;
  const uspY = Math.min(cursorY, pageH - uspH - 7);
  doc.setFillColor(...PLUM);
  doc.rect(margin, uspY, pageW - 2 * margin, uspH, "F");
  doc.setFillColor(...CORAL);
  doc.rect(margin, uspY, 2.5, uspH, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Varför Atmoce?", margin + 5, uspY + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(230, 220, 230);
  doc.text(
    "Sex skäl att välja mikroväxelriktarsystemet.",
    margin + 40,
    uspY + 5.5,
  );

  const innerW = pageW - 2 * margin - 10;
  const colW = innerW / 3;
  const rowH = 13;
  usps.forEach((u, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = margin + 5 + col * colW;
    const y = uspY + 11 + row * rowH;
    doc.setFillColor(...CORAL);
    doc.circle(x + 1, y, 0.9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(u.title, x + 3.5, y + 0.8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(220, 215, 220);
    const wrapped = doc.splitTextToSize(u.body, colW - 5);
    doc.text(wrapped, x + 3.5, y + 4.8);
  });

  drawFooter();

  doc.save(`atmoce-kalkyl-${snow.location.name.toLowerCase()}-${today}.pdf`);
}