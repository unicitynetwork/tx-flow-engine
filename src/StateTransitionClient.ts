import { InclusionProof, InclusionProofVerificationStatus } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { IAddress } from './address/IAddress.js';
import { OneTimeAddress } from './address/OneTimeAddress.js';
import { IAggregatorClient } from './IAggregatorClient.js';
import { IAuthenticatorFactory } from './IAuthenticatorFactory.js';
import { IPredicate } from './predicate/IPredicate.js';
import { IPredicateFactory } from './predicate/IPredicateFactory.js';
import { OneTimeAddressPredicate } from './predicate/OneTimeAddressPredicate.js';
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
  public constructor(
    private readonly client: IAggregatorClient,
    private readonly authenticatorFactory: IAuthenticatorFactory,
  ) {}

  public async mint(
    tokenId: TokenId,
    tokenType: TokenType,
    tokenData: Uint8Array,
    data: Uint8Array,
    secret: Uint8Array,
    nonce: Uint8Array,
    salt: Uint8Array,
    addressHashAlgorithm: HashAlgorithm,
  ): Promise<Token> {
    const recipient = await OneTimeAddress.create(tokenType, secret, nonce, addressHashAlgorithm);

    const sourceState = await RequestId.create(tokenId.encode(), MINT_SUFFIX);
    const signingService = new SigningService(
      await new DataHasher(HashAlgorithm.SHA256).update(MINTER_SECRET).update(tokenId.encode()).digest(),
    );

    const requestId = await RequestId.create(signingService.publicKey, sourceState.hash);

    const transactionData = await MintTransactionData.create(
      tokenId,
      tokenType,
      tokenData,
      sourceState,
      recipient,
      salt,
      data,
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

    const hashAlgorithm = HashAlgorithm[inclusionProof.authenticator.hashAlgorithm as keyof typeof HashAlgorithm];
    if (!hashAlgorithm) {
      throw new Error('Invalid inclusion proof hash algorithm.');
    }

    const expectedRecipient = await OneTimeAddress.createFromPublicKey(
      tokenType,
      inclusionProof.authenticator.algorithm,
      addressHashAlgorithm,
      inclusionProof.authenticator.publicKey,
      nonce,
    );

    if (!expectedRecipient.equals(recipient)) {
      throw new Error('Recipient mismatch');
    }

    if (HexConverter.encode(inclusionProof.transactionHash) !== HexConverter.encode(transactionData.hash)) {
      throw new Error('Payload hash mismatch');
    }

    const state = await TokenState.create(
      await OneTimeAddressPredicate.create(
        tokenId,
        tokenType,
        recipient,
        await SigningService.createFromSecret(secret, nonce),
        addressHashAlgorithm,
        nonce,
      ),
      data,
    );

    return new Token(
      tokenId,
      tokenType,
      tokenData,
      recipient,
      salt,
      state,
      [new Transaction(transactionData, inclusionProof)],
      '',
    );
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
    const signingService = new SigningService(
      await new DataHasher(HashAlgorithm.SHA256).update(secret).update(token.state.unlockPredicate.nonce).digest(),
    );

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
    transaction: Transaction<TransactionData>,
    unlockPredicate: IPredicate,
  ): Promise<Token> {
    if (!(await transaction.data.sourceState.unlockPredicate.verify(transaction))) {
      throw new Error('Unlock predicate verification failed');
    }

    // TODO: Check if token state is current transaction source state

    const transactions: [Transaction<MintTransactionData>, ...Transaction<TransactionData>[]] = [
      ...token.transactions,
      transaction,
    ];

    const state = await TokenState.create(
      unlockPredicate,
      transaction.data.data!, // TODO: This should be a Uint8Array or null
    );

    return new Token(
      token.id,
      token.type,
      token.data,
      transaction.data.recipient,
      transaction.data.salt,
      state,
      transactions,
      '',
    );
  }

  public async importToken(tokenDto: ITokenDto, predicateFactory: IPredicateFactory): Promise<Token> {
    const tokenId = TokenId.create(HexConverter.decode(tokenDto.id));
    const tokenType = TokenType.create(HexConverter.decode(tokenDto.type));
    const tokenData = HexConverter.decode(tokenDto.data);

    const sourceState = await RequestId.create(tokenId.encode(), MINT_SUFFIX);
    const signingService = new SigningService(
      await new DataHasher(HashAlgorithm.SHA256).update(MINTER_SECRET).update(tokenId.encode()).digest(),
    );

    const mintTransaction = new Transaction(
      await MintTransactionData.create(
        tokenId,
        tokenType,
        tokenData,
        sourceState,
        // TODO: Convert this to address
        tokenDto.transactions[0].data.recipient as unknown as IAddress,
        HexConverter.decode(tokenDto.transactions[0].data.salt),
        tokenDto.transactions[0].data.data ? HexConverter.decode(tokenDto.transactions[0].data.data) : null,
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
            previousTransaction.data.data!, // TODO: This should be a Uint8Array or null
          ),
          recipient,
          HexConverter.decode(data.salt),
          data.data ? HexConverter.decode(data.data) : null,
          data.message ?? null,
        ),
        InclusionProof.fromDto(inclusionProof),
      );

      if (!(await transaction.data.sourceState.unlockPredicate.verify(transaction))) {
        throw new Error('Predicate verification failed');
      }

      transactions.push(transaction);
      previousTransaction = transaction;
    }

    // TODO: Fix recipient parsing
    const recipient = tokenDto.recipient as unknown as IAddress;
    if (HexConverter.encode(recipient.encode()) !== HexConverter.encode(previousTransaction.data.recipient.encode())) {
      throw new Error('Invalid token recipient.');
    }

    return new Token(
      tokenId,
      tokenType,
      tokenData,
      recipient,
      HexConverter.decode(tokenDto.salt),
      await TokenState.create(
        await predicateFactory.create(
          tokenId,
          tokenType,
          previousTransaction.data.recipient,
          tokenDto.state.unlockPredicate,
        ),
        previousTransaction.data.data!, // TODO: Should be null or uint8array
      ),
      transactions,
      '',
    );
  }
}
