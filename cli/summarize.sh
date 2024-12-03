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
echo "Transaction flow files:"
for i in "${!files[@]}"; do
    echo "$((i + 1)). ${files[$i]}"
done

read -p "Enter Token Class (default: unicity_test_coin): " token_class
token_class=${token_class:-unicity_test_coin}

read -sp "Enter User Secret: " user_secret
echo

# Set the SECRET environment variable for the local context
export SECRET="$user_secret"

joinedFlows=""

for file in "${files[@]}"; do
    if [[ -f $file ]]; then
      content=$(<"$file") # Read file content
      joinedFlows+="###TOKEN $file $content "
    else
      echo "Warning: File '$file' does not exist or is not a regular file." >&2
    fi
  done


# Execute the command with the selected file as stdin
if output=$(echo $joinedFlows | ./token_manager.js summary --token_class "$token_class"); then
    # Rename the file after successful execution
    
    echo "$output"
else
    echo "$output"
    echo "Failed to summarize tokens."
    exit 1
fi
