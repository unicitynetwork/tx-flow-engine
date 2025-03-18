import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { IAddress } from '../address/IAddress.js';
import { ITokenStateDto, TokenState } from '../token/TokenState.js';

const textEncoder = new TextEncoder();

export interface ITransactionDataDto {
  readonly sourceState: ITokenStateDto;
  readonly recipient: string;
  readonly salt: string;
  readonly data: string | null;
  readonly message: string | null;
}

export class TransactionData {
  private constructor(
    private readonly _hash: Uint8Array,
    public readonly sourceState: TokenState,
    public readonly recipient: IAddress,
    public readonly salt: Uint8Array,
    public readonly data: Uint8Array | null,
    public readonly message: string | null,
  ) {
    this._hash = new Uint8Array(_hash);
  }

  public get hash(): Uint8Array {
    return new Uint8Array(this._hash);
  }

  public get hashAlgorithm(): string {
    return HashAlgorithm.SHA256;
  }

  public static async create(
    state: TokenState,
    recipient: IAddress,
    salt: Uint8Array,
    data: Uint8Array | null,
    message: string | null,
  ): Promise<TransactionData> {
    return new TransactionData(
      await new DataHasher(HashAlgorithm.SHA256)
        .update(state.hash)
        .update(await new DataHasher(HashAlgorithm.SHA256).update(data ?? new Uint8Array()).digest())
        .update(recipient.encode())
        .update(salt)
        .update(textEncoder.encode(message ?? ''))
        .digest(),
      state,
      recipient,
      salt,
      data,
      message,
    );
  }

  public toDto(): ITransactionDataDto {
    return {
      data: this.data ? HexConverter.encode(this.data) : null,
      message: this.message,
      recipient: this.recipient.toDto(),
      salt: HexConverter.encode(this.salt),
      sourceState: this.sourceState.toDto(),
    };
  }

  public toString(): string {
    return dedent`
      Transition
        SourceState: 
          ${this.sourceState.toString()}
        Recipient: ${this.recipient.toString()}
        Salt: ${HexConverter.encode(this.salt)}
        Data: ${this.data ? HexConverter.encode(this.data) : null}
        Message: ${this.message ?? 'null'}
        Hash: ${HexConverter.encode(this._hash)}
    `;
  }
}
