export enum AddressScheme {
  ONE_TIME_ADDRESS = 'ONE_TIME_ADDRESS',
}

export interface IAddress {
  readonly data: Uint8Array;
  readonly scheme: AddressScheme;

  encode(): Uint8Array;
  toDto(): string;
}
