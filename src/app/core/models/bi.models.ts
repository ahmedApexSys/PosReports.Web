/**
 * Mirrors the chart-friendly response shapes from
 * PointOfSale.Application.DTOs.ReportingDtos.BusinessIntelligence.BiSharedDtos.
 * Every Phase 8 BI / Insights endpoint returns `BiPanel`.
 */

export interface BiText {
  en: string;
  ar: string;
  /** Server-picked based on the request's `language` field — render this directly. */
  picked: string;
}

export enum InsightSeverity {
  Good     = 0,
  Info     = 1,
  Warning  = 2,
  High     = 3,
  Critical = 4,
}

export interface BiInsight {
  code: string;
  severity: InsightSeverity;
  headline: BiText;
  detail?: BiText;
  recommendation?: BiText;
  value?: number;
  reference?: number;
}

export type Trend = 'up' | 'down' | 'flat';
export type Tone  = 'good' | 'info' | 'warning' | 'high' | 'critical';

export interface KpiCard {
  label: BiText;
  value: number;
  unit: string;
  reference?: number;
  changePercent?: number;
  trend?: Trend;
  tone?: Tone;
  annotation?: BiText;
}

export interface CategorySlice {
  key: string;
  label: BiText;
  value: number;
  secondary?: number;
  percent?: number;
  tone?: string;
}

export interface CategoryChart {
  title: BiText;
  xAxisLabel?: BiText;
  yAxisLabel?: BiText;
  slices: CategorySlice[];
  total: number;
}

export interface TimeSeriesPoint {
  x: string; // ISO date string
  y: number;
  secondary?: number;
}

export interface TimeSeriesLine {
  key: string;
  label: BiText;
  points: TimeSeriesPoint[];
}

export interface TimeSeriesChart {
  title: BiText;
  xAxisLabel?: BiText;
  yAxisLabel?: BiText;
  series: TimeSeriesLine[];
}

export interface HeatmapCell {
  xKey: string;
  yKey: string;
  value: number;
}

export interface HeatmapChart {
  title: BiText;
  xAxisLabel: BiText;
  yAxisLabel: BiText;
  xKeys: string[];
  yKeys: string[];
  cells: HeatmapCell[];
  min: number;
  max: number;
}

export interface ParetoRow {
  key: string;
  label: BiText;
  value: number;
  cumulative: number;
  cumulativePercent: number;
  inTopBand: boolean;
}

export interface ParetoChart {
  title: BiText;
  metric?: BiText;
  rows: ParetoRow[];
  total: number;
  topBandCount: number;
  topBandShare: number;
}

export interface BiMeta {
  fromDate: string;
  toDate: string;
  branchId?: number;
  language: string;
  rowsScanned: number;
  capApplied?: number;
}

export interface BiPanel {
  kpis: KpiCard[];
  categories: CategoryChart[];
  timeSeries: TimeSeriesChart[];
  heatmaps: HeatmapChart[];
  paretos: ParetoChart[];
  insights: BiInsight[];
  conclusion: BiText;
  meta: BiMeta;
}

export interface BiReportRequest {
  fromDate: string;
  toDate: string;
  branchId?: number | null;
  language?: 'en' | 'ar';
  compareWindowDays?: number;
}

/** Maps insight severity to the Tailwind tone class. */
export const SEVERITY_TONE: Record<InsightSeverity, Tone> = {
  [InsightSeverity.Good]:     'good',
  [InsightSeverity.Info]:     'info',
  [InsightSeverity.Warning]:  'warning',
  [InsightSeverity.High]:     'high',
  [InsightSeverity.Critical]: 'critical',
};
