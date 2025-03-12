import { DataHasher, HashAlgorithm } from '@unicitylabs/commons/lib/hash/DataHasher.js';

import { Token } from '../token/Token.js';
import { TokenState } from '../token/TokenState.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';
import { Pointer } from '../address/Pointer.js';

export class Transition {
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
  ): Promise<Transition> {
    return new Transition(
      await new DataHasher(HashAlgorithm.SHA256)
        .update(token.state.hash)
        .update(await new DataHasher(HashAlgorithm.SHA256).update(stateData ?? new Uint8Array()).digest())
        .update(recipient.encode())
        .update(salt)
        .digest(),
      token.state,
      recipient,
      salt,
      stateData,
      message,
    );
  }

  public toString() {
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
