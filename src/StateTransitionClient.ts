import { Authenticator } from '@unicitylabs/commons/lib/api/Authenticator.js';
import { InclusionProof, InclusionProofVerificationStatus } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { DataHash } from '@unicitylabs/commons/lib/hash/DataHash.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { DirectAddress } from './address/DirectAddress.js';
import { IAddress } from './address/IAddress.js';
import { IAggregatorClient } from './api/IAggregatorClient.js';
import { SubmitCommitmentStatus } from './api/SubmitCommitmentResponse.js';
import { Commitment } from './Commitment.js';
import { IPredicateFactory } from './predicate/IPredicateFactory.js';
import { ITokenDto, Token } from './token/Token.js';
import { TokenId } from './token/TokenId.js';
import { TokenState } from './token/TokenState.js';
import { TokenType } from './token/TokenType.js';
import { MintTransactionData } from './transaction/MintTransactionData.js';
import { ITransactionDto, Transaction } from './transaction/Transaction.js';
import { TransactionData } from './transaction/TransactionData.js';

// TOKENID string SHA-256 hash
const MINT_SUFFIX = HexConverter.decode('9e82002c144d7c5796c50f6db50a0c7bbd7f717ae3af6c6c71a3e9eba3022730');
// I_AM_UNIVERSAL_MINTER_FOR_ string bytes
const MINTER_SECRET = HexConverter.decode('495f414d5f554e4956455253414c5f4d494e5445525f464f525f');

export class StateTransitionClient {
  public constructor(private readonly client: IAggregatorClient) {}

  public static async importToken(tokenDto: ITokenDto, predicateFactory: IPredicateFactory): Promise<Token> {
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
        tokenDto.transactions[0].data.recipient,
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
      const transaction = new Transaction(
        await TransactionData.create(
          await TokenState.create(
            await predicateFactory.create(tokenId, tokenType, data.sourceState.unlockPredicate),
            data.sourceState.data ? HexConverter.decode(data.sourceState.data) : null,
          ),
          data.recipient,
          HexConverter.decode(data.salt),
          data.dataHash ? DataHash.fromDto(data.dataHash) : null,
          data.message ? HexConverter.decode(data.message) : null,
          await Promise.all(data.nameTags.map((input) => this.importToken(input, predicateFactory))),
        ),
        InclusionProof.fromDto(inclusionProof),
      );

      // TODO: Move address processing to a separate method
      const expectedRecipient = await DirectAddress.create(
        transaction.data.sourceState.unlockPredicate.reference.imprint,
      );
      if (expectedRecipient.toDto() !== previousTransaction.data.recipient) {
        throw new Error('Recipient address mismatch');
      }

      if (!(await StateTransitionClient.isStateDataInTransaction(previousTransaction, transaction.data.sourceState))) {
        throw new Error('State data is not part of transaction.');
      }

      if (!(await transaction.data.sourceState.unlockPredicate.verify(previousTransaction))) {
        throw new Error('Predicate verification failed');
      }

      transactions.push(transaction);
      previousTransaction = transaction;
    }

    const state = await TokenState.create(
      await predicateFactory.create(tokenId, tokenType, tokenDto.state.unlockPredicate),
      tokenDto.state.data ? HexConverter.decode(tokenDto.state.data) : null,
    );

    if (!(await StateTransitionClient.isStateDataInTransaction(previousTransaction, state))) {
      throw new Error('State data is not part of transaction.');
    }

    if (!(await state.unlockPredicate.verify(previousTransaction))) {
      throw new Error('Predicate verification failed');
    }

    return new Token(tokenId, tokenType, tokenData, state, transactions);
  }

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

  public async submitMintTransaction(
    recipient: IAddress,
    tokenId: TokenId,
    tokenType: TokenType,
    tokenData: Uint8Array,
    data: Uint8Array | null,
    salt: Uint8Array,
  ): Promise<Commitment<MintTransactionData>> {
    const sourceState = await RequestId.createFromImprint(tokenId.encode(), MINT_SUFFIX);
    const signingService = await SigningService.createFromSecret(MINTER_SECRET, tokenId.encode());

    const requestId = await RequestId.create(signingService.publicKey, sourceState.hash);

    const transactionData = await MintTransactionData.create(
      tokenId,
      tokenType,
      tokenData,
      sourceState,
      recipient.toDto(),
      salt,
      data ? await new DataHasher(HashAlgorithm.SHA256).update(data).digest() : null,
    );

    const authenticator = await Authenticator.create(signingService, transactionData.hash, sourceState.hash);

    const result = await this.client.submitTransaction(requestId, transactionData.hash, authenticator);

    if (result.status !== SubmitCommitmentStatus.SUCCESS) {
      throw new Error(`Could not submit transaction: ${result.status}`);
    }

    return new Commitment(requestId, transactionData, authenticator);
  }

  public async submitTransaction(
    transactionData: TransactionData,
    signingService: SigningService,
  ): Promise<Commitment<TransactionData>> {
    // TODO: Unlock token before submitting, tho user can do themselves.

    const requestId = await RequestId.create(signingService.publicKey, transactionData.sourceState.hash);

    const authenticator = await Authenticator.create(
      signingService,
      transactionData.hash,
      transactionData.sourceState.hash,
    );
    const result = await this.client.submitTransaction(requestId, transactionData.hash, authenticator);

    if (result.status !== SubmitCommitmentStatus.SUCCESS) {
      throw new Error(`Could not submit transaction: ${result.status}`);
    }

    return new Commitment(requestId, transactionData, authenticator);
  }

  public async createTransaction<T extends TransactionData | MintTransactionData>(
    { requestId, transactionData }: Commitment<T>,
    inclusionProof: InclusionProof,
  ): Promise<Transaction<T>> {
    const status = await inclusionProof.verify(requestId.toBigInt());
    if (status != InclusionProofVerificationStatus.OK) {
      throw new Error('Inclusion proof verification failed.');
    }

    const hashAlgorithm = HashAlgorithm[inclusionProof.authenticator.stateHash.algorithm];
    if (!hashAlgorithm) {
      throw new Error('Invalid inclusion proof hash algorithm.');
    }

    if (!inclusionProof.transactionHash.equals(transactionData.hash)) {
      throw new Error('Payload hash mismatch');
    }

    return new Transaction(transactionData, inclusionProof);
  }

  public async finishTransaction(
    token: Token,
    state: TokenState,
    transaction: Transaction<TransactionData>,
    nametagTokens: Token[] = [],
  ): Promise<Token> {
    if (!(await state.unlockPredicate.verify(transaction))) {
      throw new Error('Unlock predicate verification failed');
    }

    // TODO: Move address processing to a separate method
    // TODO: Resolve proxy address
    const expectedAddress = await DirectAddress.create(state.unlockPredicate.reference.imprint);
    if (expectedAddress.toDto() !== transaction.data.recipient) {
      throw new Error('Recipient address mismatch');
    }

    const transactions: [Transaction<MintTransactionData>, ...Transaction<TransactionData>[]] = [
      ...token.transactions,
      transaction,
    ];

    if (!(await StateTransitionClient.isStateDataInTransaction(transaction, state))) {
      throw new Error('State data is not part of transaction.');
    }

    return new Token(token.id, token.type, token.data, state, transactions, nametagTokens);
  }

  public async getTokenStatus(token: Token, publicKey: Uint8Array): Promise<InclusionProofVerificationStatus> {
    const requestId = await RequestId.create(publicKey, token.state.hash);
    const inclusionProof = await this.client.getInclusionProof(requestId);
    // TODO: Check ownership?
    return inclusionProof.verify(requestId.toBigInt());
  }

  public getInclusionProof(commitment: Commitment<TransactionData | MintTransactionData>): Promise<InclusionProof> {
    return this.client.getInclusionProof(commitment.requestId);
  }
}
