import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { DataHash } from '@unicitylabs/commons/lib/hash/DataHash.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { DirectAddress } from '../address/DirectAddress.js';
import { ISerializable } from '../ISerializable.js';
import { MINT_SUFFIX, MINTER_SECRET } from '../StateTransitionClient.js';
import { ITokenDto, Token } from './Token.js';
import { TokenId } from './TokenId.js';
import { TokenState } from './TokenState.js';
import { TokenType } from './TokenType.js';
import { IPredicateFactory } from '../predicate/IPredicateFactory.js';
import { IMintTransactionDataDto, MintTransactionData } from '../transaction/MintTransactionData.js';
import { ITransactionDto, Transaction } from '../transaction/Transaction.js';
import { ITransactionDataDto, TransactionData } from '../transaction/TransactionData.js';

export abstract class TokenFactory<TD extends ISerializable> {
  public constructor(private readonly predicateFactory: IPredicateFactory) {}

  public async create(data: ITokenDto): Promise<Token<TD, MintTransactionData<ISerializable | null>>> {
    const tokenId = TokenId.create(HexConverter.decode(data.id));
    const tokenType = TokenType.create(HexConverter.decode(data.type));
    const tokenData = await this.createData(HexConverter.decode(data.data));

    const mintTransaction = await this.createMintTransaction(tokenId, tokenType, tokenData, data.transactions[0]);

    const signingService = await SigningService.createFromSecret(MINTER_SECRET, tokenId.encode());

    const requestId = await RequestId.create(signingService.publicKey, mintTransaction.data.sourceState.hash);
    if (!(await mintTransaction.inclusionProof.verify(requestId.toBigInt()))) {
      throw new Error('Mint inclusion proof verification failed.');
    }

    const transactions: [Transaction<MintTransactionData<ISerializable | null>>, ...Transaction<TransactionData>[]] = [
      mintTransaction,
    ];
    let previousTransaction: Transaction<MintTransactionData<ISerializable | null> | TransactionData> = mintTransaction;
    for (let i = 1; i < data.transactions.length; i++) {
      const transaction = await this.createTransaction(
        tokenId,
        tokenType,
        data.transactions[i] as ITransactionDto<ITransactionDataDto>,
      );

      // TODO: Move address processing to a separate method
      const expectedRecipient = await DirectAddress.create(
        transaction.data.sourceState.unlockPredicate.reference.imprint,
      );
      if (expectedRecipient.toDto() !== previousTransaction.data.recipient) {
        throw new Error('Recipient address mismatch');
      }

      if (!(await previousTransaction.containsData(transaction.data.sourceState.data))) {
        throw new Error('State data is not part of transaction.');
      }

      if (!(await transaction.data.sourceState.unlockPredicate.verify(transaction))) {
        throw new Error('Predicate verification failed');
      }

      transactions.push(transaction);
      previousTransaction = transaction;
    }

    const state = await TokenState.create(
      await this.predicateFactory.create(tokenId, tokenType, data.state.unlockPredicate),
      data.state.data ? HexConverter.decode(data.state.data) : null,
    );

    if (!(await previousTransaction.containsData(state.data))) {
      throw new Error('State data is not part of transaction.');
    }

    const expectedRecipient = await DirectAddress.create(state.unlockPredicate.reference.imprint);
    if (expectedRecipient.toDto() !== previousTransaction.data.recipient) {
      throw new Error('Recipient address mismatch');
    }

    return new Token(tokenId, tokenType, tokenData, state, transactions);
  }

  public async createMintTransaction(
    tokenId: TokenId,
    tokenType: TokenType,
    tokenData: TD,
    transaction: ITransactionDto<IMintTransactionDataDto>,
  ): Promise<Transaction<MintTransactionData<ISerializable | null>>> {
    return new Transaction(
      await MintTransactionData.create(
        tokenId,
        tokenType,
        tokenData,
        await RequestId.createFromImprint(tokenId.encode(), MINT_SUFFIX),
        transaction.data.recipient,
        HexConverter.decode(transaction.data.salt),
        transaction.data.dataHash ? DataHash.fromDto(transaction.data.dataHash) : null,
        // TODO: Parse reason properly
        transaction.data.reason ? await this.createMintReason(HexConverter.decode(transaction.data.reason)) : null,
      ),
      InclusionProof.fromDto(transaction.inclusionProof),
    );
  }

  private async createTransaction(
    tokenId: TokenId,
    tokenType: TokenType,
    { data, inclusionProof }: ITransactionDto<ITransactionDataDto>,
  ): Promise<Transaction<TransactionData>> {
    return new Transaction(
      await TransactionData.create(
        await TokenState.create(
          await this.predicateFactory.create(tokenId, tokenType, data.sourceState.unlockPredicate),
          data.sourceState.data ? HexConverter.decode(data.sourceState.data) : null,
        ),
        data.recipient,
        HexConverter.decode(data.salt),
        data.dataHash ? DataHash.fromDto(data.dataHash) : null,
        data.message ? HexConverter.decode(data.message) : null,
        [], //await Promise.all(data.nameTags.map((input) => this.importToken(input, NameTagTokenData, predicateFactory))),
      ),
      InclusionProof.fromDto(inclusionProof),
    );
  }

  protected abstract createData(data: Uint8Array): Promise<TD>;

  protected abstract createMintReason(data: Uint8Array): Promise<ISerializable | null>;
}
