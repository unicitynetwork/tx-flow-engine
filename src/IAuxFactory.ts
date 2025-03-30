import { IAux } from './token/TokenState.js';

export interface IAuxFactory {
  create(address: string, data: unknown): IAux;
}

