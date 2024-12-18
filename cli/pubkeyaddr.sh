#!/bin/bash

cd ../

read -sp "Enter User Secret: " user_secret
echo

# Set the SECRET environment variable for the local context
export SECRET="$user_secret"

# Execute the command and capture the output
output=$(./token_manager.js pubkey)

# Provide feedback to the user
echo "PubKeyAddr: $output"
