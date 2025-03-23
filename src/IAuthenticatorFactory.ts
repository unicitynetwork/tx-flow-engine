import { ISigningService } from '@unicitylabs/commons/lib/signing/ISigningService.js';

import { ISourceState } from './AuthenticatorFactory.js';
import { MintTransactionData } from './transaction/MintTransactionData.js';
import { TransactionData } from './transaction/TransactionData.js';

export interface IAuthenticator {
  toDto(): unknown;
}

export interface IAuthenticatorFactory {
  create(
    signingService: ISigningService,
    transactionData: TransactionData | MintTransactionData,
    sourceState: ISourceState,
  ): Promise<IAuthenticator>;
}
