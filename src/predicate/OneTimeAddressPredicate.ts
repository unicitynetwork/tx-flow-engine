import { InclusionProofVerificationStatus } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { ISigningService } from '@unicitylabs/commons/lib/signing/ISigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { IPredicate } from './IPredicate.js';
import { PredicateType } from './PredicateType.js';
import { IAddress } from '../address/IAddress.js';
import { TokenId } from '../token/TokenId.js';
import { TokenType } from '../token/TokenType.js';
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
    private readonly _hash: Uint8Array
  ) {
    this.publicKey = new Uint8Array(publicKey);
    this._nonce = new Uint8Array(_nonce);
    this._hash = new Uint8Array(_hash);
  }

  public get nonce(): Uint8Array {
    return this._nonce;
  }

  public get hash(): Uint8Array {
    return new Uint8Array(this._hash);
  }

  public static async createFromPublicKey(tokenId: TokenId,
                                          tokenType: TokenType,
                                          recipient: IAddress,
                                          algorithm: string,
                                          publicKey: Uint8Array,
                                          hashAlgorithm: HashAlgorithm,
                                          nonce: Uint8Array): Promise<OneTimeAddressPredicate> {
    const hash = await new DataHasher(hashAlgorithm)
      .update(textEncoder.encode(OneTimeAddressPredicate.TYPE))
      .update(tokenId.encode())
      .update(tokenType.encode())
      .update(recipient.encode())
      .update(await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode(algorithm)).digest())
      .update(await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode(hashAlgorithm)).digest())
      .update(publicKey)
      .update(nonce)
      .digest();

    return new OneTimeAddressPredicate(publicKey, algorithm, hashAlgorithm, nonce, hash);
  }

  public static async create(
    tokenId: TokenId,
    tokenType: TokenType,
    recipient: IAddress,
    signingService: ISigningService,
    hashAlgorithm: HashAlgorithm,
    nonce: Uint8Array
  ): Promise<OneTimeAddressPredicate> {
    return OneTimeAddressPredicate.createFromPublicKey(tokenId, tokenType, recipient, signingService.algorithm, signingService.publicKey, hashAlgorithm, nonce);
  }

  public toDto(): IPredicateDto {
    return {
      algorithm: this.algorithm,
      hashAlgorithm: this.hashAlgorithm,
      nonce: HexConverter.encode(this.nonce),
      publicKey: HexConverter.encode(this.publicKey),
      type: OneTimeAddressPredicate.TYPE
    };
  }

  public async verify(transaction: Transaction<TransactionData>): Promise<boolean> {
    // Verify if input state and public key are correct.
    if (
      HexConverter.encode(transaction.inclusionProof.authenticator.publicKey) !== HexConverter.encode(this.publicKey) ||
      HexConverter.encode(transaction.inclusionProof.authenticator.stateHash) !==
      HexConverter.encode(transaction.data.sourceState.hash)
    ) {
      return false; // input mismatch
    }

    // Verify if transaction data is valid.
    if (!(transaction.inclusionProof.authenticator.verify(transaction.data.hash))) {
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
            Hash: ${HexConverter.encode(this._hash)}
        `;
  }

  public static isDto(data: unknown): data is IPredicateDto {
    return (
      data instanceof Object &&
      'publicKey' in data &&
      typeof data.publicKey === 'string' &&
      'algorithm' in data &&
      typeof data.algorithm === 'string' &&
      'hashAlgorithm' in data &&
      HashAlgorithm[data.hashAlgorithm as keyof typeof HashAlgorithm] &&
      'nonce' in data &&
      typeof data.nonce === 'string'
    );
  }

  public static async fromDto(tokenId: TokenId, tokenType: TokenType, recipient: IAddress, data: unknown): Promise<OneTimeAddressPredicate> {
    if (!OneTimeAddressPredicate.isDto(data)) {
      throw new Error('Invalid one time address predicate dto');
    }

    return OneTimeAddressPredicate.createFromPublicKey(tokenId, tokenType, recipient, data.algorithm, HexConverter.decode(data.publicKey), data.hashAlgorithm, HexConverter.decode(data.nonce));
  }
}




