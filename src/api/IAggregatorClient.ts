import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';

import { DataHash } from '../../../shared/src/hash/DataHash.js';
import { IAuthenticator } from '../IAuthenticatorFactory.js';
import { SubmitStateTransitionResponse } from './SubmitStateTransitionResponse.js';

export interface IAggregatorClient {
  submitTransaction(
    requestId: RequestId,
    transactionHash: DataHash,
    authenticator: IAuthenticator,
  ): Promise<SubmitStateTransitionResponse>;

  getInclusionProof(requestId: RequestId): Promise<InclusionProof>;
}
