#!/usr/bin/env python3
"""
fetch_sheet.py — Google Sheet CSV 导出抓取
用法: python3 fetch_sheet.py <spreadsheet_id> <gid> [output_path]
"""
import sys
import urllib.request
import os

def fetch_sheet_csv(spreadsheet_id: str, gid: str, output_path: str = None) -> str:
    url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv&gid={gid}"
    
    if output_path is None:
        output_path = f"/tmp/sheet_{gid}.csv"
    
    urllib.request.urlretrieve(url, output_path)
    
    # 返回行数统计
    with open(output_path, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()
    
    print(f"✅ Fetched: {len(lines)} rows → {output_path}")
    return output_path

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 fetch_sheet.py <spreadsheet_id> <gid> [output_path]")
        sys.exit(1)
    
    sid = sys.argv[1]
    gid = sys.argv[2]
    out = sys.argv[3] if len(sys.argv) > 3 else None
    fetch_sheet_csv(sid, gid, out)
