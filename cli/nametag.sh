#!/bin/bash

cd ../

read -p "Enter name: " name
echo

# Execute the command and capture the output
output=$(./token_manager.js nametag --name $name)

# Provide feedback to the user
echo "NametagAddr: $output"
