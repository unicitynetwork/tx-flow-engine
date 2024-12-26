#!/bin/bash

cd ../

# Ensure the `txf` directory exists
mkdir -p txf

# Prompt user for required parameters with defaults
read -p "Enter Token ID (default: random 6-digit number): " token_id
token_id=${token_id:-$((RANDOM % 900000 + 100000))}
read -p "Enter Token Class (default: unicity_test_coin): " token_class
token_class=${token_class:-unicity_test_coin}

read -p "Enter Token Value (default: 10000000000000000000): " token_value
token_value=${token_value:-1000000000000000000}

read -p "Enter Token Data (optional): " token_data
if [ -n "$token_data" ]; then
    token_data_option="--data='$token_data'"
else
    token_data_option=""
fi

read -p "Enter Nonce (default: random 6-digit number): " nonce
nonce=${nonce:-$((RANDOM % 900000 + 100000))}

read -sp "Enter User Secret: " user_secret
echo

# Set the SECRET environment variable for the local context
export SECRET="$user_secret"

# Execute the command and capture the output
output=$(./token_manager.js mint --token_id "$token_id" --token_class "$token_class" --token_value "$token_value" $token_data_option --nonce "$nonce")

# Create a filename based on token class and token ID
filename="txf/${token_class}_${token_id}.txf"

echo "$output"

echo
echo "================================================================================"
# Save the output to the file
echo "$output" > "$filename"

# Provide feedback to the user
echo "Command executed successfully. TX flow saved to $filename."
