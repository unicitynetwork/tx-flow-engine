import { CborDecoder } from '@unicitylabs/commons/lib/cbor/CborDecoder.js';
import { CborEncoder } from '@unicitylabs/commons/lib/cbor/CborEncoder.js';
import { dedent } from '@unicitylabs/commons/lib/util/StringUtils.js';

import { ISerializable } from '../../ISerializable.js';

export class FungibleTokenData implements ISerializable {
  public constructor(private readonly _coins: Map<string, bigint>) {
    this._coins = new Map(_coins);
  }

  public get coins(): ReadonlyMap<string, bigint> {
    return new Map(this._coins);
  }

  public static decode(data: Uint8Array): FungibleTokenData {
    const coins = new Map<string, bigint>();
    const entries = CborDecoder.readArray(data);
    for (const item of entries) {
      const [key, value] = CborDecoder.readArray(item);
      coins.set(CborDecoder.readTextString(key), CborDecoder.readUnsignedInteger(value));
    }

    return new FungibleTokenData(coins);
  }

  public encode(): Uint8Array {
    return CborEncoder.encodeArray(
      Array.from(this._coins.entries()).map(([key, value]) =>
        CborEncoder.encodeArray([CborEncoder.encodeTextString(key), CborEncoder.encodeUnsignedInteger(value)]),
      ),
    );
  }

  public toString(): string {
    return dedent`
      FungibleTokenData
        ${Array.from(this._coins.entries())
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n')}`;
  }
}
