export enum AddressScheme {
  POINTER = 'POINTER',
}

export interface IAddress {
  readonly data: Uint8Array;
  readonly scheme: AddressScheme;
}
