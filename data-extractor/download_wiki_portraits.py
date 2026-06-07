#!/usr/bin/env python3
"""Download all species portrait images from the Stellaris wiki."""

import os
import time
import json
import urllib.request
import urllib.parse

API_URL = "https://stellaris.paradoxwikis.com/api.php"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output", "wiki_portraits")

HEADERS = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "accept-language": "fr-FR,fr;q=0.9,en-GB;q=0.8,en;q=0.7,en-US;q=0.6",
    "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "cookie": 'ab.storage.deviceId.ded63ae0-1d65-4c22-9cca-e6af5bcfe6fe=%7B%22g%22%3A%2298d0ea70-0ced-9d12-09be-df2758584cc6%22%2C%22c%22%3A1780841522316%2C%22l%22%3A1780841522316%7D; OptanonAlertBoxClosed=2026-06-07T14:12:05.123Z; _ga=GA1.1.166708164.1780841523; _gcl_au=1.1.721373725.1780841525; OptanonConsent=isGpcEnabled=0&datestamp=Sun+Jun+07+2026+10%3A21%3A05+GMT-0400+(Eastern+Daylight+Time)&version=202406.1.0&browserGpcFlag=0&isIABGlobal=false&hosts=&consentId=0ca62377-13a8-4d95-8e3f-93eba4f5538f&interactionCount=1&isAnonUser=1&landingPath=NotLandingPage&groups=C0004%3A1%2CC0002%3A1%2CC0003%3A1%2CC0001%3A1&intType=1&geolocation=CA%3BQC&AwaitingReconsent=false; _ga_140E4HWMGE=GS2.1.s1780841522$o1$g1$t1780842065$j60$l0$h0; ab.storage.sessionId.ded63ae0-1d65-4c22-9cca-e6af5bcfe6fe=%7B%22g%22%3A%22c68cee82-d06c-4c9e-c34f-cd8e1364a8c0%22%2C%22e%22%3A1780843865331%2C%22c%22%3A1780841522314%2C%22l%22%3A1780842065331%7D',
}


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read()


def get_all_portrait_files():
    files = []
    cmcontinue = None
    while True:
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": "Category:Species_portraits",
            "cmtype": "file",
            "cmlimit": "500",
            "format": "json",
        }
        if cmcontinue:
            params["cmcontinue"] = cmcontinue
        url = API_URL + "?" + urllib.parse.urlencode(params)
        data = json.loads(fetch(url))
        files.extend(m["title"] for m in data["query"]["categorymembers"])
        if "continue" in data:
            cmcontinue = data["continue"]["cmcontinue"]
        else:
            break
    return files


def get_image_urls(titles):
    url_map = {}
    batch_size = 50
    for i in range(0, len(titles), batch_size):
        batch = titles[i:i + batch_size]
        params = {
            "action": "query",
            "titles": "|".join(batch),
            "prop": "imageinfo",
            "iiprop": "url",
            "format": "json",
        }
        url = API_URL + "?" + urllib.parse.urlencode(params)
        data = json.loads(fetch(url))
        for page in data["query"]["pages"].values():
            if "imageinfo" in page:
                url_map[page["title"]] = page["imageinfo"][0]["url"]
        time.sleep(0.3)
    return url_map


def download_all(url_map):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    total = len(url_map)
    ok = 0
    for idx, (title, img_url) in enumerate(sorted(url_map.items()), 1):
        filename = title.removeprefix("File:").replace(" ", "_")
        out_path = os.path.join(OUTPUT_DIR, filename)
        if os.path.exists(out_path):
            print(f"[{idx}/{total}] skip {filename}")
            ok += 1
            continue
        try:
            data = fetch(img_url)
            if data[:4] == b'\x89PNG' or data[:2] in (b'\xff\xd8', b'GIF'):
                with open(out_path, "wb") as f:
                    f.write(data)
                print(f"[{idx}/{total}] ok {filename}")
                ok += 1
            else:
                print(f"[{idx}/{total}] FAIL (got HTML) {filename}")
        except Exception as e:
            print(f"[{idx}/{total}] ERROR {filename}: {e}")
        time.sleep(0.15)
    print(f"\nDone: {ok}/{total}")


def main():
    print("Fetching file list...")
    titles = get_all_portrait_files()
    print(f"Found {len(titles)} portraits")

    print("Fetching image URLs...")
    url_map = get_image_urls(titles)
    print(f"Got {len(url_map)} URLs")

    print(f"Downloading to {OUTPUT_DIR} ...")
    download_all(url_map)


if __name__ == "__main__":
    main()
