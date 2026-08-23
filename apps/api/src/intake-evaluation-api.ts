import type { IntakeProviderEvaluationV1 } from "@gtm-observability/core";
import {
  IntakeEvaluationReportRepository,
  type IntakeEvaluationReportV1,
} from "./intake-evaluations.js";

export const INTAKE_EVALUATION_API_SCHEMA_VERSION = 1 as const;

export type IntakeProviderEvaluationSummaryV1 = Omit<IntakeProviderEvaluationV1, "cases">;

export interface IntakeEvaluationReportSummaryV1 {
  schemaVersion: IntakeEvaluationReportV1["schemaVersion"];
  id: string;
  createdAt: string;
  corpusSchemaVersion: IntakeEvaluationReportV1["corpusSchemaVersion"];
  corpusCaseCount: number;
  providers: IntakeProviderEvaluationSummaryV1[];
}

export type IntakeEvaluationApiResponse = {
  status: 200 | 404 | 405 | 503;
  body: unknown;
};

const REPORT_DETAIL_ROUTE = /^\/api\/intake-evaluations\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127})$/;

function reportSummary(report: IntakeEvaluationReportV1): IntakeEvaluationReportSummaryV1 {
  return {
    schemaVersion: report.schemaVersion,
    id: report.id,
    createdAt: report.createdAt,
    corpusSchemaVersion: report.corpusSchemaVersion,
    corpusCaseCount: report.corpusCaseCount,
    providers: report.providers.map(({ cases: _cases, ...summary }) => structuredClone(summary)),
  };
}

export function intakeEvaluationApiResponse(
  method: string,
  pathname: string,
  reportStorePath: string,
): IntakeEvaluationApiResponse | undefined {
  const listRoute = pathname === "/api/intake-evaluations";
  const detailMatch = pathname.match(REPORT_DETAIL_ROUTE);
  if (!listRoute && !detailMatch) return undefined;
  if (method !== "GET") {
    return {
      status: 405,
      body: { error: "Intake evaluation reports are read-only." },
    };
  }

  try {
    const repository = new IntakeEvaluationReportRepository(reportStorePath);
    if (listRoute) {
      return {
        status: 200,
        body: {
          schemaVersion: INTAKE_EVALUATION_API_SCHEMA_VERSION,
          reports: repository.list().reverse().map(reportSummary),
        },
      };
    }
    const report = repository.get(detailMatch?.[1] ?? "");
    return report
      ? {
          status: 200,
          body: {
            schemaVersion: INTAKE_EVALUATION_API_SCHEMA_VERSION,
            report,
          },
        }
      : {
          status: 404,
          body: { error: "Intake evaluation report was not found." },
        };
  } catch {
    return {
      status: 503,
      body: { error: "Intake evaluation reports are unavailable." },
    };
  }
}
