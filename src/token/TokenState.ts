import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { DataHasher, HashAlgorithm } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { IPredicate } from '../predicate/IPredicate.js';

export class TokenState {
  private constructor(
    public readonly unlockPredicate: IPredicate,
    public readonly aux: unknown,
    private readonly _data: Uint8Array,
    private readonly _hash: Uint8Array,
  ) {
    this._data = new Uint8Array(_data);
    this._hash = new Uint8Array(_hash);
  }

  // TODO: this is optional
  public get data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  public get hash(): Uint8Array {
    return new Uint8Array(this._hash);
  }

  public get hashAlgorithm(): string {
    return HashAlgorithm.SHA256.name;
  }

  public static async create(unlockPredicate: IPredicate, aux: unknown, data: Uint8Array): Promise<TokenState> {
    return new TokenState(
      unlockPredicate,
      aux,
      data,
      await new DataHasher(HashAlgorithm.SHA256).update(unlockPredicate.hash).update(data).digest(),
    );
  }

  public verify(inclusionProof: InclusionProof): Promise<string> {
    return this.unlockPredicate.verify(inclusionProof, this._hash);
  }

  public toString(): string {
    return dedent`
        TokenState
          UnlockPredicate: ${this.unlockPredicate.toString()}
          Aux: ${this.aux}
          Data: ${HexConverter.encode(this._data)}
          Hash: ${HexConverter.encode(this._hash)}
      `;
  }
}
