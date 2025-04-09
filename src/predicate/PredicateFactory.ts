import { DefaultPredicate } from './DefaultPredicate.js';
import { IPredicate, IPredicateDto } from './IPredicate.js';
import { PredicateType } from './PredicateType.js';
import { TokenId } from '../token/TokenId.js';
import { TokenType } from '../token/TokenType.js';

export class PredicateFactory {
  public static create(
    tokenId: TokenId,
    tokenType: TokenType,
    recipient: string,
    data: IPredicateDto,
  ): Promise<IPredicate> {
    switch (data.type) {
      case PredicateType.DEFAULT:
        return DefaultPredicate.fromDto(tokenId, tokenType, recipient, data);
      default:
        throw new Error(`Unknown predicate type: ${data.type}`);
    }
  }
}
