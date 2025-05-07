import { ITokenData } from './ITokenData.js';

export class NameTagTokenData implements ITokenData {
  public static decode(): Promise<NameTagTokenData> {
    return Promise.resolve(new NameTagTokenData());
  }

  public encode(): Uint8Array {
    return new Uint8Array();
  }
}
