# Unicity Token Transaction Protocol Specification

## 1. Introduction

The Unicity Token Transaction Protocol facilitates secure, verifiable off-chain token transfers while maintaining cryptographic guarantees of uniqueness and preventing double-spending. This specification details the implementation of a state transition machine where tokens pass from one owner to another through provably unique transitions.

## 2. Core Components

### 2.1 Token Structure

A token is a standalone verifiable structure that contains:

- **Token ID**: A unique identifier for the specific token
- **Token Class ID**: The class identifier that categorizes the token
- **Token Value**: A numeric value associated with the token (often used for fungible tokens)
- **Immutable Data**: Data that remains constant throughout the token's lifetime
- **Genesis State**: The initial state of the token
- **Mint Proofs**: Cryptographic evidence demonstrating that the token was legitimately created
- **Mint Request**: Information about the initial ownership assignment
- **Mint Salt**: A random value used during the minting process
- **Transitions**: An ordered sequence of verified state transitions

These immutable fields provide a complete history of the token from its creation (genesis) to its current state, with cryptographic guarantees that the token has never been duplicated and that each state transition has been properly authorized.

### 2.2 Token State

A token state contains:

- **Challenge**: An ownership verification mechanism (typically a public key challenge)
- **Auxiliary Data**: Optional metadata associated with the token state
- **Data**: An arbitrary data payload (optional)

### 2.3 Challenge

The default challenge mechanism is a public key challenge with the following properties:

- **Token Class ID**: The class identifier for the token
- **Token ID**: A unique identifier for the specific token
- **Signature Algorithm**: Algorithm used for digital signatures (e.g., 'secp256k1')
- **Hash Algorithm**: Algorithm used for hashing (e.g., 'sha256')
- **Public Key**: The public key that locks the token state
- **Nonce**: A random value used to prevent ownership tracking

### 2.4 Unicity Proof

A cryptographic artifact demonstrating that a token has undergone exactly one specific transition from a given state. It consists of:

- **Inclusion Proofs**: Evidence that a request is included in the Unicity infrastructure
- **Path**: A sequence of authenticated records proving uniqueness
- **Request ID**: Deterministically calculated from owner's public key and state hash

## 3. State Transition Process

### 3.1 Transaction Structure

A transaction contains:

- **Token ID**: Identifier for the token being transferred
- **Source**: The current token state
- **Input**: Contains the unicity proof and destination information
- **Destination Reference (dest_ref)**: Specifies where to send the token

### 3.2 Transaction Input

The input component of a transaction includes:

- **Path**: The unicity proof path
- **Destination Reference**: Address information for the recipient
- **Salt**: Random value used for privacy
- **Data Hash**: Hash of the destination state data (optional)
- **Message**: Optional information for the recipient

### 3.3 Destination Reference Types

Three methods are available for addressing token recipients:

- **Public Key Address**: Direct addressing using the recipient's public key
- **Pointer Address**: One-time use address derived from recipient's private key and a random nonce
- **Nametag Address**: Human-friendly addressing that resolves to a public key through a nametag token

## 4. Protocol Flow

### 4.1 Token Creation (Minting)

1. Generate a token ID, class ID, and other token parameters
2. Create a mint salt and destination pointer for the initial owner
3. Submit a state transition request to the Unicity Aggregator
4. Receive a unicity proof for the genesis state
5. Initialize the token with the genesis state and proof

### 4.2 Transaction Creation

1. Sender determines the current state hash of the token
2. Sender prepares the destination reference for the recipient
3. Sender generates a random salt value
4. Sender calculates the payload using the state, destination reference, salt, and optional data hash
5. Sender submits a state transition request to the Unicity Aggregator
6. Sender receives a unicity proof if the state hasn't been spent before
7. Sender creates a transaction using the token ID, current state, input (including the proof), and destination reference

### 4.3 Transaction Delivery

1. Sender delivers the complete structure containing both the token being spent and the spending transaction to the recipient
2. This complete structure allows the recipient to verify the token's entire history and the validity of the transaction

### 4.4 Transaction Import

1. Recipient verifies the transaction's validity and the token's history
2. Recipient converts the transaction into a state transition from the previous state to a new state
3. The new state is only fully known by the recipient (incorporating their private information)
4. Recipient creates a destination state using their private key
5. Recipient applies the transaction to the token
6. Token's state is updated to the destination state
7. Transition is recorded in the token's history

## 5. Verification Process

### 5.1 Token Verification

1. Verify the genesis state using mint proofs
2. Verify each transition in the token's history
3. Ensure the transitions form an unbroken chain from genesis to current state
4. Verify that the current state matches the final transition's destination

### 5.2 State Verification

1. Calculate the Request ID from the owner's public key and state hash
2. Verify the inclusion proofs in the path
3. Verify that the authenticator's public key and state match the expected values

### 5.3 Transition Verification

A transition is verified by:

1. Verifying the source state (unlock)
2. Validating the destination data matches the data hash
3. Verifying the destination reference resolves correctly
4. Checking that the destination pointer matches the expected pointer
5. Verifying the transaction payload matches the expected payload

## 6. Privacy Features

### 6.1 Pointer Addressing

When using pointer addressing:

1. Recipient generates a keypair and a blinding factor (nonce)
2. Recipient calculates a pointer: hash(tokenClass || publicKey || nonce)
3. Sender uses this pointer as the destination reference
4. Recipient uses their private key and nonce to claim ownership
5. This prevents linking tokens to the same owner by observers

### 6.2 Salt Signatures

For public key addressing:

1. Sender includes a random salt in the transaction
2. Recipient signs this salt with their private key
3. The signature is used to derive a nonce for the next state
4. This ensures that even with public key addressing, subsequent states remain unlinkable

## 7. Addressing Mechanisms

### 7.1 Public Key Addressing

Direct addressing using the recipient's public key:

1. Sender specifies the recipient's public key in the dest_ref
2. Recipient must prove knowledge of the corresponding private key
3. Provides simplicity but offers less privacy

### 7.2 Pointer Addressing

Privacy-preserving addressing:

1. Recipient generates a keypair and nonce
2. Pointer is calculated as hash(tokenClass || publicKey || nonce)
3. Sender uses the pointer as dest_ref
4. Recipient derives the new state challenge using their private key and nonce
5. Prevents observers from linking different token states to the same owner

### 7.3 Nametag Resolution

Human-friendly addressing:

1. Nametags are special tokens in the NAMETAG_TOKEN_CLASS
2. Nametag token ID is calculated as hash("NAMETAG_" + name)
3. Sender includes the nametag in the dest_ref
4. Recipient resolves the nametag to a public key stored in the nametag token
5. Recipient must include the nametag token in their auxiliary data

## 8. Security Properties

The protocol guarantees:

- **Authenticity**: Only the legitimate owner can spend a token
- **Uniqueness**: Each token state can transition to exactly one next state
- **Privacy**: Previous owners cannot track subsequent transactions
- **Verifiability**: Any party can verify the complete and unique history of a token

## 9. Implementation Requirements

### 9.1 Token Implementation

The token implementation must:

1. Maintain immutable fields (token ID, class, value, immutable data)
2. Store genesis state with mint proofs
3. Validate the genesis state using unicity proofs
4. Maintain a history of transitions
5. Verify each transition when importing
6. Update the current state after valid transitions
7. Prevent double-spending through unicity proofs

### 9.2 Transaction Creation

Transaction creation requires:

1. Access to the current token state
2. A valid destination reference
3. Communication with the Unicity Aggregator for proof generation
4. Proper signing capability using the owner's private key

### 9.3 Transaction Import

Transaction import requires:

1. Access to the token structure and transaction
2. Validation of the token's complete history
3. Validation of the unicity proof
4. Verification of the transition integrity
5. Creation of a valid destination state (using recipient's private information)
6. Conversion of the transaction into a state transition
7. Application of the transition to the token

## 10. Appendix: Code Interface

Key functions in the JavaScript implementation:

```javascript
// Create a new token (mint)
async function mint({token_id, token_class_id, token_value, immutable_data, token_data, secret, nonce, mint_salt, sign_alg, hash_alg, transport})

// Create a transaction
async function createTx(token, dest_ref, salt, secret, transport, dataHash, msg)

// Import a transaction
function importTx(token, tx, destination)

// Export token and transaction as a flow
function exportFlow(token, transaction, pretify)

// Import token and transaction from a flow
function importFlow(tokenTransitionFlow, secret, nonce, dataJson, nametagTokens)

// Generate a recipient pointer address
function generateRecipientPointerAddr()

// Generate a recipient public key address
function generateRecipientPubkeyAddr()
```

These interfaces provide the foundation for implementing the Unicity Token Transaction Protocol in client applications.
