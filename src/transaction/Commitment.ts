import { Authenticator } from '@unicitylabs/commons/lib/api/Authenticator.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';

import { ISerializable } from '../ISerializable.js';
import { MintTransactionData } from './MintTransactionData.js';
import { TransactionData } from './TransactionData.js';

export class Commitment<T extends TransactionData | MintTransactionData<ISerializable | null>> {
  public constructor(
    public readonly requestId: RequestId,
    public readonly transactionData: T,
    public readonly authenticator: Authenticator,
  ) {}
}
