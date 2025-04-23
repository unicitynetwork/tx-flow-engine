import { InclusionProofVerificationStatus } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { DataHash } from '@unicitylabs/commons/lib/hash/DataHash.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import type { ISignature } from '@unicitylabs/commons/lib/signing/ISignature.js';
import type { ISigningService } from '@unicitylabs/commons/lib/signing/ISigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { IPredicate } from './IPredicate.js';
import { PredicateType } from './PredicateType.js';
import { TokenId } from '../token/TokenId.js';
import { TokenType } from '../token/TokenType.js';
import { MintTransactionData } from '../transaction/MintTransactionData.js';
import { Transaction } from '../transaction/Transaction.js';
import { TransactionData } from '../transaction/TransactionData.js';

interface IPredicateDto {
  readonly type: PredicateType.DEFAULT;
  readonly publicKey: string;
  readonly algorithm: string;
  readonly hashAlgorithm: HashAlgorithm;
  readonly nonce: string;
}

const textEncoder = new TextEncoder();

export class DefaultPredicate implements IPredicate {
  private static readonly TYPE = PredicateType.DEFAULT;

  private constructor(
    private readonly _publicKey: Uint8Array,
    private readonly algorithm: string,
    private readonly hashAlgorithm: HashAlgorithm,
    private readonly _nonce: Uint8Array,
    public readonly hash: DataHash,
  ) {
    this._publicKey = new Uint8Array(_publicKey);
    this._nonce = new Uint8Array(_nonce);
  }

  public get publicKey(): Uint8Array {
    return this._publicKey;
  }

  public get nonce(): Uint8Array {
    return this._nonce;
  }

  public static createMaskedPredicate(
    tokenId: TokenId,
    tokenType: TokenType,
    signingService: ISigningService<ISignature>,
    hashAlgorithm: HashAlgorithm,
    nonce: Uint8Array,
  ): Promise<DefaultPredicate> {
    return DefaultPredicate.createFromPublicKey(
      tokenId,
      tokenType,
      signingService.algorithm,
      signingService.publicKey,
      hashAlgorithm,
      nonce,
    );
  }

  public static async createUnmaskedPredicate(
    tokenId: TokenId,
    tokenType: TokenType,
    signingService: ISigningService<ISignature>,
    hashAlgorithm: HashAlgorithm,
    salt: Uint8Array,
  ): Promise<DefaultPredicate> {
    // TODO: Do we hash salt? Verify signed salt?
    const hash = await new DataHasher(HashAlgorithm.SHA256).update(salt).digest();
    const saltSignature = await signingService.sign(hash.imprint);

    return DefaultPredicate.createFromPublicKey(
      tokenId,
      tokenType,
      signingService.algorithm,
      signingService.publicKey,
      hashAlgorithm,
      saltSignature.bytes,
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

  public static fromDto(tokenId: TokenId, tokenType: TokenType, data: unknown): Promise<DefaultPredicate> {
    if (!DefaultPredicate.isDto(data)) {
      throw new Error('Invalid one time address predicate dto');
    }

    return DefaultPredicate.createFromPublicKey(
      tokenId,
      tokenType,
      data.algorithm,
      HexConverter.decode(data.publicKey),
      data.hashAlgorithm,
      HexConverter.decode(data.nonce),
    );
  }

  private static async createFromPublicKey(
    tokenId: TokenId,
    tokenType: TokenType,
    algorithm: string,
    publicKey: Uint8Array,
    hashAlgorithm: HashAlgorithm,
    nonce: Uint8Array,
  ): Promise<DefaultPredicate> {
    const algorithmHash = await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode(algorithm)).digest();
    const hashAlgorithmHash = await new DataHasher(HashAlgorithm.SHA256)
      .update(new Uint8Array([hashAlgorithm & 0xff00, hashAlgorithm & 0xff]))
      .digest();

    const hash = await new DataHasher(hashAlgorithm)
      .update(textEncoder.encode(DefaultPredicate.TYPE))
      .update(tokenId.encode())
      .update(tokenType.encode())
      .update(algorithmHash.imprint)
      .update(hashAlgorithmHash.imprint)
      .update(publicKey)
      .update(nonce)
      .digest();

    return new DefaultPredicate(publicKey, algorithm, hashAlgorithm, nonce, hash);
  }

  public toDto(): IPredicateDto {
    return {
      algorithm: this.algorithm,
      hashAlgorithm: this.hashAlgorithm,
      nonce: HexConverter.encode(this.nonce),
      publicKey: HexConverter.encode(this.publicKey),
      type: DefaultPredicate.TYPE,
    };
  }

  public async verify(transaction: Transaction<TransactionData | MintTransactionData>): Promise<boolean> {
    // Verify if input state and public key are correct.
    if (
      HexConverter.encode(transaction.inclusionProof.authenticator.publicKey) !== HexConverter.encode(this.publicKey) ||
      !transaction.inclusionProof.authenticator.stateHash.equals(transaction.data.sourceState.hash)
    ) {
      return false; // input mismatch
    }

    // Verify if transaction data is valid.
    if (!(await transaction.inclusionProof.authenticator.verify(transaction.data.hash))) {
      return false;
    }

    // Verify inclusion proof path.
    const requestId = await RequestId.create(this.publicKey, transaction.data.sourceState.hash);
    const status = await transaction.inclusionProof.verify(requestId.toBigInt());
    return status === InclusionProofVerificationStatus.OK;
  }

  public toString(): string {
    return dedent`
          DefaultPredicate
            PublicKey: ${HexConverter.encode(this.publicKey)}
            Algorithm: ${this.algorithm}
            Hash Algorithm: ${HashAlgorithm[this.hashAlgorithm]}
            Nonce: ${HexConverter.encode(this.nonce)}
            Hash: ${this.hash.toString()}`;
  }
}
