import { InclusionProofVerificationStatus } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { ISigningService } from '@unicitylabs/commons/lib/signing/ISigningService.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
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
    private readonly nonce: Uint8Array,
    private readonly _hash: Uint8Array,
  ) {
    this.publicKey = new Uint8Array(publicKey);
    this.nonce = new Uint8Array(nonce);
    this._hash = new Uint8Array(_hash);
  }

  public get hash(): Uint8Array {
    return new Uint8Array(this._hash);
  }

  public static async create(
    tokenId: TokenId,
    tokenType: TokenType,
    recipient: IAddress,
    signingService: ISigningService,
    hashAlgorithm: HashAlgorithm,
    nonce: Uint8Array,
  ): Promise<OneTimeAddressPredicate> {
    const hash = await new DataHasher(hashAlgorithm)
      .update(textEncoder.encode(OneTimeAddressPredicate.TYPE))
      .update(tokenId.encode())
      .update(tokenType.encode())
      .update(recipient.encode())
      .update(await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode(signingService.algorithm)).digest())
      .update(await new DataHasher(HashAlgorithm.SHA256).update(textEncoder.encode(hashAlgorithm)).digest())
      .update(signingService.publicKey)
      .update(nonce)
      .digest();

    return new OneTimeAddressPredicate(signingService.publicKey, signingService.algorithm, hashAlgorithm, nonce, hash);
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

  public async generateSigningService(secret: Uint8Array): Promise<ISigningService> {
    return new SigningService(await new DataHasher(HashAlgorithm.SHA256).update(secret).update(this.nonce).digest());
  }

  // TODO: Input has to be array so its single variable, predicate has to know about how to parse this
  public async verify(transaction: Transaction<TransactionData>): Promise<boolean> {
    if ((await SigningService.verifyWithPublicKey(
      transaction.data.hash,
      transaction.inclusionProof.authenticator.signature,
      transaction.inclusionProof.authenticator.publicKey
    ))) {

    }
    const requestId = await RequestId.create(this.publicKey, transaction.data.sourceState.hash);
    const status = await transaction.inclusionProof.verify(requestId.toBigInt());
    if (status !== InclusionProofVerificationStatus.OK) {
      return false; // Not included in tree
    }

    if (
      HexConverter.encode(transaction.inclusionProof.authenticator.publicKey) !== HexConverter.encode(this.publicKey) ||
      HexConverter.encode(transaction.inclusionProof.authenticator.stateHash) !==
        HexConverter.encode(transaction.data.sourceState.hash)
    ) {
      return false; // input mismatch
    }

    return true;
  }

  public toString(): string {
    return dedent`
          PublicKeyPredicate
            PublicKey: ${HexConverter.encode(this.publicKey)}
            Hash: ${HexConverter.encode(this._hash)}
        `;
  }
}




