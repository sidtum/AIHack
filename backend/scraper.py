import httpx
import re

async def fetch_simplify_jobs():
    """Scrape SimplifyJobs Summer 2026 internships from GitHub README."""
    url = "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(url)
            response.raise_for_status()
            content = response.text

            # Parse markdown table rows: | Company | Role | Location | Link |
            # The table uses format: **[Company](url)** or [Apply](url)
            jobs = []

            # Extract table rows
            for line in content.split("\n"):
                if "|" not in line or "---" in line or "Company" in line:
                    continue

                cells = [c.strip() for c in line.split("|")]
                if len(cells) < 4:
                    continue

                # Extract company name
                company_match = re.search(r'\*\*\[([^\]]+)\]', cells[1]) or re.search(r'\[([^\]]+)\]', cells[1])
                company = company_match.group(1) if company_match else cells[1].strip("* ")

                # Extract role
                role = cells[2].strip() if len(cells) > 2 else ""

                # Extract location
                location = cells[3].strip() if len(cells) > 3 else ""

                # Extract application URL
                url_match = re.search(r'\[(?:Apply|🔒)\]\((https?://[^\)]+)\)', line)
                if not url_match:
                    # Try any link in the row
                    url_match = re.search(r'\((https?://(?:(?!github\.com)[^\)]+))\)', line)

                if not url_match:
                    continue

                apply_url = url_match.group(1)

                # Filter for SWE-related roles
                role_lower = role.lower()
                if any(kw in role_lower for kw in ["software", "swe", "engineer", "developer", "intern", "full stack", "backend", "frontend"]):
                    jobs.append({
                        "company": company,
                        "role": role,
                        "location": location,
                        "url": apply_url,
                    })

            return jobs[:5]  # Return top 5 for demo

    except Exception as e:
        print(f"Failed to fetch jobs: {e}")
        return []

if __name__ == "__main__":
    import asyncio
    jobs = asyncio.run(fetch_simplify_jobs())
    for j in jobs:
        print(j)
