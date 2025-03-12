import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { DataHasher, HashAlgorithm } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { Pointer } from '../address/Pointer.js';
import { Token } from '../token/Token.js';
import { TokenState } from '../token/TokenState.js';

export const textEncoder = new TextEncoder();

export class TransactionData {
  private constructor(
    private readonly _hash: Uint8Array,
    public readonly sourceState: TokenState,
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
    token: Token,
    recipient: Pointer,
    salt: Uint8Array,
    stateData?: Uint8Array,
    message?: string,
  ): Promise<TransactionData> {
    return new TransactionData(
      await new DataHasher(HashAlgorithm.SHA256)
        .update(token.state.hash)
        .update(await new DataHasher(HashAlgorithm.SHA256).update(stateData ?? new Uint8Array()).digest())
        .update(recipient.encode())
        .update(salt)
        .update(textEncoder.encode(message))
        .digest(),
      token.state,
      recipient,
      salt,
      stateData,
      message,
    );
  }

  public toString(): string {
    return dedent`
      Transition
        SourceState: 
          ${this.sourceState.toString()}
        Recipient: ${this.recipient.toString()}
        Salt: ${HexConverter.encode(this.salt)}
        StateData: ${this.stateData ? HexConverter.encode(this.stateData) : null}
        Message: ${this.message ?? 'null'}
        Hash: ${HexConverter.encode(this._hash)}
    `;
  }
}

export class Transaction {
  public constructor(
    private readonly data: TransactionData,
    private readonly inclusionProof: InclusionProof,
  ) {}

  public get hash(): Uint8Array {
    return this.data.hash;
  }

  public get hashAlgorithm(): string {
    return this.data.hashAlgorithm;
  }

  public toString(): string {
    return dedent`
        Transaction
          Data: 
            ${this.data.toString()}
          InclusionProof:
            ${this.inclusionProof.toString()}
      `;
  }
}
