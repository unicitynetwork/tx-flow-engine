import { Authenticator } from '@unicitylabs/commons/lib/api/Authenticator.js';
import { InclusionProof } from '@unicitylabs/commons/lib/api/InclusionProof.js';
import { DataHasher, HashAlgorithm } from '@unicitylabs/commons/lib/hash/DataHasher.js';
import { ISigningService } from '@unicitylabs/commons/lib/signing/ISigningService.js';
import { SigningService } from '@unicitylabs/commons/lib/signing/SigningService.js';
import { HexConverter } from '@unicitylabs/commons/lib/util/HexConverter.js';

import { AggregatorClient } from './AggregatorClient.js';
import { RequestId } from '@unicitylabs/commons/lib/api/RequestId.js';
import { SubmitStateTransitionResponse } from './SubmitStateTransitionResponse.js';
import { Transition } from '../transition/Transition.js';
import { TokenState } from '../token/TokenState.js';
import { MintTransition } from '../transition/MintTransition.js';

interface IState {
  readonly hash: Uint8Array;
  readonly hashAlgorithm: string;
}

export class UnicityProvider {
  public constructor(
    private readonly signingService: ISigningService,
    private readonly client: AggregatorClient,
  ) {}

  public async submitStateTransition(
    sourceState: IState,
    transition: Transition | MintTransition,
  ): Promise<SubmitStateTransitionResponse> {
    // TODO: SigningService should not hash
    return await this.client.submitStateTransition(
      await this.getRequestId(sourceState),
      transition.hash,
      await this.getAuthenticator(sourceState, transition),
    );
  }

  public async getInclusionProof(requestId: RequestId): Promise<InclusionProof> {
    return this.client.getInclusionProof(requestId);
  }

  public getRequestId(sourceState: IState): Promise<RequestId> {
    return RequestId.create(this.signingService.publicKey, sourceState.hash);
  }

  public async getAuthenticator(sourceState: IState, transition: Transition | MintTransition): Promise<Authenticator> {
    return new Authenticator(
      transition.hashAlgorithm,
      this.signingService.publicKey,
      this.signingService.algorithm,
      await this.signingService.sign(transition.hash),
      sourceState.hash,
    );
  }
}

// const MINTER_PREFIX = 'I_AM_UNIVERSAL_MINTER_FOR_';
// const MINTER_PREFIX_BYTES = new TextEncoder().encode(MINTER_PREFIX);

// export async function getMinterSigner(tokenId: Uint8Array): Promise<ISigningService> {
//   return new SigningService(
//     await new DataHasher(HashAlgorithm.SHA256).update(MINTER_PREFIX_BYTES).update(tokenId).digest(),
//   );
// }

// export async function getMinterProvider(client: AggregatorClient, tokenId: Uint8Array): Promise<UnicityProvider> {
//   const signer = await getMinterSigner(tokenId);
//   return new UnicityProvider(signer, client);
// }

// const MINT_SUFFIX_HEX_PROMISE = new DataHasher(HashAlgorithm.SHA256)
//   .update(new TextEncoder().encode('TOKENID'))
//   .digest();

// export async function calculateGenesisStateHash(tokenId: Uint8Array): Promise<Uint8Array> {
//   return new DataHasher(HashAlgorithm.SHA256)
//     .update(tokenId)
//     .update(await MINT_SUFFIX_HEX_PROMISE)
//     .digest();
// }

// export async function calculatePointerFromPublicKey({
//   token_class_id,
//   sign_alg,
//   hash_alg,
//   secret,
//   salt,
//   sourceState,
// }): Promise<{ pointer: Uint8Array; signature: Uint8Array }> {
//   const signer = await SigningService.createFromSecret(secret);
//   const signature = await signer.sign(salt);
//   const nonce = await new DataHasher(HashAlgorithm.SHA256).update(sourceState).update(signature).digest();

//   return {
//     pointer: await new DataHasher(HashAlgorithm.SHA256)
//       .update(token_class_id)
//       .update(await new DataHasher(HashAlgorithm.SHA256).update(sign_alg).digest())
//       .update(await new DataHasher(HashAlgorithm.SHA256).update(hash_alg).digest())
//       .update(signer.publicKey)
//       .update(nonce)
//       .digest(),
//     signature,
//   };
// }

// export async function calculateExpectedPointerFromPublicAddress({
//   token_class_id,
//   sign_alg,
//   hash_alg,
//   pubkey,
//   salt,
//   signature,
//   nonce,
//   sourceState,
// }): Promise<Uint8Array> {
//   if (!(await SigningService.verifyWithPublicKey(salt, signature, pubkey))) {
//     throw new PointerCalculationError('Salt was not signed correctly.');
//   }

//   const calculatedNonce = new DataHasher(HashAlgorithm.SHA256).update(sourceState).update(signature).digest();
//   if (calculatedNonce !== nonce) {
//     throw new PointerCalculationError('Nonce was not derived correctly.');
//   }

//   return new DataHasher(HashAlgorithm.SHA256)
//     .update(token_class_id)
//     .update(await new DataHasher(HashAlgorithm.SHA256).update(sign_alg).digest())
//     .update(await new DataHasher(HashAlgorithm.SHA256).update(hash_alg).digest())
//     .update(pubkey)
//     .update(nonce)
//     .digest();
// }

// export async function calculatePublicKey(secret: Uint8Array): Promise<Uint8Array> {
//   const signingService = await SigningService.createFromSecret(secret);
//   return signingService.publicKey;
// }

// const PUBLIC_ADDRESS_PREFIX = new TextEncoder().encode('pub');

// export function calculatePublicAddress(publicKey: Uint8Array): Uint8Array {
//   const result = new Uint8Array(publicKey.length + PUBLIC_ADDRESS_PREFIX.length);
//   result.set(PUBLIC_ADDRESS_PREFIX);
//   result.set(publicKey, PUBLIC_ADDRESS_PREFIX.length);

//   return result;
// }

// const PUBLIC_POINTER_PREFIX = new TextEncoder().encode('point');

// export function calculatePublicPointer(pointer: Uint8Array): Uint8Array {
//   const result = new Uint8Array(pointer.length + PUBLIC_POINTER_PREFIX.length);
//   result.set(PUBLIC_POINTER_PREFIX);
//   result.set(pointer, PUBLIC_POINTER_PREFIX.length);

//   return result;
// }

// export async function generateRecipientPointerAddress(
//   token_class_id,
//   sign_alg,
//   hash_alg,
//   secret,
//   nonce,
// ): Promise<Uint8Array> {
//   return calculatePublicPointer(await calculatePointer({ token_class_id, sign_alg, hash_alg, secret, nonce }));
// }

// export async function generateRecipientPublicKeyAddress(secret: Uint8Array): Promise<Uint8Array> {
//   return calculatePublicAddress(await calculatePublicKey(secret));
// }

// export async function calculateGenesisRequestId(tokenId: Uint8Array): Promise<RequestId> {
//   const minterSigner = await getMinterSigner(tokenId);
//   const genesisState = await calculateGenesisStateHash(tokenId);
//   return RequestId.create(minterSigner.publicKey, genesisState);
// }

// export function calculateMintPayload(
//   tokenId,
//   tokenClass,
//   tokenValue,
//   dataHash,
//   destPointer,
//   salt,
// ): Promise<Uint8Array> {
//   const value = `${tokenValue.toString(16).slice(2).padStart(64, '0')}`;
//   return new DataHasher(HashAlgorithm.SHA256)
//     .update(tokenId)
//     .update(tokenClass)
//     .update(HexConverter.decode(value))
//     .update(dataHash)
//     .update(destPointer)
//     .update(salt)
//     .digest();
// }

// export function calculatePayload(source, destPointer, salt, dataHash): Promise<Uint8Array> {
//   return new DataHasher(HashAlgorithm.SHA256)
//     .update(source.calculateStateHash())
//     .update(destPointer)
//     .update(salt)
//     .update(dataHash ? dataHash : new Uint8Array())
//     .digest();
// }

// export function resolveReference(dest_ref: string): { pointer: string } | { pubkey: string } | { nametag: string } {
//   if (dest_ref.startsWith('point')) return { pointer: dest_ref.substring(5) };
//   if (dest_ref.startsWith('pub')) return { pubkey: dest_ref.substring(3) };
//   if (dest_ref.startsWith('nametag')) return { nametag: dest_ref.substring(7) };

//   return dest_ref;
// }

// export function destRefFromNametag(requestedNametagId, nametagTokens) {
//   //    console.log(nametagTokens);
//   const nametagToken = nametagTokens['nametag_' + requestedNametagId];
//   if (!nametagToken) throw new Error('Requested nametag token  ' + requestedNametagId + ' not provided');
//   return resolveReference(nametagToken.state.data.dest_ref).nametag
//     ? destRefFromNametag(nametagToken.state.data.dest_ref, nametagTokens)
//     : nametagToken.state.data.dest_ref;
// }

// export async function isUnspent(provider: UnicityProvider, state: Uint8Array): Promise<boolean> {
//   const { status } = await provider.extractProofs(await provider.getRequestId(state));
//   return status === InclusionProofVerificationStatus.NOT_INCLUDED;
// }

// export function confirmOwnership(token, signer): boolean {
//   return token.state.challenge.pubkey == signer.getPubKey();
// }
