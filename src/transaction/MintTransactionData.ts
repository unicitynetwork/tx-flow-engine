import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { DataHash } from '@unicitylabs/commons/lib/hash/DataHash.js';
import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { ITokenData } from '../token/ITokenData.js';
import { TokenId } from '../token/TokenId.js';
import { TokenType } from '../token/TokenType.js';

export interface IMintTransactionDataDto {
  readonly recipient: string;
  readonly salt: string;
  readonly dataHash: string | null;
  readonly reason: string | null;
}

const textEncoder = new TextEncoder();

export class MintTransactionData {
  private constructor(
    public readonly hash: DataHash,
    public readonly sourceState: RequestId,
    public readonly recipient: string,
    private readonly _salt: Uint8Array,
    public readonly dataHash: DataHash | null,
    private readonly _reason: Uint8Array | null,
  ) {
    this._salt = new Uint8Array(_salt);
    this._reason = _reason ? new Uint8Array(_reason) : null;
  }

  public get salt(): Uint8Array {
    return new Uint8Array(this._salt);
  }

  public get reason(): Uint8Array | null {
    return this._reason ? new Uint8Array(this._reason) : null;
  }

  public get hashAlgorithm(): HashAlgorithm {
    return this.hash.algorithm;
  }

  public static async create(
    tokenId: TokenId,
    tokenType: TokenType,
    tokenData: ITokenData,
    sourceState: RequestId,
    recipient: string,
    salt: Uint8Array,
    dataHash: DataHash | null,
    reason: Uint8Array | null,
  ): Promise<MintTransactionData> {
    const tokenDataHash = await new DataHasher(HashAlgorithm.SHA256).update(tokenData.encode()).digest();
    // TODO: Do not use empty arrays because those will be just skipped
    return new MintTransactionData(
      await new DataHasher(HashAlgorithm.SHA256)
        .update(tokenId.encode())
        .update(tokenType.encode())
        .update(tokenDataHash.imprint)
        .update(dataHash?.imprint ?? new Uint8Array())
        .update(textEncoder.encode(recipient))
        .update(salt)
        .update(reason ?? new Uint8Array())
        .digest(),
      sourceState,
      recipient,
      salt,
      dataHash,
      reason,
    );
  }

  public toDto(): IMintTransactionDataDto {
    return {
      dataHash: this.dataHash?.toDto() ?? null,
      reason: this.reason ? HexConverter.encode(this.reason) : null,
      recipient: this.recipient,
      salt: HexConverter.encode(this.salt),
    };
  }

  public toString(): string {
    return dedent`
      MintTransactionData:
        Recipient: ${this.recipient}
        Salt: ${HexConverter.encode(this.salt)}
        Data: ${this.dataHash?.toString() ?? null}
        Reason: ${this.reason ? HexConverter.encode(this.reason) : null}
        Hash: ${this.hash.toString()}`;
  }
}
