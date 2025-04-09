import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { AddressScheme } from './AddressScheme.js';
import { IAddress } from './IAddress.js';
import { Token } from '../token/Token.js';

export class NameTagAddress implements IAddress {
  public constructor(
    private readonly _data: Uint8Array,
    private readonly _tokens: Token[],
  ) {
    this._data = new Uint8Array(_data);
    this._tokens = _tokens.slice();
  }

  public get data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  public get tokens(): Token[] {
    return Array.from(this._tokens);
  }

  public get scheme(): AddressScheme {
    return AddressScheme.NAMETAG;
  }

  public toDto(): string {
    return `${this.scheme}://${HexConverter.encode(this._data)}`;
  }

  public toString(): string {
    return `NameTagAddress[${HexConverter.encode(this._data)}]`;
  }
}
