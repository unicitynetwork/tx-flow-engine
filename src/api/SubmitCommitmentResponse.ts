export enum SubmitCommitmentStatus {
  SUCCESS = 'SUCCESS',
  AUTHENTICATOR_VERIFICATION_FAILED = 'AUTHENTICATOR_VERIFICATION_FAILED',
  REQUEST_ID_MISMATCH = 'REQUEST_ID_MISMATCH',
  REQUEST_ID_EXISTS = 'REQUEST_ID_EXISTS',
}

interface ISubmitCommitmentResponseDto {
  readonly status: SubmitCommitmentStatus;
}

export class SubmitCommitmentResponse {
  public constructor(public readonly status: SubmitCommitmentStatus) {}

  public static fromDto(data: unknown): SubmitCommitmentResponse {
    if (!SubmitCommitmentResponse.isDto(data)) {
      throw new Error('Parsing submit state transition response failed.');
    }

    return new SubmitCommitmentResponse(data.status);
  }

  public static isDto(data: unknown): data is ISubmitCommitmentResponseDto {
    return typeof data === 'object' && data !== null && 'status' in data && typeof data.status === 'string';
  }
}
