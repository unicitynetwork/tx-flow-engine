import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';

import { IAuthenticator } from './IAuthenticatorFactory.js';

export interface IAggregatorClient {
  submitTransaction(requestId: RequestId, payload: Uint8Array, authenticator: IAuthenticator): Promise<void>;

  getInclusionProof(requestId: RequestId): Promise<InclusionProof>;
}
