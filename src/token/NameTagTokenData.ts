import { ITokenData } from './ITokenData.js';

export class NameTagTokenData implements ITokenData {
  public static decode(): NameTagTokenData {
    return new NameTagTokenData();
  }

  public encode(): Uint8Array {
    return new Uint8Array();
  }
}
