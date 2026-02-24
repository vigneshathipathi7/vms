import requests
from bs4 import BeautifulSoup
import json
import collections

# Add Municipal Corporations
corporations_url = 'https://en.wikipedia.org/wiki/List_of_municipal_corporations_in_Tamil_Nadu'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

data = collections.defaultdict(dict)

# Scrape Corporations
response = requests.get(corporations_url, headers=headers)
soup = BeautifulSoup(response.text, 'html.parser')

table = soup.find('table', {'class': 'wikitable'})
if table:
    for row in table.find_all('tr')[1:]:
        cols = [col.text.strip() for col in row.find_all(['td', 'th'])]
        if len(cols) >= 6:
            corp_name = cols[1]  # Update if column index is different
            district = cols[4]
            # Try to get wards, usually another column or we default to 100 for big ones, or we can check.
            try:
                wards = int(cols[5].split()[0])
            except:
                wards = 100
            
            data[district][f"{corp_name} Corporation"] = wards

# Scrape Municipalities
m_url = 'https://en.wikipedia.org/wiki/List_of_municipalities_in_Tamil_Nadu'
m_response = requests.get(m_url, headers=headers)
m_soup = BeautifulSoup(m_response.text, 'html.parser')

m_table = m_soup.find('table', {'class': 'wikitable'})
if m_table:
    for row in m_table.find_all('tr')[1:]:
        cols = [col.text.strip() for col in row.find_all('td')]
        if len(cols) >= 3: # Usually S.No, Municipality Name, District
            m_name = cols[1]
            district = cols[2]
            # Hard to find exact wards from this table usually, but we can assign placeholder count or parse if it has wards column
            wards = 30 # placeholder typical for municipalities
            if len(cols) >= 4 and cols[3].isdigit():
                wards = int(cols[3])
                
            data[district][f"{m_name} Municipality"] = wards

# Clean up districts where needed (e.g. sometimes string contains [note 1] etc.)
cleaned_data = {}
for dist, ulbs in data.items():
    c_dist = dist.split('[')[0].strip()
    c_ulbs = {}
    for ulb, wards in ulbs.items():
        c_ulb = ulb.split('[')[0].strip()
        c_ulbs[c_ulb] = wards
    
    if c_dist not in cleaned_data:
        cleaned_data[c_dist] = {}
    cleaned_data[c_dist].update(c_ulbs)

with open('scraped_wards.json', 'w') as f:
    json.dump(cleaned_data, f, indent=2)
print("Finished writing to scraped_wards.json")
