import { IPredicate, IPredicateDto } from './IPredicate.js';
import { TokenId } from '../token/TokenId.js';
import { TokenType } from '../token/TokenType.js';

export interface IPredicateFactory {
  create(tokenId: TokenId, tokenType: TokenType, data: IPredicateDto): Promise<IPredicate>;
}
