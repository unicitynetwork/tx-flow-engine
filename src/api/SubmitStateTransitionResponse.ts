import { ISubmitStateTransitionResponseDto } from '@unicitylabs/commons/lib/api/ISubmitStateTransitionResponseDto.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { SubmitStateTransitionStatus } from '@unicitylabs/commons/lib/api/SubmitStateTransitionStatus.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

export class SubmitStateTransitionResponse {
  public constructor(
    public readonly status: SubmitStateTransitionStatus,
    public readonly requestId: RequestId,
  ) {}

  public static fromDto(data: unknown): SubmitStateTransitionResponse {
    if (!SubmitStateTransitionResponse.isDto(data)) {
      throw new Error('Parsing submit state transition response failed.');
    }

    return new SubmitStateTransitionResponse(
      data.status,
      RequestId.createFromBytes(HexConverter.decode(data.requestId)),
    );
  }

  public static isDto(data: unknown): data is ISubmitStateTransitionResponseDto {
    return (
      data instanceof Object &&
      'status' in data &&
      'requestId' in data &&
      typeof data.status === 'string' &&
      SubmitStateTransitionStatus[data.status as SubmitStateTransitionStatus] &&
      typeof data.requestId === 'string'
    );
  }
}
