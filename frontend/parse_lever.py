import urllib.request
import re

url = "https://jobs.lever.co/zoox/9935eecc-fca9-4f72-9ea8-85ebea928967/apply?utm_source=Simplify&ref=Simplify"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req).read().decode('utf-8')

header_match = re.search(r'<div class="main-header(?:.*?)</div></div></div>', html, re.DOTALL)
if header_match:
    print(header_match.group(0))
else:
    print("NO HEADER FOUND")
