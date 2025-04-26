import { Authenticator } from '@unicitylabs/commons/lib/api/Authenticator.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';

import { MintTransactionData } from './transaction/MintTransactionData.js';
import { TransactionData } from './transaction/TransactionData.js';

export class Commitment<T extends TransactionData | MintTransactionData> {
  public constructor(
    public readonly requestId: RequestId,
    public readonly transactionData: T,
    public readonly authenticator: Authenticator,
  ) {}
}
