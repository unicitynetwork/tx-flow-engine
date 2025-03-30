import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { DataHash } from '../../../shared/src/hash/DataHash.js';
import { TokenId } from '../token/TokenId.js';
import { TokenType } from '../token/TokenType.js';

export interface IMintTransactionDataDto {
  readonly recipient: string;
  readonly salt: string;
  readonly dataHash: string | null;
}

const textEncoder = new TextEncoder();

export class MintTransactionData {
  private constructor(
    public readonly hash: DataHash,
    public readonly sourceState: RequestId,
    public readonly recipient: string,
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
    recipient: string,
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
        .update(textEncoder.encode(recipient))
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
      recipient: this.recipient,
      salt: HexConverter.encode(this.salt),
    };
  }

  public toString(): string {
    return dedent`
      MintTransaction
        Recipient: ${this.recipient}
        Salt: ${HexConverter.encode(this.salt)}
        Data: ${this.dataHash?.toString() ?? null}
        Hash: ${this.hash.toString()}
    `;
  }
}
