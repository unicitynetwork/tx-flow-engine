import { AddressScheme } from './AddressScheme.js';

export interface IAddress {
  readonly data: Uint8Array;
  readonly scheme: AddressScheme;
  
  toDto(): string;
}
