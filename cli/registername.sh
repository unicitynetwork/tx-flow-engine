#!/bin/bash

cd ../

# Ensure the `txf` directory exists
mkdir -p txf

# Prompt user for required parameters with defaults
read -p "Enter name: " name
read -p "Enter address: " address

read -p "Enter Nonce (default: random 6-digit number): " nonce
nonce=${nonce:-$((RANDOM % 900000 + 100000))}

read -sp "Enter User Secret: " user_secret
echo

# Set the SECRET environment variable for the local context
export SECRET="$user_secret"

# Execute the command and capture the output
output=$(./token_manager.js register --name "$name" --address "$address" --nonce "$nonce")

# Create a filename based on token class and token ID
filename="txf/nametag_${name}.txf"

echo "$output"

echo
echo "================================================================================"
# Save the output to the file
echo "$output" > "$filename"

# Provide feedback to the user
echo "Command executed successfully. TX flow saved to $filename."
