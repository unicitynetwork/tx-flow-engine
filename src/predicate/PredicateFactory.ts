import { IPredicate, IPredicateDto } from './IPredicate.js';
import { OneTimeAddressPredicate } from './OneTimeAddressPredicate.js';
import { PredicateType } from './PredicateType.js';
import { IAddress } from '../address/IAddress.js';
import { TokenId } from '../token/TokenId.js';
import { TokenType } from '../token/TokenType.js';

export class PredicateFactory {
  public static create(
    tokenId: TokenId,
    tokenType: TokenType,
    recipient: IAddress,
    data: IPredicateDto,
  ): Promise<IPredicate> {
    switch (data.type) {
      case PredicateType.ONE_TIME_ADDRESS:
        return OneTimeAddressPredicate.fromDto(tokenId, tokenType, recipient, data);
      default:
        throw new Error(`Unknown predicate type: ${data.type}`);
    }
  }
}
