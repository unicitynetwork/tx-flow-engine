import { Authenticator } from '@unicitylabs/commons/lib/api/Authenticator.js';
import { InclusionProof, InclusionProofVerificationStatus } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { ISigningService } from '@unicitylabs/commons/lib/signing/ISigningService.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { IAddress } from './address/IAddress.js';
import { OneTimeAddress } from './address/OneTimeAddress.js';
import { AggregatorClient } from './api/AggregatorClient.js';
import { OneTimeAddressPredicate } from './predicate/OneTimeAddressPredicate.js';
import { IPredicateFactory, ITokenDto, Token } from './token/Token.js';
import { TokenId } from './token/TokenId.js';
import { TokenState } from './token/TokenState.js';
import { TokenType } from './token/TokenType.js';
import { ITransactionDto, Transaction } from './transaction/Transaction.js';
import { TransactionData } from './transaction/TransactionData.js';
import { MintTransactionData } from './transaction/MintTransactionData.js';

// TOKENID string SHA-256 hash
const MINT_SUFFIX = HexConverter.decode('9e82002c144d7c5796c50f6db50a0c7bbd7f717ae3af6c6c71a3e9eba3022730');
// I_AM_UNIVERSAL_MINTER_FOR_ string bytes
const MINTER_SECRET = HexConverter.decode('495f414d5f554e4956455253414c5f4d494e5445525f464f525f');

interface ISourceState {
  readonly hash: Uint8Array;
  readonly hashAlgorithm: HashAlgorithm;
}

//

export class StateTransitionClient {
  private readonly client: AggregatorClient;

  public constructor(url: string) {
    this.client = new AggregatorClient(url);
  }

  private static async createAuthenticator(
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

  public async mint(
    tokenId: TokenId,
    tokenType: TokenType,
    tokenData: Uint8Array,
    data: Uint8Array,
    secret: Uint8Array,
    nonce: Uint8Array,
    salt: Uint8Array,
  ): Promise<Token> {
    // TODO: HashAlgorithm should be variable
    const recipient = await OneTimeAddress.create(tokenType, secret, nonce, HashAlgorithm.SHA256);

    const sourceState = await RequestId.create(tokenId.encode(), MINT_SUFFIX);
    const signingService = new SigningService(
      await new DataHasher(HashAlgorithm.SHA256).update(MINTER_SECRET).update(tokenId.encode()).digest(),
    );

    const requestId = await RequestId.create(signingService.publicKey, sourceState.hash);

    const transactionData = await MintTransactionData.create(tokenId, tokenType, tokenData, recipient, salt, data);

    // TODO: Depending on address, we get authenticator type and predicate type
    await this.client.submitTransaction(
      requestId,
      transactionData.hash,
      await StateTransitionClient.createAuthenticator(signingService, transactionData, sourceState),
    );
    // TODO: Inclusion proof with submit transaction
    const inclusionProof = await this.client.getInclusionProof(requestId);

    const status = await inclusionProof.verify(requestId.toBigInt());
    if (status != InclusionProofVerificationStatus.OK) {
      throw new Error('Inclusion proof verification failed.');
    }

    if (!HashAlgorithm[inclusionProof.authenticator.hashAlgorithm]) {
      throw new Error('Invalid inclusion proof hash algorithm.');
    }

    const expectedRecipient = await OneTimeAddress.createFromPublicKey(
      tokenType,
      inclusionProof.authenticator.algorithm,
      inclusionProof.authenticator.hashAlgorithm,
      inclusionProof.authenticator.publicKey,
      nonce,
    );

    if (!expectedRecipient.equals(recipient)) {
      throw new Error('Recipient mismatch');
    }

    if (HexConverter.encode(inclusionProof.payload) !== HexConverter.encode(transactionData.hash)) {
      throw new Error('Payload hash mismatch');
    }

    const state = await TokenState.create(
      await OneTimeAddressPredicate.create(
        tokenId,
        tokenType,
        recipient,
        await SigningService.createFromSecret(secret, nonce),
        HashAlgorithm.SHA256,
        nonce,
      ),
      data,
    );

    return new Token(tokenId, tokenType, tokenData, inclusionProof, recipient, salt, state, [new Transaction(transactionData, inclusionProof)], '');
  }

  public async createTransaction(
    token: Token,
    recipient: IAddress,
    secret: Uint8Array,
    salt: Uint8Array,
    data: Uint8Array,
    message: string,
  ): Promise<Transaction<TransactionData>> {
    const transactionData = await TransactionData.create(token.state, recipient, salt, data, message);
    const signingService = await token.state.generateSigningService(secret);

    const requestId = await RequestId.create(signingService.publicKey, token.state.hash);
    await this.client.submitTransaction(
      requestId,
      transactionData.hash,
      await StateTransitionClient.createAuthenticator(signingService, transactionData, token.state),
    );

    const inclusionProof = await this.client.getInclusionProof(requestId);
    const transaction = new Transaction(transactionData, inclusionProof);

    if (!(await token.state.verify(transaction))) {
      throw new Error('Transaction verification failed against unlock predicate');
    }

    return transaction;
  }

  // TokenState inside transaction will verify previous transaction

  public async importToken(data: ITokenDto, predicateFactory: IPredicateFactory): Promise<Token> {
    const tokenId = TokenId.create(HexConverter.decode(data.id));
    const tokenType = TokenType.create(HexConverter.decode(data.type));
    const tokenData = HexConverter.decode(data.data);

    const transactions: [Transaction<MintTransactionData>, ...Transaction<TransactionData>[]] = [
      new Transaction(
        await MintTransactionData.create(
          tokenId,
          tokenType,
          tokenData,
          data.transactions[0].data.recipient as unknown as IAddress,
          HexConverter.decode(data.transactions[0].data.salt),
          data.transactions[0].data.data ? HexConverter.decode(data.transactions[0].data.data) : null,
        ),
        InclusionProof.fromDto(data.transactions[0].inclusionProof)
      ),
    ];

    for (let i = 1; i < data.transactions.length; i++) {
      const { data: transactionData, inclusionProof } = data.transactions[i] as ITransactionDto<TransactionData>;
      const transaction = new Transaction(
        await TransactionData.create(
          await TokenState.create(
            await predicateFactory.create(transactionData.sourceState.unlockPredicate),
            HexConverter.decode(transactionData.sourceState.data),
          ),
          transactionData.recipient as unknown as IAddress,
          HexConverter.decode(transactionData.salt),
          transactionData.data ? HexConverter.decode(transactionData.data) : null,
          transactionData.message ?? null,
        ),
        InclusionProof.fromDto(inclusionProof),
      );

      const previousTransaction = transactions.at(-1) as Transaction<MintTransactionData | TransactionData>;
      const signatureVerification = ;
  
      if (!signatureVerification) {
        throw new Error('Signature verification failed');
      }

      

      if (!transaction.data.sourceState.verify(transaction)) {
        throw new Error('Predicate verification failed');
      }

      transactions.push(transaction);
    }

    const previousTransaction = transactions.at(-1) as Transaction<TransactionData | MintTransactionData>;
    const inclusionProof = InclusionProof.fromDto(data.inclusionProof);

    const signatureVerification = ;

    if (!signatureVerification) {
      throw new Error('Signature verification failed');
    }

    // TODO: Prove that ive reached the latest state

    return new Token(
      tokenId,
      tokenType,
      tokenData,
      inclusionProof,
      data.recipient as unknown as IAddress,
      HexConverter.decode(data.salt),
      await TokenState.create(
        await predicateFactory.create(data.state.unlockPredicate),
        HexConverter.decode(data.state.data),
      ),
      transactions,
      '',
    );
  }
}
