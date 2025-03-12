import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { DataHasher, HashAlgorithm } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { Pointer } from '../address/Pointer.js';
import { TokenId } from '../token/TokenId.js';
import { TokenType } from '../token/TokenType.js';

const textEncoder = new TextEncoder();

export class MintTransactionData {
  private constructor(
    private readonly _hash: Uint8Array,
    public readonly tokenId: TokenId,
    public readonly tokenType: TokenType,
    public readonly tokenData: Uint8Array,
    public readonly recipient: Pointer,
    public readonly salt: Uint8Array,
    public readonly stateData?: Uint8Array,
    public readonly message?: string,
  ) {
    this._hash = new Uint8Array(_hash);
  }

  public get hash(): Uint8Array {
    return new Uint8Array(this._hash);
  }

  public get hashAlgorithm(): string {
    return HashAlgorithm.SHA256.name;
  }

  public static async create(
    tokenId: TokenId,
    tokenType: TokenType,
    tokenData: Uint8Array,
    recipient: Pointer,
    salt: Uint8Array,
    stateData?: Uint8Array,
    message?: string,
  ): Promise<MintTransactionData> {
    return new MintTransactionData(
      await new DataHasher(HashAlgorithm.SHA256)
        .update(tokenId.encode())
        .update(tokenType.encode())
        .update(await new DataHasher(HashAlgorithm.SHA256).update(tokenData).digest())
        .update(await new DataHasher(HashAlgorithm.SHA256).update(stateData ?? new Uint8Array()).digest())
        .update(recipient.encode())
        .update(salt)
        .update(textEncoder.encode(message))
        .digest(),
      tokenId,
      tokenType,
      tokenData,
      recipient,
      salt,
      stateData,
      message,
    );
  }

  public toString(): string {
    return dedent`
      MintTransactionData
        TokenId: ${this.tokenId.toString()}
        TokenType: ${this.tokenType}
        TokenData: ${HexConverter.encode(this.tokenData)}
        Recipient: ${this.recipient.toString()}
        Salt: ${HexConverter.encode(this.salt)}
        StateData: ${this.stateData ? HexConverter.encode(this.stateData) : null}
        Message: ${this.message ?? 'null'}
        Hash: ${HexConverter.encode(this._hash)}
    `;
  }
}

export class MintTransaction {
  public constructor(
    public readonly requestId: RequestId,
    public readonly data: MintTransactionData,
  ) {}

  public get hash(): Uint8Array {
    return this.data.hash;
  }

  public get hashAlgorithm(): string {
    return this.data.hashAlgorithm;
  }

  public toString(): string {
    return dedent`
        MintTransaction
          Request Id: ${this.requestId.toString()}
          Data: 
            ${this.data.toString()}
      `;
  }
}
