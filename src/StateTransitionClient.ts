import { InclusionProof, InclusionProofVerificationStatus } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { IAddress } from './address/IAddress.js';
import { OneTimeAddress } from './address/OneTimeAddress.js';
import { IAggregatorClient } from './api/IAggregatorClient.js';
import { IAuthenticatorFactory } from './IAuthenticatorFactory.js';
import { IPredicateFactory } from './predicate/IPredicateFactory.js';
import { OneTimeAddressPredicate } from './predicate/OneTimeAddressPredicate.js';
import { ITokenDto, Token } from './token/Token.js';
import { TokenId } from './token/TokenId.js';
import { TokenState } from './token/TokenState.js';
import { TokenType } from './token/TokenType.js';
import { MintTransactionData } from './transaction/MintTransactionData.js';
import { ITransactionDto, Transaction } from './transaction/Transaction.js';
import { TransactionData } from './transaction/TransactionData.js';
import { DataHash } from '../../shared/src/hash/DataHash.js';

// TOKENID string SHA-256 hash
const MINT_SUFFIX = HexConverter.decode('9e82002c144d7c5796c50f6db50a0c7bbd7f717ae3af6c6c71a3e9eba3022730');
// I_AM_UNIVERSAL_MINTER_FOR_ string bytes
const MINTER_SECRET = HexConverter.decode('495f414d5f554e4956455253414c5f4d494e5445525f464f525f');

export class StateTransitionClient {
  public constructor(
    private readonly client: IAggregatorClient,
    private readonly authenticatorFactory: IAuthenticatorFactory,
  ) {}

  private static async isStateDataInTransaction(
    transaction: Transaction<TransactionData | MintTransactionData>,
    state: TokenState,
  ): Promise<boolean> {
    if (transaction.data.dataHash) {
      if (!state.data) {
        return false;
      }

      const dataHash = await new DataHasher(transaction.data.dataHash.algorithm).update(state.data).digest();

      return dataHash.equals(transaction.data.dataHash);
    }

    return !state.data;
  }

  public async mint(
    tokenId: TokenId,
    tokenType: TokenType,
    tokenData: Uint8Array,
    data: Uint8Array | null,
    secret: Uint8Array,
    nonce: Uint8Array,
    salt: Uint8Array,
  ): Promise<Token> {
    const recipient = await OneTimeAddress.create(tokenType, secret, nonce, HashAlgorithm.SHA256);

    const sourceState = await RequestId.createFromImprint(tokenId.encode(), MINT_SUFFIX);
    const signingService = await SigningService.createFromSecret(MINTER_SECRET, tokenId.encode());

    const requestId = await RequestId.create(signingService.publicKey, sourceState.hash);

    const transactionData = await MintTransactionData.create(
      tokenId,
      tokenType,
      tokenData,
      sourceState,
      recipient,
      salt,
      data ? await new DataHasher(HashAlgorithm.SHA256).update(data).digest() : null,
    );

    await this.client.submitTransaction(
      requestId,
      transactionData.hash,
      await this.authenticatorFactory.create(signingService, transactionData, sourceState),
    );
    // TODO: Inclusion proof with submit transaction
    const inclusionProof = await this.client.getInclusionProof(requestId);

    const status = await inclusionProof.verify(requestId.toBigInt());
    if (status != InclusionProofVerificationStatus.OK) {
      throw new Error('Inclusion proof verification failed.');
    }

    const hashAlgorithm = HashAlgorithm[inclusionProof.authenticator.stateHash.algorithm];
    if (!hashAlgorithm) {
      throw new Error('Invalid inclusion proof hash algorithm.');
    }

    const expectedRecipient = await OneTimeAddress.createFromPublicKey(
      tokenType,
      inclusionProof.authenticator.algorithm,
      HashAlgorithm.SHA256,
      inclusionProof.authenticator.publicKey,
      nonce,
    );

    if (!expectedRecipient.equals(recipient)) {
      throw new Error('Recipient mismatch');
    }

    if (!inclusionProof.transactionHash.equals(transactionData.hash)) {
      throw new Error('Payload hash mismatch');
    }

    const state = await TokenState.create(
      await OneTimeAddressPredicate.create(tokenId, tokenType, recipient, signingService, HashAlgorithm.SHA256, nonce),
      data,
    );

    return new Token(tokenId, tokenType, tokenData, state, [new Transaction(transactionData, inclusionProof)], '');
  }
  // TODO: Pass predicate when sending transaction?

  public async createTransaction(
    token: Token,
    recipient: IAddress,
    secret: Uint8Array,
    salt: Uint8Array,
    dataHash: DataHash | null,
    message: Uint8Array | null,
  ): Promise<Transaction<TransactionData>> {
    const signingService = await SigningService.createFromSecret(secret, token.state.unlockPredicate.nonce);
    const transactionData = await TransactionData.create(token.state, recipient, salt, dataHash, message);

    const requestId = await RequestId.create(signingService.publicKey, token.state.hash);
    await this.client.submitTransaction(
      requestId,
      transactionData.hash,
      await this.authenticatorFactory.create(signingService, transactionData, token.state),
    );

    const inclusionProof = await this.client.getInclusionProof(requestId);
    const transaction = new Transaction(transactionData, inclusionProof);

    if (!(await token.state.unlockPredicate.verify(transaction))) {
      throw new Error('Transaction verification failed against unlock predicate');
    }

    return transaction;
  }

  public async finishTransaction(
    token: Token,
    state: TokenState,
    transaction: Transaction<TransactionData>,
  ): Promise<Token> {
    if (!(await transaction.data.sourceState.unlockPredicate.verify(transaction))) {
      throw new Error('Unlock predicate verification failed');
    }

    const transactions: [Transaction<MintTransactionData>, ...Transaction<TransactionData>[]] = [
      ...token.transactions,
      transaction,
    ];

    if (!(await StateTransitionClient.isStateDataInTransaction(transaction, state))) {
      throw new Error('State data is not part of transaction.');
    }

    return new Token(token.id, token.type, token.data, state, transactions, '');
  }

  public async importToken(tokenDto: ITokenDto, predicateFactory: IPredicateFactory): Promise<Token> {
    const tokenId = TokenId.create(HexConverter.decode(tokenDto.id));
    const tokenType = TokenType.create(HexConverter.decode(tokenDto.type));
    const tokenData = HexConverter.decode(tokenDto.data);

    const sourceState = await RequestId.createFromImprint(tokenId.encode(), MINT_SUFFIX);
    const signingService = await SigningService.createFromSecret(MINTER_SECRET, tokenId.encode());

    const mintTransaction = new Transaction(
      await MintTransactionData.create(
        tokenId,
        tokenType,
        tokenData,
        sourceState,
        // TODO: Convert this to address
        tokenDto.transactions[0].data.recipient as unknown as IAddress,
        HexConverter.decode(tokenDto.transactions[0].data.salt),
        tokenDto.transactions[0].data.dataHash ? DataHash.fromDto(tokenDto.transactions[0].data.dataHash) : null,
      ),
      InclusionProof.fromDto(tokenDto.transactions[0].inclusionProof),
    );

    const mintRequestId = await RequestId.create(signingService.publicKey, sourceState.hash);
    if (!(await mintTransaction.inclusionProof.verify(mintRequestId.toBigInt()))) {
      throw new Error('Mint inclusion proof verification failed.');
    }

    const transactions: [Transaction<MintTransactionData>, ...Transaction<TransactionData>[]] = [mintTransaction];

    let previousTransaction: Transaction<MintTransactionData | TransactionData> = mintTransaction;
    for (let i = 1; i < tokenDto.transactions.length; i++) {
      const { data, inclusionProof } = tokenDto.transactions[i] as ITransactionDto<TransactionData>;
      const recipient = data.recipient as unknown as IAddress;
      const transaction = new Transaction(
        await TransactionData.create(
          await TokenState.create(
            await predicateFactory.create(
              tokenId,
              tokenType,
              previousTransaction.data.recipient,
              data.sourceState.unlockPredicate,
            ),
            data.sourceState.data ? HexConverter.decode(data.sourceState.data) : null,
          ),
          recipient,
          HexConverter.decode(data.salt),
          data.dataHash ? DataHash.fromDto(data.dataHash) : null,
          data.message ? HexConverter.decode(data.message) : null,
        ),
        InclusionProof.fromDto(inclusionProof),
      );

      if (!(await StateTransitionClient.isStateDataInTransaction(previousTransaction, transaction.data.sourceState))) {
        throw new Error('State data is not part of transaction.');
      }

      if (!(await transaction.data.sourceState.unlockPredicate.verify(transaction))) {
        throw new Error('Predicate verification failed');
      }

      transactions.push(transaction);
      previousTransaction = transaction;
    }

    const state = await TokenState.create(
      await predicateFactory.create(
        tokenId,
        tokenType,
        previousTransaction.data.recipient,
        tokenDto.state.unlockPredicate,
      ),
      tokenDto.state.data ? HexConverter.decode(tokenDto.state.data) : null,
    );

    if (!(await StateTransitionClient.isStateDataInTransaction(previousTransaction, state))) {
      throw new Error('State data is not part of transaction.');
    }

    return new Token(tokenId, tokenType, tokenData, state, transactions, '');
  }
}
