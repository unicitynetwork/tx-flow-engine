import { ISubmitStateTransitionResponseDto } from '@unicitylabs/commons/lib/api/ISubmitStateTransitionResponseDto.js';

import { InclusionProof } from '../../../shared/src/api/InclusionProof.js';

export class SubmitStateTransitionResponse {
  public constructor(public readonly inclusionProof: InclusionProof) {}

  public static fromDto(data: unknown): SubmitStateTransitionResponse {
    if (!SubmitStateTransitionResponse.isDto(data)) {
      throw new Error('Parsing submit state transition response failed.');
    }

    return new SubmitStateTransitionResponse(InclusionProof.fromDto(data.inclusionProof));
  }

  public static isDto(data: unknown): data is ISubmitStateTransitionResponseDto {
    return data instanceof Object && 'inclusionProof' in data;
  }
}
