import { Authenticator } from '@unicitylabs/commons/lib/api/Authenticator.js';
import { ISigningService } from '@unicitylabs/commons/lib/signing/ISigningService.js';

import { IAuthenticatorFactory } from './IAuthenticatorFactory.js';
import { MintTransactionData } from './transaction/MintTransactionData.js';
import { TransactionData } from './transaction/TransactionData.js';
import { DataHash } from '../../shared/src/hash/DataHash.js';

export interface ISourceState {
  readonly hash: DataHash;
}

export class AuthenticatorFactory implements IAuthenticatorFactory {
  public create(
    signingService: ISigningService,
    transactionData: TransactionData | MintTransactionData,
    sourceState: ISourceState,
  ): Promise<Authenticator> {
    return Authenticator.create(signingService, transactionData.hash, sourceState.hash);
  }
}
