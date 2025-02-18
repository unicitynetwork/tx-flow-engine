#!/bin/bash

cd ../

# Scan the `txf` folder for .txf files
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

read -p "Select a token file by its number: " choice

# Validate the user's choice
if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -le 0 ] || [ "$choice" -gt ${#files[@]} ]; then
    echo "Invalid selection."
    exit 1
fi

# Get the selected file
selected_file="${files[$((choice - 1))]}"

read -p "Enter Token Data (optional): " token_data
if [ -n "$token_data" ]; then
    token_data_option="--data=$token_data"
else
    token_data_option=""
fi

read -p "Enter Nonce: " nonce
if [ -n "$nonce" ]; then
    nonce_option="--nonce $nonce"
else
    nonce_option=""
fi


# Scan the `txf` folder for the nametag .txf files
nametag_files=($(ls txf/nametag_*.txf 2>/dev/null))

# Check if there are any files to process
if [ ${#nametag_files[@]} -eq 0 ]; then
    export stdinput_str=$(cat $selected_file)
else

    # List files and ask the user to choose one by its order number
    echo "Available nametag files:"
    for i in "${!nametag_files[@]}"; do
	echo "$((i + 1)). ${nametag_files[$i]}"
    done

    read -p "Select a nametag token file by its number or empty to skip: " nametag_choice

    # Validate the user's choice
    if ! [[ "$nametag_choice" =~ ^[0-9]+$ ]] || [ "$nametag_choice" -le 0 ] || [ "$nametag_choice" -gt ${#nametag_files[@]} ]; then
	echo "No nametag selected"
        export stdinput_str=$(cat $selected_file)
    else
	# Get the selected nametag file
        selected_nametag_file="${nametag_files[$((nametag_choice - 1))]}"
        export stdinput_str=$(cat $selected_file; echo '### NAMETAG ###'; cat $selected_nametag_file)
    fi

fi


# Prompt for user secret
read -sp "Enter User Secret: " user_secret
echo

# Set the SECRET environment variable for the local context
export SECRET="$user_secret"



# Execute the command and capture the output
if output=$(echo $stdinput_str | ./token_manager.js receive "$token_data_option" $nonce_option); then

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
