import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { DataHash } from '../../../shared/src/hash/DataHash.js';
import { IAddress } from '../address/IAddress.js';
import { TokenId } from '../token/TokenId.js';
import { TokenType } from '../token/TokenType.js';

export interface IMintTransactionDataDto {
  readonly recipient: string;
  readonly salt: string;
  readonly dataHash: string | null;
}

export class MintTransactionData {
  private constructor(
    public readonly hash: DataHash,
    public readonly sourceState: RequestId,
    public readonly recipient: IAddress,
    public readonly salt: Uint8Array,
    public readonly dataHash: DataHash | null,
  ) {}

  public get hashAlgorithm(): HashAlgorithm {
    return this.hash.algorithm;
  }

  public static async create(
    tokenId: TokenId,
    tokenType: TokenType,
    tokenData: Uint8Array,
    sourceState: RequestId,
    recipient: IAddress,
    salt: Uint8Array,
    dataHash: DataHash | null,
  ): Promise<MintTransactionData> {
    const tokenDataHash = await new DataHasher(HashAlgorithm.SHA256).update(tokenData).digest();
    return new MintTransactionData(
      await new DataHasher(HashAlgorithm.SHA256)
        .update(tokenId.encode())
        .update(tokenType.encode())
        .update(tokenDataHash.imprint)
        .update(dataHash?.imprint ?? new Uint8Array())
        .update(recipient.encode())
        .update(salt)
        .digest(),
      sourceState,
      recipient,
      salt,
      dataHash,
    );
  }

  public toDto(): IMintTransactionDataDto {
    return {
      dataHash: this.dataHash?.toDto() ?? null,
      recipient: this.recipient.toDto(),
      salt: HexConverter.encode(this.salt),
    };
  }

  public toString(): string {
    return dedent`
      MintTransaction
        Recipient: ${this.recipient.toString()}
        Salt: ${HexConverter.encode(this.salt)}
        Data: ${this.dataHash?.toString() ?? null}
        Hash: ${this.hash.toString()}
    `;
  }
}
