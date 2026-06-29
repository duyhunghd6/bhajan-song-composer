import os
import re
import json
import sys

def verify_and_extract_beads_ids(directory):
    # Regex matching simple: <!-- beads-id: br-prd01-s1 -->
    # Regex matching complex: <!-- beads-id: br-plan-01 | satisfies: br-prd02-s1, br-prd02-s2 -->
    # Notice we include \s in the satisfies capture group to allow spaces like 'br-1, br-2'
    pattern_simple = re.compile(r'^<!--\s*beads-id:\s*([a-zA-Z0-9_-]+)\s*-->$')
    pattern_complex = re.compile(r'^<!--\s*beads-id:\s*([a-zA-Z0-9_-]+)\s*\|\s*satisfies:\s*([a-zA-Z0-9_,\-\s]+)\s*-->$')
    
    results = []
    has_errors = False

    for root, _, files in os.walk(directory):
        for file in files:
            if not file.endswith('.md'):
                continue
                
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # Find all HTML comments to check for multi-line beads-id violations
            comments = re.finditer(r'<!--(.*?)-->', content, re.DOTALL)
            
            lines = content.split('\n')
            
            for comment in comments:
                text = comment.group(1)
                if 'beads-id' in text:
                    line_num = content[:comment.start()].count('\n') + 1
                    
                    # Check if it spans multiple lines
                    if '\n' in text:
                        print(f"[LINT ERROR] File: {filepath} | Line: {line_num} | Issue: Multi-line metadata")
                        print(f"  Fix Instruction: Merge the metadata into a single line. Example: <!-- beads-id: br-xxx | satisfies: br-yyy -->")
                        print(f"  Snippet:")
                        print(f"  {comment.group(0).strip()}")
                        has_errors = True
                        continue
                    
                    comment_str = comment.group(0).strip()
                    
                    match_complex = pattern_complex.search(comment_str)
                    if match_complex:
                        beads_id = match_complex.group(1).strip()
                        raw_satisfies = match_complex.group(2)
                        satisfies = [s.strip() for s in raw_satisfies.split(',') if s.strip()]
                        results.append({
                            "id": beads_id,
                            "file": filepath,
                            "line": line_num,
                            "satisfies": satisfies,
                            "type": "complex"
                        })
                        continue
                        
                    match_simple = pattern_simple.search(comment_str)
                    if match_simple:
                        beads_id = match_simple.group(1).strip()
                        results.append({
                            "id": beads_id,
                            "file": filepath,
                            "line": line_num,
                            "satisfies": [],
                            "type": "simple"
                        })
                        continue
                    
                    # If it contains beads-id but didn't match our valid patterns
                    print(f"[LINT ERROR] File: {filepath} | Line: {line_num} | Issue: Invalid format syntax")
                    print(f"  Fix Instruction: Ensure exact spacing and structure: <!-- beads-id: br-xxx --> OR <!-- beads-id: br-xxx | satisfies: br-yyy, br-zzz -->")
                    print(f"  Snippet: {comment_str}")
                    has_errors = True

    return results, has_errors

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_ids.py <target_directory_or_file>")
        sys.exit(1)
        
    target_path = sys.argv[1]
    
    if not os.path.exists(target_path):
        print(f"Error: Path {target_path} does not exist.")
        sys.exit(1)
        
    if os.path.isfile(target_path):
        target_dir = os.path.dirname(target_path)
    else:
        target_dir = target_path
        
    extracted, has_errors = verify_and_extract_beads_ids(target_dir)
    
    if has_errors:
        print("\nVerification FAILED. Please fix the formatting errors above.")
        print("Rule: All metadata HTML comments must be strictly on a single line.")
        sys.exit(1)
        
    print(json.dumps(extracted, indent=2))
    print("\nVerification PASSED.", file=sys.stderr)

