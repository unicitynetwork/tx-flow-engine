import { InclusionProofVerificationStatus } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { ISigningService } from '@unicitylabs/commons/lib/signing/ISigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { IPredicate } from './IPredicate.js';
import { PredicateType } from './PredicateType.js';
import { DataHash } from '../../../shared/src/hash/DataHash.js';
import { TokenId } from '../token/TokenId.js';
import { TokenType } from '../token/TokenType.js';
import { MintTransactionData } from '../transaction/MintTransactionData.js';
import { Transaction } from '../transaction/Transaction.js';
import { TransactionData } from '../transaction/TransactionData.js';

interface IPredicateDto {
  readonly type: PredicateType.ONE_TIME_ADDRESS;
  readonly publicKey: string;
  readonly algorithm: string;
  readonly hashAlgorithm: HashAlgorithm;
  readonly nonce: string;
}

const textEncoder = new TextEncoder();

export class OneTimeAddressPredicate implements IPredicate {
  private static readonly TYPE = PredicateType.ONE_TIME_ADDRESS;

  private constructor(
    private readonly publicKey: Uint8Array,
    private readonly algorithm: string,
    private readonly hashAlgorithm: HashAlgorithm,
    private readonly _nonce: Uint8Array,
    public readonly hash: DataHash,
  ) {
    this.publicKey = new Uint8Array(publicKey);
    this._nonce = new Uint8Array(_nonce);
  }

  public get nonce(): Uint8Array {
    return this._nonce;
  }

  public static async createFromPublicKey(
    tokenId: TokenId,
    tokenType: TokenType,
    recipient: string,
    algorithm: string,
    publicKey: Uint8Array,
    hashAlgorithm: HashAlgorithm,
    nonce: Uint8Array,
  ): Promise<OneTimeAddressPredicate> {
    const algorithmHash = await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode(algorithm)).digest();
    const hashAlgorithmHash = await new DataHasher(HashAlgorithm.SHA256)
      .update(new Uint8Array([hashAlgorithm & 0xff00, hashAlgorithm & 0xff]))
      .digest();

    const hash = await new DataHasher(hashAlgorithm)
      .update(textEncoder.encode(OneTimeAddressPredicate.TYPE))
      .update(tokenId.encode())
      .update(tokenType.encode())
      .update(textEncoder.encode(recipient))
      .update(algorithmHash.imprint)
      .update(hashAlgorithmHash.imprint)
      .update(publicKey)
      .update(nonce)
      .digest();

    return new OneTimeAddressPredicate(publicKey, algorithm, hashAlgorithm, nonce, hash);
  }

  public static create(
    tokenId: TokenId,
    tokenType: TokenType,
    recipient: string,
    signingService: ISigningService,
    hashAlgorithm: HashAlgorithm,
    nonce: Uint8Array,
  ): Promise<OneTimeAddressPredicate> {
    return OneTimeAddressPredicate.createFromPublicKey(
      tokenId,
      tokenType,
      recipient,
      signingService.algorithm,
      signingService.publicKey,
      hashAlgorithm,
      nonce,
    );
  }

  public static isDto(data: unknown): data is IPredicateDto {
    return (
      data instanceof Object &&
      'publicKey' in data &&
      typeof data.publicKey === 'string' &&
      'algorithm' in data &&
      typeof data.algorithm === 'string' &&
      'hashAlgorithm' in data &&
      !!HashAlgorithm[data.hashAlgorithm as keyof typeof HashAlgorithm] &&
      'nonce' in data &&
      typeof data.nonce === 'string'
    );
  }

  public static fromDto(
    tokenId: TokenId,
    tokenType: TokenType,
    recipient: string,
    data: unknown,
  ): Promise<OneTimeAddressPredicate> {
    if (!OneTimeAddressPredicate.isDto(data)) {
      throw new Error('Invalid one time address predicate dto');
    }

    return OneTimeAddressPredicate.createFromPublicKey(
      tokenId,
      tokenType,
      recipient,
      data.algorithm,
      HexConverter.decode(data.publicKey),
      data.hashAlgorithm,
      HexConverter.decode(data.nonce),
    );
  }

  public toDto(): IPredicateDto {
    return {
      algorithm: this.algorithm,
      hashAlgorithm: this.hashAlgorithm,
      nonce: HexConverter.encode(this.nonce),
      publicKey: HexConverter.encode(this.publicKey),
      type: OneTimeAddressPredicate.TYPE,
    };
  }

  public async verify(transaction: Transaction<TransactionData | MintTransactionData>): Promise<boolean> {
    // Verify if input state and public key are correct.
    if (
      HexConverter.encode(transaction.inclusionProof.authenticator.publicKey) !== HexConverter.encode(this.publicKey) ||
      transaction.inclusionProof.authenticator.stateHash.equals(transaction.data.sourceState.hash)
    ) {
      return false; // input mismatch
    }

    // Verify if transaction data is valid.
    if (!transaction.inclusionProof.authenticator.verify(transaction.data.hash)) {
      return false;
    }

    // Verify inclusion proof path.
    const requestId = await RequestId.create(this.publicKey, transaction.data.sourceState.hash);
    const status = await transaction.inclusionProof.verify(requestId.toBigInt());
    return status === InclusionProofVerificationStatus.OK;
  }

  public toString(): string {
    return dedent`
          PublicKeyPredicate
            PublicKey: ${HexConverter.encode(this.publicKey)}
            Algorithm: ${this.algorithm}
            Hash Algorithm: ${HashAlgorithm[this.hashAlgorithm]}
            Nonce: ${HexConverter.encode(this.nonce)}
            Hash: ${this.hash.toString()}
        `;
  }
}
