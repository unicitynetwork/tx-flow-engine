import { DataHasher } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { HashAlgorithm } from '@unicitylabs/commons/lib/hash/HashAlgorithm.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { AddressScheme } from './AddressScheme.js';
import { DataHash } from '../../../shared/src/hash/DataHash.js';
import { TokenType } from '../token/TokenType.js';
import { IAddress } from './IAddress.js';

const textEncoder = new TextEncoder();

export class PublicKeyAddress implements IAddress {
  public constructor(private readonly _data: Uint8Array) {
    this._data = new Uint8Array(_data);
  }

  public get data(): Uint8Array {
    return new Uint8Array(this._data);
  }

  public get scheme(): AddressScheme {
    return AddressScheme.PUBLIC_KEY;
  }

  public toDto(): string {
    return `${this.scheme}://${HexConverter.encode(this._data)}`;
  }

  public toString(): string {
    return `PublicKeyAddress[${HexConverter.encode(this._data)}]`;
  }
}
