#!/bin/bash

cd ../

# Scan the `txf` folder for .txt files
files=($(ls txf/*.txf 2>/dev/null))

# Check if there are any files to process
if [ ${#files[@]} -eq 0 ]; then
    echo "No transaction flow files found in the txf folder."
    exit 1
fi

# List files and ask the user to choose one by its order number
echo "Available transaction flow files:"
for i in "${!files[@]}"; do
    echo "$((i + 1)). ${files[$i]}"
done

read -p "Select a file by its number: " choice

# Validate the user's choice
if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -le 0 ] || [ "$choice" -gt ${#files[@]} ]; then
    echo "Invalid selection."
    exit 1
fi

# Get the selected file
selected_file="${files[$((choice - 1))]}"

read -p "Enter Nonce: " nonce
if [ -n "$nonce" ]; then
    nonce_option="--nonce $nonce"
else
    nonce_option=""
fi

# Prompt for user secret
read -sp "Enter User Secret: " user_secret
echo

# Set the SECRET environment variable for the local context
export SECRET="$user_secret"

# Execute the command and capture the output
if output=$(cat $selected_file | ./token_manager.js receive "$nonce_option"); then

    echo "$output"

    # Update the selected file with the output
    echo "$output" > "$selected_file"
    
    echo
    echo "======================================================================"
    # Provide feedback to the user
    echo "Transaction received successfully for nonce $nonce."
    echo "Updated file: $selected_file."
else
    # Provide feedback on failure
    echo "$output"
    echo "Failed to process transaction for nonce $nonce."
    exit 1
fi
