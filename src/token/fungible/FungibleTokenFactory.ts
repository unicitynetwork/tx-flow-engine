import { TokenFactory } from '../TokenFactory.js';
import { FungibleTokenData } from './FungibleTokenData.js';
import { FungibleTokenMintTransactionFactory } from './FungibleTokenMintTransactionFactory.js';
import { PredicateFactory } from '../../predicate/PredicateFactory.js';

export class FungibleTokenFactory extends TokenFactory<FungibleTokenData> {
  public constructor() {
    super(new FungibleTokenMintTransactionFactory(), new PredicateFactory());
  }

  protected createData(data: Uint8Array): Promise<FungibleTokenData> {
    return Promise.resolve(FungibleTokenData.decode(data));
  }
}
