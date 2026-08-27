import {
  authorizeOrganization,
  validateIntakeInterpretationInputV2,
  validateIntakeInterpretationV2,
  type IntakeInterpretationInputV2,
  type IntakeInterpretationV2,
  type OrganizationAuthorityV1,
} from "@gtm-observability/core";

export interface LiveIntakeProvider {
  interpretLive(
    input: Readonly<IntakeInterpretationInputV2>,
    signal: AbortSignal,
  ): Promise<unknown>;
}

export class LiveIntakeService {
  constructor(
    private readonly organizationId: string,
    private readonly provider: LiveIntakeProvider,
  ) {}

  async interpret(
    authority: OrganizationAuthorityV1,
    input: unknown,
    signal: AbortSignal,
  ): Promise<IntakeInterpretationV2> {
    if (!authorizeOrganization(authority, this.organizationId, "org:tracking:write")) {
      throw new Error("Organization write permission is required.");
    }
    if (validateIntakeInterpretationInputV2(input).length > 0) {
      throw new Error("Live intake input is invalid.");
    }

    const safeInput = structuredClone(input) as IntakeInterpretationInputV2;
    const interpretation = await this.provider.interpretLive(safeInput, signal);
    if (validateIntakeInterpretationV2(safeInput, interpretation).length > 0) {
      throw new Error("Live intake provider output is invalid.");
    }

    return structuredClone(interpretation) as IntakeInterpretationV2;
  }
}
