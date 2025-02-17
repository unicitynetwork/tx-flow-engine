#!/bin/bash

cd ../

# Prompt user for required parameters with defaults
read -p "Enter Token Class (default: unicity_test_coin): " token_class
token_class=${token_class:-unicity_test_coin}

read -p "Enter Nonce (default: random 6-digit number): " nonce
nonce=${nonce:-$((RANDOM % 900000 + 100000))}

read -sp "Enter User Secret: " user_secret
echo

# Set the SECRET environment variable for the local context
export SECRET="$user_secret"

# Execute the command and capture the output
output=$(./token_manager.js pointer --token_class "$token_class" --nonce "$nonce")

# Provide feedback to the user
echo "Nonce: $nonce"
echo "Pointer: $output"
