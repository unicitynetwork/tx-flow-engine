import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { ISigningService } from '@unicitylabs/commons/lib/signing/ISigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { IPredicate, IPredicateDto } from '../predicate/IPredicate.js';
import { Transaction } from '../transaction/Transaction.js';
import { TransactionData } from '../transaction/TransactionData.js';

export interface ITokenStateDto {
  readonly unlockPredicate: IPredicateDto;
  readonly data: string;
}

export class TokenState {
  private constructor(
    private readonly unlockPredicate: IPredicate,
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

  public get hashAlgorithm(): HashAlgorithm {
    return HashAlgorithm.SHA256;
  }

  public static async create(unlockPredicate: IPredicate, data: Uint8Array): Promise<TokenState> {
    return new TokenState(
      unlockPredicate,
      data,
      await new DataHasher(HashAlgorithm.SHA256).update(unlockPredicate.hash).update(data).digest(),
    );
  }

  public toDto(): ITokenStateDto {
    return {
      data: HexConverter.encode(this._data),
      unlockPredicate: this.unlockPredicate.toDto(),
    };
  }

  public verify(transaction: Transaction<TransactionData>): Promise<boolean> {
    return this.unlockPredicate.verify(transaction);
  }

  public generateSigningService(secret: Uint8Array): Promise<ISigningService> {
    return this.unlockPredicate.generateSigningService(secret);
  }

  public toString(): string {
    return dedent`
        TokenState
          UnlockPredicate: ${this.unlockPredicate.toString()}
          Data: ${HexConverter.encode(this._data)}
          Hash: ${HexConverter.encode(this._hash)}
      `;
  }
}
