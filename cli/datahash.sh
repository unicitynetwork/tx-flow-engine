#!/bin/bash

cd ../

read -p "Enter Token Data: " token_data
echo

# Execute the command and capture the output
output=$(./token_manager.js tokendata --data="$token_data")

# Provide feedback to the user
echo "Hash: $output"
