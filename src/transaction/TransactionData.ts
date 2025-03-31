import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { DataHash } from '../../../shared/src/hash/DataHash.js';
import { ITokenStateDto, TokenState } from '../token/TokenState.js';

export interface ITransactionDataDto {
  readonly sourceState: ITokenStateDto;
  readonly recipient: string;
  readonly salt: string;
  readonly dataHash: string | null;
  readonly message: string | null;
  readonly aux: unknown;
}

const textEncoder = new TextEncoder();

export class TransactionData {
  private constructor(
    public readonly hash: DataHash,
    public readonly sourceState: TokenState,
    public readonly recipient: string,
    public readonly salt: Uint8Array,
    public readonly dataHash: DataHash | null,
    private readonly _message: Uint8Array | null,
    public readonly aux: unknown
  ) {
    this._message = _message ? new Uint8Array(_message) : null;
  }

  public get message(): Uint8Array | null {
    return this._message ? new Uint8Array(this._message) : null;
  }

  public get hashAlgorithm(): HashAlgorithm {
    return this.hash.algorithm;
  }

  public static async create(
    state: TokenState,
    recipient: string,
    salt: Uint8Array,
    dataHash: DataHash | null,
    message: Uint8Array | null,
    aux: unknown
  ): Promise<TransactionData> {
    return new TransactionData(
      await new DataHasher(HashAlgorithm.SHA256)
        .update(state.hash.imprint)
        .update(dataHash?.imprint ?? new Uint8Array())
        .update(textEncoder.encode(recipient))
        .update(salt)
        .update(message ?? new Uint8Array())
        .digest(),
      state,
      recipient,
      salt,
      dataHash,
      message,
      aux
    );
  }

  public toDto(): ITransactionDataDto {
    return {
      dataHash: this.dataHash?.toDto() ?? null,
      message: this._message ? HexConverter.encode(this._message) : null,
      recipient: this.recipient,
      salt: HexConverter.encode(this.salt),
      sourceState: this.sourceState.toDto(),
      aux: this.aux
    };
  }

  public toString(): string {
    return dedent`
      Transition
        SourceState: 
          ${this.sourceState.toString()}
        Recipient: ${this.recipient.toString()}
        Salt: ${HexConverter.encode(this.salt)}
        Data: ${this.dataHash?.toString() ?? null}
        Message: ${this._message ? HexConverter.encode(this._message) : null}
        Hash: ${this.hash.toString()}
        Aux: ${this.aux}
    `;
  }
}
