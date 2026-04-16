import re
import sys

def analyze_tags(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    stack = []
    for i, line in enumerate(lines):
        line_num = i + 1
        # Find all tags on this line
        # This is a very crude regex, but might help
        tags = re.findall(r'<(?!/)([a-zA-Z0-9]+)|</([a-zA-Z0-9]+)>', line)
        for open_tag, close_tag in tags:
            if open_tag:
                # Filter out standard voids if they are self-closing on this line
                if re.search(f'<{open_tag}[^>]*/>', line):
                    continue
                # Also ignore some common ones that might not be closed or are just noise
                if open_tag in ['br', 'hr', 'img', 'input', 'meta', 'link']:
                    continue
                stack.append((open_tag, line_num))
            elif close_tag:
                if not stack:
                    print(f"Extra closing tag </{close_tag}> at line {line_num}")
                else:
                    last_open, last_line = stack.pop()
                    if last_open != close_tag:
                        print(f"Mismatched tag at line {line_num}: </{close_tag}> closes <{last_open}> from line {last_line}")

if __name__ == "__main__":
    analyze_tags(sys.argv[1])
