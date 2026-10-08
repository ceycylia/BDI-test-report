import { forwardRef } from "react";

export type EvaluationReportChartSection = {
  id: string;
  title: string;
  value: number | null;
};

type EvaluationReportChartProps = {
  title: string;
  sections: EvaluationReportChartSection[];
};

const CHART_WIDTH = 950;
const CHART_HEIGHT = 480;
const PLOT_LEFT = 214;
const PLOT_TOP = 32;
const PLOT_WIDTH = 686;
const PLOT_HEIGHT = 394;
const AXIS_MIN = 90;
const AXIS_MAX = 101;
const TICKS = [90, 92, 94, 96, 98, 100];

function chartX(value: number) {
  const bounded = Math.max(AXIS_MIN, Math.min(100, value));
  return PLOT_LEFT + ((bounded - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * PLOT_WIDTH;
}

export const EvaluationReportChart = forwardRef<SVGSVGElement, EvaluationReportChartProps>(
  function EvaluationReportChart({ title, sections }, ref) {
    const plotPaddingY = 55;
    const barHeight = 75;

    return (
      <svg
        ref={ref}
        className="evaluation-report-chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={title}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width={CHART_WIDTH} height={CHART_HEIGHT} fill="#ffffff" />
        <text
          x={PLOT_LEFT + PLOT_WIDTH / 2}
          y="23"
          fill="#111111"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="19"
          textAnchor="middle"
        >
          {title}
        </text>
        <rect
          x={PLOT_LEFT}
          y={PLOT_TOP}
          width={PLOT_WIDTH}
          height={PLOT_HEIGHT}
          fill="none"
          stroke="#111111"
          strokeWidth="1.2"
        />

        {TICKS.map((tick) => {
          const x = chartX(tick);
          return (
            <g key={tick}>
              <line x1={x} y1={PLOT_TOP + PLOT_HEIGHT} x2={x} y2={PLOT_TOP + PLOT_HEIGHT + 6} stroke="#111111" strokeWidth="1" />
              <text x={x} y={PLOT_TOP + PLOT_HEIGHT + 23} fill="#111111" fontFamily="Arial, Helvetica, sans-serif" fontSize="14" textAnchor="middle">
                {tick}
              </text>
            </g>
          );
        })}

        {sections.map((section, index) => {
          const centerY = sections.length <= 1
            ? PLOT_TOP + PLOT_HEIGHT / 2
            : PLOT_TOP + plotPaddingY + ((PLOT_HEIGHT - plotPaddingY * 2) / (sections.length - 1)) * index;
          const barY = centerY - barHeight / 2;
          const numericValue = section.value ?? AXIS_MIN;
          const endX = chartX(numericValue);
          const barWidth = Math.max(0, endX - PLOT_LEFT);

          return (
            <g key={section.id}>
              <line x1={PLOT_LEFT - 6} y1={centerY} x2={PLOT_LEFT} y2={centerY} stroke="#111111" strokeWidth="1" />
              <text
                x={PLOT_LEFT - 10}
                y={centerY + 5}
                fill="#111111"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="15"
                textAnchor="end"
              >
                {section.title}
              </text>
              {section.value !== null && <rect x={PLOT_LEFT} y={barY} width={barWidth} height={barHeight} fill="#1f77b4" />}
              <text
                x={Math.min(endX + 6, CHART_WIDTH - 5)}
                y={centerY + 5}
                fill="#111111"
                fontFamily="Arial, Helvetica, sans-serif"
                fontSize="15"
                textAnchor="start"
              >
                {section.value === null ? "-" : `${section.value.toFixed(2)}%`}
              </text>
            </g>
          );
        })}

        <text
          x={PLOT_LEFT + PLOT_WIDTH / 2}
          y="468"
          fill="#111111"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="15"
          textAnchor="middle"
        >
          Nilai (%)
        </text>
      </svg>
    );
  },
);
