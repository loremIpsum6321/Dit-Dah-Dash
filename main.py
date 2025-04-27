# rename_project_references.py
# -------------
# This script recursively searches for files within a specified target directory
# and replaces all occurrences of an old string with a new string within the
# content of text-based files. It's designed to update project name references
# after a root directory rename.

import os
from pathlib import Path

# --- Configuration ---
TARGET_DIRECTORY = "Dit-Dah-Dash"  # The name of the project directory to search within
OLD_STRING = "morse_master"        # The string to be replaced
NEW_STRING = "Dit-Dah-Dash"        # The string to replace with
FILE_ENCODING = "utf-8"           # Default encoding to try for reading/writing files

# --- Functions ---

def update_file_content(file_path: Path, old_str: str, new_str: str, encoding: str) -> bool:
    """
    Reads a file, replaces occurrences of old_str with new_str, and writes back.

    Args:
        file_path (Path): The Path object representing the file to process.
        old_str (str): The string to find within the file content.
        new_str (str): The string to replace old_str with.
        encoding (str): The file encoding to use for reading and writing.

    Returns:
        bool: True if the file was modified and saved, False otherwise.

    Raises:
        Prints error messages to stderr for file access or encoding issues.
    """
    try:
        # Read the file content
        content = file_path.read_text(encoding=encoding)

        # Check if replacement is needed
        if old_str in content:
            print(f"  Updating references in: {file_path}")
            # Perform replacement
            new_content = content.replace(old_str, new_str)

            # Write the modified content back
            try:
                file_path.write_text(new_content, encoding=encoding)
                return True
            except OSError as write_err:
                print(f"  ERROR: Could not write changes to {file_path}: {write_err}", file=os.sys.stderr)
                return False
            except Exception as e:
                 print(f"  ERROR: An unexpected error occurred writing to {file_path}: {e}", file=os.sys.stderr)
                 return False
        else:
            # No replacement needed
            return False

    except UnicodeDecodeError:
        # Likely a binary file or wrong encoding, skip it
        print(f"  Skipping (possible binary file or wrong encoding): {file_path}")
        return False
    except OSError as read_err:
        print(f"  ERROR: Could not read file {file_path}: {read_err}", file=os.sys.stderr)
        return False
    except Exception as e:
         print(f"  ERROR: An unexpected error occurred reading {file_path}: {e}", file=os.sys.stderr)
         return False

def process_directory(target_dir: str, old_str: str, new_str: str, encoding: str):
    """
    Recursively processes all files in the target directory.

    Args:
        target_dir (str): The path to the directory to process.
        old_str (str): The string to find.
        new_str (str): The string to replace with.
        encoding (str): The file encoding to use.
    """
    root_path = Path(target_dir)
    if not root_path.is_dir():
        print(f"ERROR: Target directory '{target_dir}' not found or is not a directory.", file=os.sys.stderr)
        return

    print(f"Starting search in directory: {root_path.resolve()}")
    files_processed = 0
    files_updated = 0

    # Use rglob to find all items recursively
    for item_path in root_path.rglob('*'):
        if item_path.is_file():
            files_processed += 1
            print(f"Checking: {item_path}")
            if update_file_content(item_path, old_str, new_str, encoding):
                files_updated += 1

    print("\nProcessing complete.")
    print(f"Files checked: {files_processed}")
    print(f"Files updated: {files_updated}")

# --- Main Execution ---

if __name__ == "__main__":
    process_directory(TARGET_DIRECTORY, OLD_STRING, NEW_STRING, FILE_ENCODING)