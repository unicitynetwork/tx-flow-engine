import { IPredicate, IPredicateDto } from './IPredicate.js';
import { IAddress } from '../address/IAddress.js';
import { TokenId } from '../token/TokenId.js';
import { TokenType } from '../token/TokenType.js';

export interface IPredicateFactory {
  create(tokenId: TokenId, tokenType: TokenType, recipient: IAddress, data: IPredicateDto): Promise<IPredicate>;
}
