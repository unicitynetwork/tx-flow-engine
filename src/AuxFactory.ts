import { IAuxFactory } from './IAuxFactory.js';
import { IAux, OneTimeAddressAux } from './token/TokenState.js';
import { AddressScheme } from './address/AddressScheme.js';

export class AuxFactory implements IAuxFactory {
  public create(address: string, data: unknown): IAux {
    const [scheme] = address.split('://');
    switch (scheme) {
      case AddressScheme.ONE_TIME_ADDRESS:
        return new OneTimeAddressAux();
      default:
        throw new Error(`Unknown address scheme: ${scheme}`);
    }
  }
}