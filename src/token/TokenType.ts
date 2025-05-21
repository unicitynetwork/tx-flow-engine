import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

export class TokenType {
  public constructor(private readonly _id: Uint8Array) {
    this._id = new Uint8Array(_id);
  }

  public static create(id: Uint8Array): TokenType {
    return new TokenType(id);
  }

  public encode(): Uint8Array {
    return new Uint8Array(this._id);
  }

  public toDto(): string {
    return HexConverter.encode(this._id);
  }

  public toString(): string {
    return `TokenType[${HexConverter.encode(this._id)}]`;
  }
}
