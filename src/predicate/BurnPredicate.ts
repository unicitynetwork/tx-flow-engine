import { CborEncoder } from '@unicitylabs/commons/lib/cbor/CborEncoder.js';
import { DataHash } from '@unicitylabs/commons/lib/hash/DataHash.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { IPredicate } from './IPredicate.js';
import { PredicateType } from './PredicateType.js';
import { TokenId } from '../token/TokenId.js';
import { TokenType } from '../token/TokenType.js';

interface IPredicateDto {
  readonly type: PredicateType;
}

export class BurnPredicate implements IPredicate {
  private static readonly TYPE = PredicateType.BURN;

  public readonly type: PredicateType = BurnPredicate.TYPE;
  public readonly hash: DataHash;

  private constructor(public readonly reference: DataHash) {
    this.hash = reference;
  }

  public static async create(tokenId: TokenId, tokenType: TokenType): Promise<BurnPredicate> {
    const reference = await BurnPredicate.calculateReference(tokenId, tokenType);
    return new BurnPredicate(reference);
  }

  public static async fromJSON(tokenId: TokenId, tokenType: TokenType): Promise<BurnPredicate> {
    const reference = await BurnPredicate.calculateReference(tokenId, tokenType);

    return new BurnPredicate(reference);
  }

  private static calculateReference(tokenId: TokenId, tokenType: TokenType): Promise<DataHash> {
    return new DataHasher(HashAlgorithm.SHA256)
      .update(
        CborEncoder.encodeArray([
          CborEncoder.encodeTextString(BurnPredicate.TYPE),
          tokenId.toCBOR(),
          tokenType.toCBOR(),
        ]),
      )
      .digest();
  }

  public toJSON(): IPredicateDto {
    return {
      type: this.type,
    };
  }

  public toCBOR(): Uint8Array {
    return CborEncoder.encodeArray([CborEncoder.encodeTextString(this.type)]);
  }

  public verify(): Promise<boolean> {
    return Promise.resolve(false);
  }

  public toString(): string {
    return dedent`
          Predicate[${this.type}]:
            Hash: ${this.hash.toString()}`;
  }

  public isOwner(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
