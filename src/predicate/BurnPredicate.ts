import { DataHash } from '@unicitylabs/commons/lib/hash/DataHash.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
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
  private readonly _nonce = new Uint8Array();

  private constructor(public readonly reference: DataHash) {
    this.hash = reference;
  }

  public get nonce(): Uint8Array {
    return this._nonce;
  }

  public static async create(tokenId: TokenId, tokenType: TokenType): Promise<BurnPredicate> {
    const reference = await BurnPredicate.calculateReference(tokenId, tokenType);
    return new BurnPredicate(reference);
  }

  public static async fromDto(tokenId: TokenId, tokenType: TokenType, data: unknown): Promise<BurnPredicate> {
    if (!BurnPredicate.isDto(data)) {
      throw new Error('Invalid one time address predicate dto');
    }

    const reference = await BurnPredicate.calculateReference(tokenId, tokenType);

    return new BurnPredicate(reference);
  }

  public static isDto(data: unknown): data is IPredicateDto {
    return typeof data === 'object' && data !== null && 'nonce' in data && typeof data.nonce === 'string';
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
            Nonce: ${HexConverter.encode(this.nonce)}
            Hash: ${this.hash.toString()}`;
  }

  public isOwner(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
