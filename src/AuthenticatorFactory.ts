import { Authenticator } from '@unicitylabs/commons/lib/api/Authenticator.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { ISigningService } from '@unicitylabs/commons/lib/signing/ISigningService.js';

import { IAuthenticatorFactory } from './IAuthenticatorFactory.js';
import { MintTransactionData } from './transaction/MintTransactionData.js';
import { TransactionData } from './transaction/TransactionData.js';

export interface ISourceState {
  readonly hash: Uint8Array;
  readonly hashAlgorithm: HashAlgorithm;
}

export class AuthenticatorFactory implements IAuthenticatorFactory {
  public async create(
    signingService: ISigningService,
    transactionData: TransactionData | MintTransactionData,
    sourceState: ISourceState,
  ): Promise<Authenticator> {
    return new Authenticator(
      sourceState.hashAlgorithm,
      signingService.publicKey,
      signingService.algorithm,
      await signingService.sign(transactionData.hash),
      sourceState.hash,
    );
  }
}
