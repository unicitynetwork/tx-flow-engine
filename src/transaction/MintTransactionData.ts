import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { IAddress } from '../address/IAddress.js';
import { TokenId } from '../token/TokenId.js';
import { TokenType } from '../token/TokenType.js';

export interface IMintTransactionDataDto {
  readonly recipient: string;
  readonly salt: string;
  readonly data: string | null;
}

export class MintTransactionData {
  private constructor(
    private readonly _hash: Uint8Array,
    public readonly sourceState: RequestId,
    public readonly recipient: IAddress,
    public readonly salt: Uint8Array,
    public readonly data: Uint8Array | null,
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
    tokenId: TokenId,
    tokenType: TokenType,
    tokenData: Uint8Array,
    sourceState: RequestId,
    recipient: IAddress,
    salt: Uint8Array,
    data: Uint8Array | null,
  ): Promise<MintTransactionData> {
    return new MintTransactionData(
      await new DataHasher(HashAlgorithm.SHA256)
        .update(tokenId.encode())
        .update(tokenType.encode())
        .update(await new DataHasher(HashAlgorithm.SHA256).update(tokenData).digest())
        .update(await new DataHasher(HashAlgorithm.SHA256).update(data ?? new Uint8Array()).digest())
        .update(recipient.encode())
        .update(salt)
        .digest(),
      sourceState,
      recipient,
      salt,
      data,
    );
  }

  public toDto(): IMintTransactionDataDto {
    return {
      data: this.data ? HexConverter.encode(this.data) : null,
      recipient: this.recipient.toDto(),
      salt: HexConverter.encode(this.salt),
    };
  }

  public toString(): string {
    return dedent`
      MintTransaction
        Recipient: ${this.recipient.toString()}
        Salt: ${HexConverter.encode(this.salt)}
        Data: ${this.data ? HexConverter.encode(this.data) : null}
        Hash: ${HexConverter.encode(this._hash)}
    `;
  }
}
