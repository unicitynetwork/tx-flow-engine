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

const textEncoder = new TextEncoder();

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

  public static async fromDto(tokenId: TokenId, tokenType: TokenType): Promise<BurnPredicate> {
    const reference = await BurnPredicate.calculateReference(tokenId, tokenType);

    return new BurnPredicate(reference);
  }

  private static calculateReference(tokenId: TokenId, tokenType: TokenType): Promise<DataHash> {
    return new DataHasher(HashAlgorithm.SHA256)
      .update(textEncoder.encode(BurnPredicate.TYPE))
      .update(tokenId.encode())
      .update(tokenType.encode())
      .digest();
  }

  public toDto(): IPredicateDto {
    return {
      type: this.type,
    };
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
