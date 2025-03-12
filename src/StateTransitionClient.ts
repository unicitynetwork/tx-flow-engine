import { Authenticator } from '@unicitylabs/commons/lib/api/Authenticator.js';
import { InclusionProofVerificationStatus } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { ISigningService } from '@unicitylabs/commons/lib/signing/ISigningService.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { Pointer } from './address/Pointer.js';
import { AggregatorClient } from './api/AggregatorClient.js';
import { PublicKeyPredicate } from './predicate/PublicKeyPredicate.js';
import { Token } from './token/Token.js';
import { TokenId } from './token/TokenId.js';
import { TokenState } from './token/TokenState.js';
import { TokenType } from './token/TokenType.js';
import { MintTransaction, MintTransactionData } from './transaction/MintTransaction.js';
import { Transaction } from './transaction/Transaction.js';

// TOKENID string SHA-256 hash
const MINT_SUFFIX = HexConverter.decode('9e82002c144d7c5796c50f6db50a0c7bbd7f717ae3af6c6c71a3e9eba3022730');

interface ISourceState {
  readonly hash: Uint8Array;
  readonly hashAlgorithm: string;
}

export class StateTransitionClient {
  private readonly client: AggregatorClient;

  public constructor(url: string) {
    this.client = new AggregatorClient(url);
  }

  public async mint(
    tokenId: TokenId,
    tokenType: TokenType,
    tokenData: Uint8Array,
    stateData: Uint8Array,
    secret: Uint8Array,
    nonce: Uint8Array,
    salt: Uint8Array,
  ): Promise<Token> {
    const signingService = await SigningService.createFromSecret(secret, nonce);
    const recipient = await Pointer.create(tokenType, secret, nonce);

    const sourceState = await RequestId.create(tokenId.encode(), MINT_SUFFIX);
    const requestId = await RequestId.create(signingService.publicKey, sourceState.hash);

    const transaction = new MintTransaction(
      requestId,
      await MintTransactionData.create(tokenId, tokenType, tokenData, recipient, salt, stateData),
    );

    await this.client.submitTransaction(
      requestId,
      transaction.hash,
      await StateTransitionClient.createAuthenticator(signingService, transaction, sourceState),
    );
    const inclusionProof = await this.client.getInclusionProof(requestId);

    const status = await inclusionProof.verify(requestId.toBigInt());
    if (status != InclusionProofVerificationStatus.OK) {
      throw new Error('Inclusion proof verification failed.');
    }

    const state = await TokenState.create(
      await PublicKeyPredicate.create(tokenId, tokenType, signingService, nonce),
      null,
      stateData,
    );
    const expectedRecipient = await Pointer.createFromPublicKey(
      tokenType,
      signingService.algorithm,
      signingService.hashAlgorithm,
      signingService.publicKey,
      nonce,
    );

    if (!expectedRecipient.equals(recipient)) {
      throw new Error('Recipient mismatch');
    }

    if (HexConverter.encode(inclusionProof.payload) !== HexConverter.encode(transaction.hash)) {
      throw new Error('Payload hash mismatch');
    }

    return new Token(tokenId, tokenType, tokenData, inclusionProof, recipient, salt, state, [transaction], '');
  }

  public async importToken(data: unknown): Promise<Token | void> {}

  // TODO: Which hash algorithm is used here, source state or transaction
  private static async createAuthenticator(
    signingService: ISigningService,
    transaction: Transaction | MintTransaction,
    sourceState: ISourceState,
  ): Promise<Authenticator> {
    return new Authenticator(
      transaction.hashAlgorithm,
      signingService.publicKey,
      signingService.algorithm,
      await signingService.sign(transaction.hash),
      sourceState.hash,
    );
  }
}
